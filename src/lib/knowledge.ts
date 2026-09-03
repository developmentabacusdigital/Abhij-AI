import fs from 'fs';
import path from 'path';
import os from 'os';
import matter from 'gray-matter';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { ensureDbReady, isDbConfigured } from '@/lib/db';

export interface DocumentSection {
  id: string;
  filename: string;
  filetype: 'md' | 'docx' | 'doc' | 'txt';
  title: string;
  heading: string;
  content: string;
  tags?: string[];
}

export interface KnowledgeDocument {
  filename: string;
  filetype: 'md' | 'docx' | 'doc' | 'txt';
  title: string;
  content: string;
  size: number;
  sectionsCount: number;
}

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');
const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.docx', '.doc', '.txt'];

/**
 * Ensure the knowledge directory exists
 */
function ensureKnowledgeDir() {
  if (!fs.existsSync(KNOWLEDGE_DIR)) {
    fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });
  }
}

/**
 * Parses content from various file formats into markdown-compatible text
 */
async function parseFileContent(
  filename: string,
  fullPath: string
): Promise<{ title: string; content: string; filetype: 'md' | 'docx' | 'doc' | 'txt' }> {
  const ext = path.extname(filename).toLowerCase();

  if (ext === '.docx') {
    try {
      const safeDocName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
      const docMediaDir = path.join(process.cwd(), 'public', 'knowledge-media', safeDocName);
      let imageIndex = 0;

      const mammothOptions: any = {
        convertImage: mammoth.images.imgElement(async (element: any) => {
          try {
            imageIndex++;
            const rawExt = element.contentType ? element.contentType.split('/')[1] : 'png';
            const safeExt = rawExt === 'jpeg' ? 'jpg' : rawExt;
            const imageName = `image_${imageIndex}.${safeExt}`;

            const imageBuffer = await element.read();

            try {
              if (!fs.existsSync(docMediaDir)) {
                fs.mkdirSync(docMediaDir, { recursive: true });
              }
              fs.writeFileSync(path.join(docMediaDir, imageName), imageBuffer);
            } catch {
              const tmpDir = path.join(os.tmpdir(), 'knowledge-media', safeDocName);
              if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
              }
              fs.writeFileSync(path.join(tmpDir, imageName), imageBuffer);
            }

            const publicPath = `/api/knowledge/media?doc=${encodeURIComponent(filename)}&img=${encodeURIComponent(imageName)}`;
            return {
              src: publicPath,
              alt: element.altText || `Figure ${imageIndex} in ${filename}`,
            };
          } catch (imgErr) {
            console.error(`Error saving image from ${filename}:`, imgErr);
            return {
              src: '',
              alt: `[Image from ${filename}]`,
            };
          }
        }),
      };

      const result = await mammoth.convertToMarkdown({ path: fullPath }, mammothOptions);
      const markdownContent = result.value.trim();
      const h1Match = markdownContent.match(/^#\s+(.+)$/m);
      const title = h1Match ? h1Match[1].trim() : path.basename(filename, ext);
      return { title, content: markdownContent, filetype: 'docx' };
    } catch (err) {
      console.error(`Error reading docx ${filename}:`, err);
      return {
        title: path.basename(filename, ext),
        content: `Error parsing DOCX file: ${filename}`,
        filetype: 'docx',
      };
    }
  }

  if (ext === '.doc') {
    try {
      const extractor = new WordExtractor();
      const extracted = await extractor.extract(fullPath);
      const bodyText = extracted.getBody().trim();
      
      // Convert paragraphs into markdown formatted lines
      const paragraphs = bodyText
        .split(/\r?\n\s*\r?\n/)
        .map(p => p.trim())
        .filter(Boolean);

      const title = paragraphs[0]?.slice(0, 60) || path.basename(filename, ext);
      const content = paragraphs.join('\n\n');
      return { title, content, filetype: 'doc' };
    } catch (err) {
      console.error(`Error reading doc ${filename}:`, err);
      return {
        title: path.basename(filename, ext),
        content: `Error parsing legacy DOC file: ${filename}`,
        filetype: 'doc',
      };
    }
  }

  if (ext === '.txt') {
    try {
      const rawText = fs.readFileSync(fullPath, 'utf8').trim();
      const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
      const title = lines[0]?.slice(0, 60) || path.basename(filename, ext);
      return { title, content: rawText, filetype: 'txt' };
    } catch (err) {
      console.error(`Error reading txt ${filename}:`, err);
      return {
        title: path.basename(filename, ext),
        content: `Error reading TXT file: ${filename}`,
        filetype: 'txt',
      };
    }
  }

  // Default: .md, .markdown
  try {
    const rawContent = fs.readFileSync(fullPath, 'utf8');
    const { data, content: rawParsed } = matter(rawContent);
    let title = data.title;
    if (!title) {
      const h1Match = rawParsed.match(/^#\s+(.+)$/m);
      title = h1Match ? h1Match[1].trim() : path.basename(filename, ext);
    }

    // Resolve relative markdown images like ![alt](diagram.png) to /api/knowledge/media?file=diagram.png
    const content = rawParsed.replace(/!\[(.*?)\]\((?!https?:\/\/|\/)(.*?)\)/g, (match, alt, src) => {
      return `![${alt}](/api/knowledge/media?file=${encodeURIComponent(src)})`;
    });

    return { title, content, filetype: 'md' };
  } catch (err) {
    console.error(`Error reading markdown ${filename}:`, err);
    return {
      title: path.basename(filename, ext),
      content: `Error reading markdown file: ${filename}`,
      filetype: 'md',
    };
  }
}

/**
 * Validate that a filename is safe and has a supported extension
 */
export function isSafeFilename(filename: string): boolean {
  if (!filename || typeof filename !== 'string') return false;
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes('\0')) {
    return false;
  }
  const ext = path.extname(filename).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Synchronize local knowledge files to Neon DB (auto-seeds on empty DB)
 */
async function syncLocalFilesToDb(sql: any): Promise<void> {
  try {
    ensureKnowledgeDir();
    const localFiles = fs.existsSync(KNOWLEDGE_DIR) ? fs.readdirSync(KNOWLEDGE_DIR) : [];
    const validFiles = localFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && !file.startsWith('.');
    });

    for (const filename of validFiles) {
      const fullPath = path.join(KNOWLEDGE_DIR, filename);
      const stat = fs.statSync(fullPath);
      const { title, content, filetype } = await parseFileContent(filename, fullPath);

      await sql`
        INSERT INTO knowledge_documents (filename, filetype, title, content, size, updated_at)
        VALUES (${filename}, ${filetype}, ${title}, ${content}, ${stat.size}, NOW())
        ON CONFLICT (filename) DO NOTHING;
      `;
    }
  } catch (err) {
    console.error('Error syncing local files to Neon DB:', err);
  }
}

