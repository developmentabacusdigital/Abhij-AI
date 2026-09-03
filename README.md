<div align="center">

# ⬛ ABHIJ-AI ⬜

### Document-Grounded Knowledge Assistant with OpenRouter Gemma

[![Next.js 14](https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-black?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![OpenRouter](https://img.shields.io/badge/OpenRouter-Gemma-black?style=for-the-badge)](https://openrouter.ai/)
[![Deploy on Vercel](https://img.shields.io/badge/Vercel-Deploy-black?style=for-the-badge&logo=vercel)](https://vercel.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-black?style=for-the-badge)](LICENSE)

<p align="center">
  A high-precision, document-grounded AI chatbot engineered to strictly answer user queries based on local Markdown and Word documents. Built with a curated <strong>Black & White monochrome aesthetic</strong>, Google's <strong>Poppins</strong> typography, retro <strong>Press Start 2P</strong> pixel branding, interactive follow-up question chips, embedded image support with a full-screen lightbox modal, and a passcode-protected <strong>Admin Panel</strong>.
</p>

[Quick Start](#-quick-start) • [Features](#-features) • [Admin Panel](#-knowledge-base-admin-panel) • [Architecture](#-architecture) • [Environment Variables](#-environment-variables) • [Vercel Deployment](#-deploying-to-vercel)

</div>

---

## ⚡ Features

### 🧠 Strict Document Grounding (No Hallucinations)
- Configured with a moderate-low LLM temperature (`0.2`) to force the model to stick strictly to the facts present in your documentation.
- If a query cannot be answered using the provided files, Abhij-AI explicitly states it does not know rather than fabricating facts.
- Powered by OpenRouter using Google's state-of-the-art **Gemma 3 12B IT** / **Gemma 2 9B IT** models.

### 📚 Multi-Format Knowledge Base
- Natively reads and parses:
  - **Markdown**: `.md`, `.markdown`
  - **Microsoft Word**: `.docx` (via `mammoth`), `.doc` (via `word-extractor`)
  - **Plain Text**: `.txt`
- Automatic section boundary splitting using header hierarchy (`#`, `##`, `###`) and tokenized relevance scoring with English stopword removal and header-boost weighting.

### 🖼️ Document Image & Diagram Support
- **Embedded Word Images**: Automatically extracts images embedded inside `.docx` files during ingestion and serves them cleanly without inflating LLM prompt token limits.
- **Markdown Diagram Rendering**: Supports images inside `.md` files (e.g. `![Architecture](images/diagram.png)`), automatically rewriting relative paths to the secure media API.
- **Interactive Lightbox Modal**: Click any image or diagram in chat answers or in the Document Viewer to open a high-resolution, full-screen lightbox modal with hover zoom cues and captions.

### 💡 Contextual Follow-up Question Suggestions
- Concludes answers with 2–3 predictive follow-up questions tailored to the user's intent and grounded in the available documents.
- Renders suggestions as interactive, clickable chip buttons that automatically populate and submit the query with one tap.

### 🛡️ Knowledge Base Admin Panel (`/admin`)
- Dedicated administration interface protected by a secure passcode (`ADMIN_PASSWORD`).
- **File Upload & Drag-and-Drop**: Upload `.md`, `.docx`, `.doc`, and `.txt` files directly into the knowledge base.
- **In-Browser Markdown Editor**: Write, edit, and preview new markdown documents side-by-side.
- **Document Management**: Inspect metadata (type badges, section counts, file size), read document content, and delete files with instant retrieval engine synchronization (zero server restarts required).

### 🎨 Minimalist Monochrome Aesthetics
- Curated high-contrast **Black & White** palette (`#000000` deep black, `#0d0d0d` ink, `#141414` charcoal surfaces, and `#ffffff` crisp text).
- Sleek light and dark mode toggle with persistent local theme storage.
- Typography powered by Google Font **Poppins** for clean readability and retro 8-bit **Press Start 2P** for the logo.

### 📱 Full Mobile & Desktop Responsiveness
- Desktop: Collapsible knowledge documents sidebar with quick-preview modal.
- Mobile: Touch-friendly slide-out drawer, auto-resizing textareas, and iOS/Android safe-area inset support.

### 🚀 1-Click Vercel Deployment
- Next.js 14 App Router serverless architecture keeps your `OPENROUTER_API_KEY` hidden from the client browser.
- Configured with `outputFileTracingIncludes` in `next.config.mjs` so the `knowledge/` directory is automatically bundled into serverless functions.
- Automatic temporary directory fallback for read-only serverless filesystems.

---

## 📐 Architecture

```
                                  ┌────────────────────────────────┐
                                  │   User (Desktop / Mobile)      │
                                  └───────────────┬────────────────┘
                                                  │ POST /api/chat (SSE Stream)
                                                  ▼
                                  ┌────────────────────────────────┐
                                  │     Next.js App Router         │
                                  │  Abhij-AI RAG Pipeline Engine  │
                                  └───────┬───────────────┬────────┘
                                          │               │
                     1. Relevance Scoring │               │ 3. Strict Grounding
                                          ▼               ▼
┌───────────────────────────────────────────────┐   ┌───────────────────────────────┐
│              Knowledge Directory              │   │       OpenRouter API          │
│ • Markdown (.md, .markdown)                   │   │ • google/gemma-3-12b-it       │
│ • Word Documents (.docx, .doc)                │   │ • Temperature: 0.2            │
│ • Plain Text (.txt)                           │   │ • SSE Stream Delivery         │
│ • Extracted Diagrams & Figures                │   └───────────────┬───────────────┘
└───────────────────────────────────────────────┘                   │
                                          ▲                         │ 4. Grounded Output +
                                          │                         │    Citations + Chips
                                  ┌───────┴───────────────┐         │
                                  │   Admin Panel /admin  │         ▼
                                  │  Upload, Edit, Delete │   ┌─────────────────────────────┐
                                  │  Protected by Passcode│   │ Interactive Client UI       │
                                  └───────────────────────┘   │ • Markdown formatting       │
                                                              │ • Clickable Follow-up Chips │
                                                              │ • Zoomable Image Lightbox   │
                                                              │ • Source Document Modal     │
                                                              └─────────────────────────────┘
```

---

## 📁 Directory Structure

```plaintext
ABHIJ-Ai/
├── knowledge/                     # Your local knowledge base documents
│   ├── company_overview.md        # Starter documentation
│   ├── product_guide.md           # Product specifications & guide
│   ├── faq_and_policies.md        # Frequently asked questions & policies
│   ├── HOW-IT-WORKS.md            # In-depth technical specification
│   ├── system_architecture.doc    # Word document with embedded diagrams
│   └── images/                    # Local diagrams and visual assets
├── public/
│   └── knowledge-media/           # Auto-extracted images from .docx files
├── src/
│   ├── app/
│   │   ├── admin/
│   │   │   └── page.tsx           # Knowledge Base Admin Panel page
│   │   ├── api/
│   │   │   ├── chat/
│   │   │   │   └── route.ts       # SSE streaming chat API with RAG retrieval
│   │   │   ├── knowledge/
│   │   │   │   ├── route.ts       # Document listing, upload (POST), and delete (DELETE)
│   │   │   │   └── media/
│   │   │   │       └── route.ts   # Secure static & extracted media streamer
│   │   ├── globals.css            # Black & White design tokens, typography, animations
│   │   ├── layout.tsx             # Root layout with Poppins & Press Start 2P fonts
│   │   └── page.tsx               # Main chat interface with follow-up chips & lightbox
│   ├── lib/
│   │   ├── knowledge.ts           # Document ingestion, relevance scoring & chunking
│   │   └── openrouter.ts          # OpenRouter streaming client & system prompts
│   └── types/
│       └── modules.d.ts           # Type definitions for mammoth & word-extractor
├── .env.example                   # Environment variable template
├── .env.local                     # Local secrets (API key & admin passcode)
├── next.config.mjs                # Next.js config with serverless bundle tracing
├── package.json                   # Dependencies & build scripts
└── tsconfig.json                  # TypeScript compiler settings
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18.17+ or Node.js 20+
- npm, pnpm, or yarn
- An [OpenRouter API Key](https://openrouter.ai/keys) *(Free/low-cost)*

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/<your-username>/abhij-ai.git
cd abhij-ai
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Open `.env.local` and add your settings:
```env
# OpenRouter API Key
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Gemma Model (Default: google/gemma-3-12b-it or google/gemma-2-9b-it)
OPENROUTER_MODEL=google/gemma-3-12b-it

# Strict Temperature Setting
LLM_TEMPERATURE=0.2

# Admin Panel Passcode
ADMIN_PASSWORD=admin123
```

> **Offline Demo Mode**: If `OPENROUTER_API_KEY` is left blank, Abhij-AI will still run in interactive local demo mode, serving responses directly from the knowledge base.

### 3. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔐 Knowledge Base Admin Panel

Abhij-AI comes with a built-in admin dashboard accessible at:
```
http://localhost:3000/admin
```
*(Or click the **Admin** button in the chat header or sidebar footer)*.

### Capabilities:
- **Passcode Gate**: Enter your `ADMIN_PASSWORD` (default: `admin123`). The session persists securely in your browser's session storage.
- **Document Management**: View all indexed `.md`, `.markdown`, `.docx`, `.doc`, and `.txt` files with file size, section counts, and type badges.
- **Upload Files**: Drag-and-drop or browse files from your computer. Word documents are automatically parsed and embedded images are extracted.
- **In-Browser Markdown Editor**: Write new `.md` files or edit existing markdown documents with real-time live preview.
- **Safe Deletion**: Remove documents with confirmation modals and instant knowledge index synchronization.

---

## ⚙️ Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** (for live LLM) | `""` | Your OpenRouter API key (`sk-or-v1-...`). |
| `OPENROUTER_MODEL` | No | `google/gemma-3-12b-it` | OpenRouter model identifier. Supports any Gemma or OpenRouter model. |
| `LLM_TEMPERATURE` | No | `0.2` | Temperature controlling creativity vs grounding. `0.2` is ideal for factual adherence. |
| `ADMIN_PASSWORD` | No | `admin123` | Secret passcode to unlock the `/admin` dashboard. |
| `NEXT_PUBLIC_SITE_NAME` | No | `Abhij-AI` | Branding title used across headers and prompts. |
| `NEXT_PUBLIC_SITE_URL` | No | `http://localhost:3000` | Site URL for OpenRouter ranking headers. |

---

## 🌐 API Reference

### `POST /api/chat`
Streams assistant answers using Server-Sent Events (SSE).
- **Request Body**:
  ```json
  {
    "messages": [
      { "role": "user", "content": "How does the system architecture work?" }
    ]
  }
  ```
- **Response**: `text/event-stream` stream containing incremental delta tokens and an `X-Sources` header listing cited documents.

### `GET /api/knowledge`
Returns all indexed knowledge documents.
- **Response**:
  ```json
  {
    "documents": [
      {
        "filename": "company_overview.md",
        "filetype": "md",
        "title": "Company Overview",
        "size": 3420,
        "sectionsCount": 4,
        "content": "..."
      }
    ],
    "totalDocs": 4
  }
  ```

### `POST /api/knowledge` *(Admin Protected)*
Uploads a document via `multipart/form-data` or creates/edits a document via JSON.
- **Header Required**: `x-admin-key: <ADMIN_PASSWORD>`
- **Form Data**: `file`: File object (`.md`, `.docx`, `.doc`, `.txt`)
- **JSON Payload**:
  ```json
  {
    "filename": "custom_guide.md",
    "content": "# Custom Guide\n\nContent here..."
  }
  ```

### `DELETE /api/knowledge?file=<filename>` *(Admin Protected)*
Deletes a document and its associated media files.
- **Header Required**: `x-admin-key: <ADMIN_PASSWORD>`

### `GET /api/knowledge/media?file=<path>`
Streams static images or extracted Word figures with caching headers.

---

## ☁️ Deploying to Vercel

### Method 1: Deploy via GitHub (Recommended)

1. Push your code to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Abhij-AI"
   git branch -M main
   git remote add origin https://github.com/<your-username>/abhij-ai.git
   git push -u origin main
   ```
2. Navigate to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import your `abhij-ai` repository.
4. Expand **Environment Variables** and add:
   - `OPENROUTER_API_KEY`: Your key (`sk-or-v1-...`)
   - `OPENROUTER_MODEL`: `google/gemma-3-12b-it`
   - `LLM_TEMPERATURE`: `0.2`
   - `ADMIN_PASSWORD`: Your secret admin password
5. Click **Deploy**. Vercel will build and assign your production URL in ~45 seconds.

### Method 2: Deploy via Vercel CLI
```bash
# Install Vercel CLI & log in
npx vercel

# Set your production environment variables
npx vercel env add OPENROUTER_API_KEY
npx vercel env add ADMIN_PASSWORD

# Deploy to production
npx vercel --prod
```

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router, Server Components & Serverless Routes)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Design System**: Vanilla CSS with custom design tokens (Zero bulky CSS framework dependencies)
- **Typography**: [Google Fonts](https://fonts.google.com/) (Poppins & Press Start 2P)
- **Document Extractors**: [mammoth](https://www.npmjs.com/package/mammoth) (DOCX), [word-extractor](https://www.npmjs.com/package/word-extractor) (DOC), [gray-matter](https://www.npmjs.com/package/gray-matter) (Frontmatter)
- **Markdown & Syntax**: [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm)
- **Icons**: [Lucide React](https://lucide.dev/)
- **LLM Gateway**: [OpenRouter API](https://openrouter.ai/) (Google Gemma)

---

## 📄 License

This project is open-source and licensed under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with 🖤 by Abhijay Dutta • Powered by Google Gemma & Next.js</sub>
</div>
