# 10 — Admin Panel Guide

Complete guide for using the Abhij-AI admin panel to manage the knowledge base.

---

## 🔑 Accessing the Admin Panel

1. Navigate to: `http://your-domain.com/admin`
2. You will see a **passcode gate** — a dark-themed input screen
3. Enter the admin passcode (default: `admin123`, change in `ADMIN_PASSWORD` env var)
4. The passcode is saved to `sessionStorage` — you won't need to re-enter it during the same browser session

---

## 🏠 Admin Panel Layout

The admin panel has the following sections:

```
┌──────────────────────────────────────────────────────────┐
│  🤖 Abhij-AI Admin Panel          [Back to Chat]         │
├──────────────────────────────────────────────────────────┤
│  📊 DATABASE ENGINE STATUS                               │
│  ┌─────────────────────────┐                             │
│  │  Engine: Neon PostgreSQL │                             │
│  │  Status: ● Connected     │                             │
│  │  Users: 42               │                             │
│  │  Sessions: 157           │                             │
│  │  Messages: 1,204         │                             │
│  │  Knowledge Docs: 8       │                             │
│  └─────────────────────────┘                             │
│                                                          │
│  📤 UPLOAD / CREATE                                      │
│  ┌──────────────────────┐  ┌────────────────────────┐   │
│  │   Upload File         │  │   Create New Document  │   │
│  │   (drag & drop)       │  │   (markdown editor)    │   │
│  └──────────────────────┘  └────────────────────────┘   │
│                                                          │
│  📚 KNOWLEDGE BASE DOCUMENTS (8 documents)              │
│  ┌──────────────────────────────────────────────────┐   │
│  │  my-doc.md    [MD]   12 KB    5 sections  [🗑️]   │   │
│  │  guide.docx   [DOCX] 2.1 MB  15 sections  [🗑️]  │   │
│  │  notes.txt    [TXT]  3 KB     2 sections   [🗑️]  │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 📊 Database Engine Status Card

This card shows the current persistence engine and real-time statistics.

| Field | Meaning |
|-------|---------|
| **Engine** | `Neon PostgreSQL` (cloud) or `Browser localStorage` (local) |
| **Status** | Connected ✅ or Disconnected ❌ |
| **Users** | Total registered user accounts |
| **Sessions** | Total chat sessions across all users |
| **Messages** | Total individual messages stored |
| **Knowledge Docs** | Documents currently in the knowledge base |

> 💡 If it shows "Browser localStorage", add your `DATABASE_URL` in environment variables for cloud persistence.

---

## 📤 Uploading Files

### Supported Formats
- `.md` — Markdown documents (best for structured content)
- `.txt` — Plain text files
- `.docx` — Word documents (images are extracted automatically)
- `.doc` — Legacy Word documents (text only, no images)

### Steps
1. Click the **"Upload File"** card in the admin panel
2. The file picker dialog opens
3. Select your file
4. The file is uploaded immediately
5. A success notification appears
6. The document appears in the document list below

### What happens after upload?
- For `.md` and `.txt`: File is saved and immediately indexed
- For `.docx`: File is saved; images are extracted on the first query that references it
- If Neon DB is configured: The document is also written to the `knowledge_documents` table

---

## 📝 Creating a New Markdown Document

1. Click the **"Create New Document"** card
2. An inline editor panel appears with two fields:
   - **Filename:** (e.g., `pricing-policy.md`)
   - **Content:** A large text area for markdown content
3. Write your markdown content using proper `#` `##` `###` headings
4. Click **Save**
5. The document is immediately added to the knowledge base

### Markdown Tips for Knowledge Docs
```markdown
---
title: My Document Title
---

# Main Topic

## Subtopic One
Content for subtopic one...

## Subtopic Two
Content for subtopic two...

### Deep Subtopic
More specific information...
```

---

## 📚 Document List

The document list shows all indexed knowledge documents.

### Columns
| Column | Description |
|--------|-------------|
| **Filename** | The file's name (e.g., `my-doc.md`) |
| **Type Badge** | Colored badge: `MD`, `DOCX`, `TXT`, `DOC` |
| **Size** | File size in KB or MB |
| **Sections** | Number of headed sections (affects search granularity) |
| **Delete** | Trash icon button — triggers confirmation modal |

### Document Clicking (View/Preview)
- Clicking on a document name opens a **preview modal**
- Shows the document title, type, size, and full markdown content
- For `.docx` with images, the extracted images are shown inline

---

## 🗑️ Deleting a Document

1. Find the document in the list
2. Click the **trash icon (🗑️)** on the right side of the row
3. A **confirmation modal** appears asking: "Are you sure you want to delete `filename`?"
4. Click **"Delete"** to confirm, or **"Cancel"** to abort
5. The document is removed from:
   - The local `knowledge/` directory
   - The Neon DB `knowledge_documents` table (if configured)

> ⚠️ **Deletion is permanent.** Ensure you have a backup before deleting important documents.

---

## 🔄 Managing Knowledge Documents Remotely (in Production)

Since you cannot SSH into Vercel's serverless environment, all production knowledge base management must go through the admin panel UI.

**Recommended workflow for updating production knowledge:**
1. Prepare your updated `.md` or `.docx` file locally
2. Go to your production URL's `/admin` page
3. Delete the old version of the document if it exists
4. Upload the new version
5. Test a query in the main chat to verify the new content is returning correct answers

---

## 🔐 Security Best Practices

1. **Change the default passcode:** Set `ADMIN_PASSWORD` to something strong in production
2. **Don't share the admin URL publicly:** The `/admin` path is not linked from the main UI
3. **Session expires on browser close:** `sessionStorage` is cleared automatically, requiring re-authentication
4. **All admin API calls verify the key server-side:** Even if someone guesses the URL, they can't act without the passcode
5. **Review documents before uploading:** The app serves everything in the knowledge base as context — don't upload confidential information you don't want the AI to share

---

## 🔗 Quick Links

| Action | URL |
|--------|-----|
| Admin Panel | `/admin` |
| Main Chat | `/` |
| DB Status API | `GET /api/admin/db-status` (with admin key) |
| Knowledge API | `GET /api/knowledge` (with admin key) |