/**
 * Save or update a knowledge document (disk + Neon DB)
 */
export async function saveKnowledgeDocument(
  filename: string,
  content: Buffer | string
): Promise<{ success: boolean; error?: string }> {
  ensureKnowledgeDir();
  if (!isSafeFilename(filename)) {
    return { success: false, error: 'Invalid or unsupported filename format' };
  }

  const targetPath = path.join(KNOWLEDGE_DIR, filename);
  let diskSuccess = false;

  try {
    fs.writeFileSync(targetPath, content);
    diskSuccess = true;
  } catch (err: any) {
    console.warn(`Could not write to ${targetPath}, attempting tmpdir fallback:`, err.message);
    try {
      const tmpKnowledge = path.join(os.tmpdir(), 'knowledge');
      if (!fs.existsSync(tmpKnowledge)) {
        fs.mkdirSync(tmpKnowledge, { recursive: true });
      }
      fs.writeFileSync(path.join(tmpKnowledge, filename), content);
      diskSuccess = true;
    } catch (tmpErr: any) {
      console.warn('Could not write to tmpdir either:', tmpErr.message);
    }
  }

  // Also sync to Neon DB if configured
  if (isDbConfigured()) {
    try {
      const sql = await ensureDbReady();
      if (sql) {
        const ext = path.extname(filename).toLowerCase();
        let filetype: 'md' | 'docx' | 'doc' | 'txt' = 'md';
        if (ext === '.docx') filetype = 'docx';
        else if (ext === '.doc') filetype = 'doc';
        else if (ext === '.txt') filetype = 'txt';

        let title = path.basename(filename, ext);
        let parsedContent = '';

        if (filetype === 'docx' || filetype === 'doc') {
          // If binary buffer, parse it to extract markdown text for database indexing
          const fullTempPath = fs.existsSync(targetPath)
            ? targetPath
            : path.join(os.tmpdir(), 'knowledge', filename);
          if (fs.existsSync(fullTempPath)) {
            const parsed = await parseFileContent(filename, fullTempPath);
            title = parsed.title;
            parsedContent = parsed.content;
          }
        } else {
          parsedContent = typeof content === 'string' ? content : content.toString('utf-8');
          const h1Match = parsedContent.match(/^#\s+(.+)$/m);
          if (h1Match) title = h1Match[1].trim();
        }

        const byteSize = Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content, 'utf-8');

        await sql`
          INSERT INTO knowledge_documents (filename, filetype, title, content, size, updated_at)
          VALUES (${filename}, ${filetype}, ${title}, ${parsedContent}, ${byteSize}, NOW())
          ON CONFLICT (filename) DO UPDATE SET
            title = EXCLUDED.title,
            content = EXCLUDED.content,
            size = EXCLUDED.size,
            updated_at = NOW();
        `;
        return { success: true };
      }
    } catch (dbErr: any) {
      console.warn('Neon DB save error in saveKnowledgeDocument:', dbErr.message);
    }
  }

  if (diskSuccess) return { success: true };
  return { success: false, error: 'Failed to save document' };
}

