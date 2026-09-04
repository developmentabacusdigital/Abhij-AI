# 05 — How It Works: Technical Deep Dive

This document walks through every core system in Abhij-AI — from how the knowledge base is parsed, to how the AI generates streamed responses, to how chat history is saved.

---

## 1. 📥 Document Parsing & Ingestion

When the app needs to search the knowledge base (which happens on every chat request), it reads and parses all documents in the `knowledge/` directory. Here is what happens for each supported file type:

### `.md` and `.txt` files

```
1. Read raw file content with fs.readFileSync()
2. Pass through gray-matter to extract YAML frontmatter (metadata like title, tags)
3. Return: { title: frontmatter.title || filename, content: rawContent }
```

### `.docx` files (Word Documents)

```
1. Read binary buffer with fs.readFileSync()
2. Invoke mammoth.convertToMarkdown({ buffer })
   ├─ Converts DOCX headings → # ## ### Markdown headers
   ├─ Converts bold/italic → **bold** *italic*
   ├─ Converts lists → - bullet points
   └─ Extracts embedded images as base64 data URIs
3. Image post-processing (extractDocxImages):
   ├─ Regex matches all data URI images in the markdown
   ├─ Each image is decoded from base64
   ├─ Saved as image_1.png, image_2.png, etc. to public/knowledge-media/<DocName>/
   └─ Image references in markdown replaced with /api/knowledge/media?doc=X&img=Y.png
4. Return: { title: first H1 heading || filename, content: markdown, filetype: 'docx' }
```

### `.doc` files (Legacy Word 97-2003)

```
1. Use word-extractor npm package to extract raw text
2. Return as plain text content (no rich formatting or images)
```

---

## 2. 🔪 Document Chunking

After parsing, documents are broken into **sections** for more precise retrieval. The `getAllDocumentSections()` function in `knowledge.ts` does this:

```
For each document:
  Split content by newlines
  Walk each line:
    ├─ Line matches /^(#{1,3})\s+(.+)$/? → It's a heading
    │     Save accumulated lines as a section
    │     Start a new section with this heading
    └─ Otherwise: Accumulate line into current section
  
  A section is saved only if content > 20 characters (avoids empty sections)
  
Result: An array of DocumentSection objects:
  {
    id: "filename.md-sec-0",
    filename: "filename.md",
    filetype: "md",
    title: "Document Title",
    heading: "Section Heading",
    content: "Section text content..."
  }
```

---

## 3. 🔍 Relevance Scoring & Retrieval

`searchRelevantKnowledge(query, maxResults=4)` is the core RAG retrieval function:

### Step 1: Greeting Detection
If the query is a greeting ("hi", "hello", "how are you", etc.), skip search entirely. Return `isGreeting: true` to use the greeting system prompt instead.

### Step 2: Tokenization
```
query → lowercase → strip punctuation → split by whitespace → filter:
  - Words shorter than 3 characters removed
  - Common stopwords removed (the, is, at, which, on, a, an, and, or...)
Result: ["key", "words", "only"]
```

### Step 3: TF-based Scoring (per section)
```
For each DocumentSection:
  score = 0
  
  // Exact phrase bonus
  if section.content includes query exactly: score += 10
  if section.heading includes query exactly: score += 15
  
  // Token frequency
  for each token in queryTokens:
    contentMatches = count occurrences of token in content (max 5)
    score += contentMatches × 1.5
    if heading includes token: score += 5
    if title includes token: score += 3
    if filename includes token: score += 2
```

### Step 4: Ranking & Slicing
```
Filter: sections with score > 0
Sort: descending by score
Slice: top 4 sections
Return: { sections, usedFilenames, contextString, isGreeting: false }
```

---

## 4. 🤖 System Prompt Construction

The `createGroundingSystemPrompt()` function builds the LLM system prompt:

**For greetings:**
> "You are Abhij-AI, a brilliant warm AI assistant... (instructions for greeting responses)"

**For knowledge-base queries:**
```
"You are Abhij-AI, a brilliant, warm, articulate AI assistant..."

KNOWLEDGE BASE EXCERPTS:
[Document: filename.md (MD) | Section: Heading Name]
Content of section 1...

---

[Document: report.docx (DOCX) | Section: Chapter Title]
Content of section 2...

AVAILABLE SOURCES:
- filename.md
- report.docx

STRICT GUIDELINES:
1. Humanized Explanations...
2. Subtle Humor (every 4-5 turns)...
3. Grounding: facts must be from excerpts only...
4. Unanswered Queries: say 'I couldn't find this in the KB'...
5. Citations: list source files under ### Sources...
6. Diagrams & Images: copy exact markdown image links verbatim...
7. Suggested Questions: predict 2-3 follow-up questions..."
```

