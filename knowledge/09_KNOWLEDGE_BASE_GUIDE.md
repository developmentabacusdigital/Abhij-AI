# 09 — Knowledge Base Guide

How to manage the knowledge documents that Abhij-AI searches to answer questions.

---

## 🧠 What is the Knowledge Base?

The knowledge base is a collection of documents that the AI reads to answer user questions. Every chat response is **strictly grounded** in these documents — the AI cannot make up information that isn't in them.

Think of it like giving your AI a set of textbooks it must read from before answering any question.

---

## 📍 Where Documents Live

| Storage | Location | Priority |
|---------|----------|----------|
| **Primary (Neon DB)** | `knowledge_documents` table | Highest |
| **Local files** | `knowledge/` directory | Medium |
| **Temp uploads** | `os.tmpdir()/knowledge/` | Overrides local files |

> When Neon DB is configured, the app first checks the database. If the table is empty, it auto-seeds from local `knowledge/` directory files.

---

## 📄 Supported File Formats

| Extension | Processing | Images Supported |
|-----------|-----------|-----------------|
| `.md` | Direct markdown read + frontmatter parse | No (inline markdown images work) |
| `.markdown` | Same as `.md` | No |
| `.txt` | Read as plain text | No |
| `.docx` | Converted to Markdown via Mammoth.js | ✅ Yes |
| `.doc` | Text extraction via word-extractor | No |

---

## ✍️ Adding Documents via Admin Panel (Recommended)

1. Navigate to `http://localhost:3000/admin` (or your production URL + `/admin`)
2. Enter the admin passcode (default: `admin123`)
3. Use one of three methods:

### Method A: Upload a File
1. Click **"Upload File"** in the admin panel
2. Select a `.md`, `.txt`, `.docx`, or `.doc` file from your computer
3. Click Upload — the document is instantly indexed

### Method B: Create a Markdown Document
1. Click **"Create New Document"**
2. Enter a filename (e.g., `pricing-guide.md`)
3. Write or paste your markdown content in the text area
4. Click Save — the document is instantly indexed

### Method C: Drop files directly into `knowledge/` folder
1. Place files directly in the `knowledge/` directory
2. Restart the dev server (or redeploy in production)
3. The files are auto-discovered on next API call

---

## 📝 Writing Effective Markdown Knowledge Documents

Well-structured documents lead to better AI answers. Follow these guidelines:

### ✅ Good Structure

```markdown
---
title: Refund Policy
tags: [refund, billing, money-back]
---

# Refund Policy

## Overview
We offer a 30-day money-back guarantee on all plans.

## Eligibility
- Purchase must be within 30 days
- Account must be in good standing
- No more than 2 refunds per account per year

## How to Request a Refund
1. Email billing@company.com
2. Include your order number
3. Expect a response within 2-3 business days

## Non-Refundable Items
- Setup fees
- Custom domain registrations
- Promotional credits
```

### ❌ Bad Structure (avoid)

```markdown
Here is some information about refunds:

We have a refund policy. You can get a refund if you want. Send us an email.
The email is billing@company.com. Please email within 30 days.
```

### 📏 Best Practices

| Practice | Reason |
|----------|--------|
| Use `#`, `##`, `###` headers | Enables section-based retrieval; headers get 5x scoring weight |
| Add YAML frontmatter with `title:` | Provides a clean document title in the UI |
| Keep sections focused | Better relevance scoring — each section should be about one topic |
| Use keywords naturally | The search tokenizes your content; repeat key terms across headings |
| Add bullet lists for facts | Easier for the AI to extract and present |
| Avoid very long single sections | The chunker splits on headers; mix sections of 100-500 words |

---

## 🖼️ Including Images in Word Documents

If your `.docx` file contains screenshots, diagrams, or images:

1. Upload the `.docx` file via the admin panel
2. On first query, the system automatically:
   - Extracts all embedded images
   - Saves them to `public/knowledge-media/<DocName>/image_N.png`
   - Replaces image references with `/api/knowledge/media?doc=X&img=Y.png`
3. When the AI answers and references a figure, it copies the image link verbatim
4. The image renders inline in the chat response

> 💡 **Tip:** Label images descriptively in Word (right-click → Add Alt Text) — this helps the AI understand what figure to cite.

---

## 🗑️ Removing Documents

### Via Admin Panel
1. Go to `/admin`
2. Find the document in the document list
3. Click the **Delete** button (trash icon)
4. Confirm in the modal

### Via Filesystem (development)
```bash
rm knowledge/old-document.md
```
Then restart the dev server.

---

## 🔄 Syncing Local Files to Neon DB

When `DATABASE_URL` is configured, local files are automatically synced to Neon DB on the first query. But you can also manually trigger re-indexing via the admin panel:

1. Go to `/admin`
2. The **Database Engine** card shows current sync status
3. Click **"Re-index from Disk"** (if the button is available) or simply delete and re-upload documents

---

## 📊 Document Scoring Weights

When a user asks a question, each document section is scored:

| Scoring Factor | Points | Example |
|----------------|--------|---------|
| Exact query in **heading** | +15 | User asked "refund" and heading is "Refund Policy" |
| Exact query in **content** | +10 | Document contains the exact phrase |
| Token in **heading** | +5 per token | User asks "refund policy" → both tokens in heading |
| Token in **content** | +1.5 per occurrence (max 5) | More mentions = higher score |
| Token in **title** | +3 | Filename/title contains the keyword |
| Token in **filename** | +2 | `refund-policy.md` contains keyword |

> 📝 **Top 4 highest-scoring sections** are included in the context sent to the LLM.

---

## 📦 Document Metadata

Each document has metadata accessible in the admin panel:

| Metadata | Source |
|----------|--------|
| **Filename** | The uploaded file's name |
| **Title** | YAML frontmatter `title:` field, or first `# H1` heading, or filename |
| **Type** | File extension (md/docx/txt/doc) |
| **Size** | File size in KB |
| **Sections** | Number of `#`, `##`, `###` headed sections found |

---

## 🚀 Tips for Better AI Answers

1. **Name files descriptively:** `pricing-policy.md` is better than `doc1.md`
2. **One topic per file:** Separate `refund-policy.md` from `pricing-tiers.md`
3. **Include common question variations:** "How do I cancel?" and "Cancellation process" both as headings
4. **Keep documents up-to-date:** Outdated docs = outdated answers. Delete old files and re-upload updated ones
5. **Use the `### Sources` that the AI cites** — if it's citing the wrong file, rename headings to be more specific