/**
 * Delete a knowledge document (disk + Neon DB)
 */
export async function deleteKnowledgeDocument(
  filename: string
): Promise<{ success: boolean; error?: string }> {
  ensureKnowledgeDir();
  if (!isSafeFilename(filename)) {
    return { success: false, error: 'Invalid filename' };
  }

  const targetPath = path.join(KNOWLEDGE_DIR, filename);
  const tmpPath = path.join(os.tmpdir(), 'knowledge', filename);
  let deleted = false;

  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
      deleted = true;
    } catch (err: any) {
      console.warn(`Could not delete from ${targetPath}:`, err.message);
    }
  }

  if (fs.existsSync(tmpPath)) {
    try {
      fs.unlinkSync(tmpPath);
      deleted = true;
    } catch {}
  }

  // Also clean up any extracted media folder for this document
  const ext = path.extname(filename).toLowerCase();
  const safeDocName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  const mediaDir = path.join(process.cwd(), 'public', 'knowledge-media', safeDocName);
  const tmpMediaDir = path.join(os.tmpdir(), 'knowledge-media', safeDocName);

  if (fs.existsSync(mediaDir)) {
    try {
      fs.rmSync(mediaDir, { recursive: true, force: true });
    } catch {}
  }
  if (fs.existsSync(tmpMediaDir)) {
    try {
      fs.rmSync(tmpMediaDir, { recursive: true, force: true });
    } catch {}
  }

  // Also delete from Neon DB if configured
  if (isDbConfigured()) {
    try {
      const sql = await ensureDbReady();
      if (sql) {
        await sql`
          DELETE FROM knowledge_documents WHERE filename = ${filename};
        `;
        deleted = true;
      }
    } catch (dbErr: any) {
      console.warn('Neon DB delete error:', dbErr.message);
    }
  }

  if (!deleted) {
    return { success: false, error: 'File does not exist or could not be removed' };
  }

  return { success: true };
}

/**
 * Get all supported files in the knowledge base (Neon DB or local filesystem)
 */