---

## 5. 📡 LLM Streaming

`streamOpenRouterChat()` sends the payload to OpenRouter and returns the raw streaming `Response`:

```typescript
// API payload sent to OpenRouter:
{
  model: "google/gemma-3-12b-it",      // from OPENROUTER_MODEL env var
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: "first user message" },
    { role: "assistant", content: "first AI response" },
    ...
    { role: "user", content: "current message" }
  ],
  temperature: 0.2,                     // from LLM_TEMPERATURE env var
  top_p: 0.9,
  stream: true                          // SSE streaming enabled
}

// Headers sent to OpenRouter:
{
  Authorization: "Bearer <OPENROUTER_API_KEY>",
  HTTP-Referer: "<NEXT_PUBLIC_SITE_URL>",
  X-Title: "<NEXT_PUBLIC_SITE_NAME>"
}
```

The raw `Response` from OpenRouter is piped directly back to the client via Next.js route `return response`.

**Demo Mode (no API key):** `createSimulatedStream()` creates a fake SSE stream from the retrieved knowledge context and sends it with a 25ms token delay to simulate realistic streaming.

---

## 6. 🌊 Client-Side Stream Reading

In `src/app/page.tsx`, the chat submit handler reads the SSE stream:

```typescript
const response = await fetch('/api/chat', { method: 'POST', body: JSON.stringify(...) });

// Extract cited sources from response headers
const sourcesHeader = response.headers.get('X-Sources');
const sources = sourcesHeader ? JSON.parse(sourcesHeader) : [];

// Read stream token by token
const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const text = decoder.decode(value);
  const lines = text.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') break;
      
      const parsed = JSON.parse(data);
      const token = parsed.choices[0].delta.content || '';
      
      // Append token to displayed message
      currentMessage += token;
      updateMessageInState(currentMessage);
    }
  }
}
```

---

## 7. 🗃️ Persistence: Neon DB vs Local Storage

### Cloud Sync (Neon DB configured)
```
Login → POST /api/auth/login → Neon users table
           └─ Success → GET /api/chats?userId=X
                         └─ Returns cloud sessions
                              └─ Merged into sidebar

New message → Save locally first (optimistic UI)
           → POST /api/chats to persist session to Neon
           → PATCH /api/chats/[id] to add messages
```

### Local Mode (no DATABASE_URL)
```
Login → Checks localStorage['abhij_users_db']
           └─ Success → Reads localStorage['abhij_chat_sessions_<username>']
                          └─ All sessions loaded from browser localStorage

New message → Saved only to localStorage
```

---

## 8. 🔒 Authentication: Password Hashing

```typescript
// In src/lib/auth.ts
function hashPassword(password: string): string {
  return crypto
    .createHash('sha256')
    .update(password + '_abhij_salt')   // Salt prevents rainbow table attacks
    .digest('hex');
}

// Registration:
const hash = hashPassword(password);
// Stored in Neon: INSERT INTO users (username, password_hash) VALUES ($1, $2)

// Login:
const hash = hashPassword(enteredPassword);
// Compared with: SELECT * FROM users WHERE username=$1 AND password_hash=$2
```

---

## 9. 🖼️ DOCX Image Serving

When a `.docx` document contains images, they are extracted on first document load:

```
1. mammoth converts DOCX → Markdown with base64 data URIs for images
2. extractDocxImages() finds all data URIs via regex
3. Each image is saved to: public/knowledge-media/<DocStem>/<image_N>.ext
4. Markdown is updated: ![alt](data:image/...) → ![alt](/api/knowledge/media?doc=X&img=Y)

GET /api/knowledge/media?doc=MyDoc&img=image_1.png
└─ Route reads: public/knowledge-media/MyDoc/image_1.png
└─ Returns raw file with correct Content-Type header
```

---

## 10. 📱 Mobile Responsiveness

Responsive design is implemented entirely in `globals.css` using CSS media queries:

```css
/* Breakpoints used */
@media (max-width: 768px) { /* Tablet/mobile */ }
@media (max-width: 480px) { /* Small phones */ }

/* Key mobile adaptations */
- Sidebar: fixed overlay instead of inline panel, hidden by default
- Hamburger menu button: visible on mobile only
- Chat input: larger touch target, full-width
- Suggestion chips: smaller font size, more compact padding
- Avatar video: smaller size on phones
- Message bubbles: full-width on small screens
```