export async function getAllKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  // If Neon DB is configured, retrieve from Neon DB
  if (isDbConfigured()) {
    try {
      const sql = await ensureDbReady();
      if (sql) {
        let rows = await sql`
          SELECT filename, filetype, title, content, size
          FROM knowledge_documents
          ORDER BY updated_at DESC;
        `;

        // If table is empty on first query, auto-seed from local files
        if (rows.length === 0) {
          await syncLocalFilesToDb(sql);
          rows = await sql`
            SELECT filename, filetype, title, content, size
            FROM knowledge_documents
            ORDER BY updated_at DESC;
          `;
        }

        if (rows.length > 0) {
          return rows.map((r: any) => {
            const sections = r.content.split(/^#{1,3}\s+/m).filter(Boolean);
            return {
              filename: r.filename,
              filetype: r.filetype as 'md' | 'docx' | 'doc' | 'txt',
              title: r.title,
              content: r.content,
              size: Number(r.size),
              sectionsCount: Math.max(1, sections.length),
            };
          });
        }
      }
    } catch (dbErr) {
      console.warn('Neon DB query error in getAllKnowledgeDocuments, falling back to disk:', dbErr);
    }
  }

  // Fallback: Read from local filesystem & OS tmpdir
  ensureKnowledgeDir();
  try {
    const localFiles = fs.existsSync(KNOWLEDGE_DIR) ? fs.readdirSync(KNOWLEDGE_DIR) : [];
    const tmpKnowledge = path.join(os.tmpdir(), 'knowledge');
    const tmpFiles = fs.existsSync(tmpKnowledge) ? fs.readdirSync(tmpKnowledge) : [];

    const allFileMap = new Map<string, string>();
    for (const f of localFiles) {
      allFileMap.set(f, path.join(KNOWLEDGE_DIR, f));
    }
    for (const f of tmpFiles) {
      allFileMap.set(f, path.join(tmpKnowledge, f));
    }

    const validFiles = Array.from(allFileMap.keys()).filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.includes(ext) && !file.startsWith('.');
    });

    const documents: KnowledgeDocument[] = [];

    for (const filename of validFiles) {
      const fullPath = allFileMap.get(filename)!;
      const stat = fs.statSync(fullPath);
      const { title, content, filetype } = await parseFileContent(filename, fullPath);

      // Estimate sections (either markdown headers or paragraph clusters)
      const sections = content.split(/^#{1,3}\s+/m).filter(Boolean);

      documents.push({
        filename,
        filetype,
        title,
        content,
        size: stat.size,
        sectionsCount: Math.max(1, sections.length),
      });
    }

    return documents;
  } catch (error) {
    console.error('Error reading knowledge directory:', error);
    return [];
  }
}

/**
 * Break down documents into searchable chunks/sections based on headers and paragraphs
 */
export async function getAllDocumentSections(): Promise<DocumentSection[]> {
  const documents = await getAllKnowledgeDocuments();
  const allSections: DocumentSection[] = [];

  for (const doc of documents) {
    const lines = doc.content.split('\n');
    let currentHeading = doc.title;
    let currentLines: string[] = [];
    let sectionIdx = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headerMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headerMatch) {
        if (currentLines.length > 0) {
          const sectionContent = currentLines.join('\n').trim();
          if (sectionContent.length > 20) {
            allSections.push({
              id: `${doc.filename}-sec-${sectionIdx++}`,
              filename: doc.filename,
              filetype: doc.filetype,
              title: doc.title,
              heading: currentHeading,
              content: sectionContent,
            });
          }
        }
        currentHeading = headerMatch[2].trim();
        currentLines = [line];
      } else {
        currentLines.push(line);
      }
    }

    if (currentLines.length > 0) {
      const sectionContent = currentLines.join('\n').trim();
      if (sectionContent.length > 20) {
        allSections.push({
          id: `${doc.filename}-sec-${sectionIdx++}`,
          filename: doc.filename,
          filetype: doc.filetype,
          title: doc.title,
          heading: currentHeading,
          content: sectionContent,
        });
      }
    }
  }

  return allSections;
}

const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'in', 'for', 'to', 'of',
  'with', 'about', 'what', 'where', 'when', 'who', 'how', 'why', 'can', 'could', 'should',
  'would', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'this', 'that', 'these', 'those', 'from', 'by', 'it', 'its', 'they', 'them', 'their'
]);

/**
 * Tokenizes text for relevance ranking, excluding common stopwords
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2 && !STOP_WORDS.has(token));
}

const GREETINGS_AND_PLEASANTRIES = new Set([
  'hi', 'hello', 'hey', 'heya', 'howdy', 'hola', 'yo', 'sup',
  'good morning', 'good afternoon', 'good evening', 'good day',
  'how are you', 'how are you doing', 'how r u', 'hows it going', "how's it going",
  'who are you', 'what are you', 'what can you do', 'tell me about yourself',
  'thanks', 'thank you', 'thx', 'bye', 'goodbye', 'see ya', 'see you', 'help'
]);

/**
 * Checks if a query is a general greeting or conversational pleasantry
 */
export function isConversationalQuery(query: string): boolean {
  if (!query) return true;
  const clean = query.trim().toLowerCase().replace(/[!?.,;:]/g, '');
  if (!clean) return true;
  if (GREETINGS_AND_PLEASANTRIES.has(clean)) return true;
  if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening))\b/i.test(clean) && clean.split(/\s+/).length <= 4) {
    return true;
  }
  return false;
}

/**
 * Search and retrieve the most relevant sections for a user query
 */
export async function searchRelevantKnowledge(query: string, maxResults: number = 4): Promise<{
  sections: DocumentSection[];
  usedFilenames: string[];
  contextString: string;
  isGreeting: boolean;
}> {
  if (isConversationalQuery(query)) {
    return {
      sections: [],
      usedFilenames: [],
      contextString: '',
      isGreeting: true,
    };
  }

  const queryTokens = tokenize(query);
  const sections = await getAllDocumentSections();

  if (sections.length === 0) {
    return {
      sections: [],
      usedFilenames: [],
      contextString: 'No knowledge base documents currently available.',
      isGreeting: false,
    };
  }

  if (queryTokens.length === 0) {
    return {
      sections: [],
      usedFilenames: [],
      contextString: '',
      isGreeting: false,
    };
  }

  // Score each section based on token matches, heading weights, and exact phrase match
  const scored = sections.map(section => {
    let score = 0;
    const lowerContent = section.content.toLowerCase();
    const lowerHeading = section.heading.toLowerCase();
    const lowerTitle = section.title.toLowerCase();
    const lowerFilename = section.filename.toLowerCase();

    // Exact query match boost
    const cleanQuery = query.toLowerCase().trim();
    if (lowerContent.includes(cleanQuery)) score += 10;
    if (lowerHeading.includes(cleanQuery)) score += 15;

    for (const token of queryTokens) {
      const contentMatches = (lowerContent.match(new RegExp(`\\b${token}\\b`, 'g')) || []).length;
      score += Math.min(contentMatches, 5) * 1.5;

      if (lowerHeading.includes(token)) score += 5;
      if (lowerTitle.includes(token)) score += 3;
      if (lowerFilename.includes(token)) score += 2;
    }

    return { section, score };
  });

  const relevantScored = scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (relevantScored.length === 0) {
    return {
      sections: [],
      usedFilenames: [],
      contextString: '',
      isGreeting: false,
    };
  }

  const selectedSections = relevantScored.slice(0, maxResults).map(i => i.section);
  const usedFilenames = Array.from(new Set(selectedSections.map(s => s.filename)));

  return {
    sections: selectedSections,
    usedFilenames,
    contextString: formatContext(selectedSections),
    isGreeting: false,
  };
}

function formatContext(sections: DocumentSection[]): string {
  return sections
    .map(
      sec =>
        `[Document: ${sec.filename} (${sec.filetype.toUpperCase()}) | Section: ${sec.heading}]\n${sec.content}\n`
    )
    .join('\n---\n\n');
}
