# 04 — File & Directory Structure

Every file and directory in the Abhij-AI project, explained.

---

## 📁 Root Directory

```
ABHIJ-Ai/
├── .env.example          # Template for environment variables (copy to .env.local)
├── .env.local            # Your actual environment variables (never commit this!)
├── .gitignore            # Files excluded from version control
├── Abhij-AI.png          # App logo / favicon (retro pixel art)
├── SOCIAL.png            # Social media preview image (OG image for link sharing)
├── LICENSE               # MIT License
├── README.md             # Public-facing documentation on GitHub
├── next.config.mjs       # Next.js configuration (file tracing for knowledge/ dir)
├── package.json          # Project dependencies and scripts
├── tsconfig.json         # TypeScript compiler configuration
├── knowledge/            # 📚 Knowledge base documents (the RAG data store)
├── public/               # 🌐 Static files served directly at /
├── src/                  # 💻 All application source code
├── scripts/              # 🛠️ Utility scripts
└── Videos/               # 🎬 Avatar video files
```

---

## 📚 `knowledge/` — The Knowledge Base

```
knowledge/
├── 00_README.md                      # This documentation index
├── 01_PROJECT_OVERVIEW.md            # Project overview
├── 02_TECH_STACK.md                  # Technology stack details
├── 03_ARCHITECTURE.md                # System architecture
├── 04_FILE_STRUCTURE.md              # (This file)
├── 05_HOW_IT_WORKS.md                # Technical explanation
├── 06_ENVIRONMENT_SETUP.md           # Local setup guide
├── 07_ENVIRONMENT_VARIABLES.md       # Environment variables
├── 08_API_REFERENCE.md               # API endpoint reference
├── 09_KNOWLEDGE_BASE_GUIDE.md        # Managing knowledge documents
├── 10_ADMIN_PANEL_GUIDE.md           # Admin panel usage
├── 11_DATABASE_GUIDE.md              # Neon DB setup
├── 12_DEPLOYMENT_GUIDE.md            # Vercel deployment guide
├── 13_USER_GUIDE.md                  # End-user guide
├── 14_MAKING_CHANGES.md              # Developer guide
├── 15_TROUBLESHOOTING.md             # Troubleshooting
├── images/                           # Any embedded images for docs
└── Abacus Framer Site Document.docx  # (Example: client-specific knowledge file)
```

> 💡 **Add your own `.md`, `.txt`, or `.docx` files here** and they become instantly searchable in the chat.

---

## 🌐 `public/` — Static Assets

```
public/
├── Abhij-AI.png            # Favicon & admin panel logo
├── SOCIAL.png              # OpenGraph social preview image
├── videos/
│   ├── Idle.mp4            # Avatar: idle state video loop
│   ├── Thinking.mp4        # Avatar: thinking state video loop
│   └── Answering.mp4       # Avatar: answering state video loop
└── knowledge-media/        # Auto-created: extracted images from .docx files
    └── <DocName>/
        ├── image_1.png
        ├── image_2.jpg
        └── ...
```

---

## 💻 `src/` — Application Source Code

### `src/app/` — Next.js App Router Pages & Routes

```
src/app/
├── layout.tsx              # Root HTML layout, fonts, SEO metadata
├── page.tsx                # Main chat interface (the entire UI ~1300 lines)
├── globals.css             # Complete design system & all styles (~52KB)
├── opengraph-image.png     # OG image (symlinked to SOCIAL.png)
├── twitter-image.png       # Twitter card image (symlinked to SOCIAL.png)
│
├── admin/
│   └── page.tsx            # Admin panel page (~880 lines, full CRUD for knowledge)
│
└── api/
    ├── chat/
    │   └── route.ts        # POST: main chat endpoint (RAG + LLM streaming)
    │
    ├── auth/
    │   ├── register/
    │   │   └── route.ts    # POST: user registration (Neon DB + local fallback)
    │   └── login/
    │       └── route.ts    # POST: user login (Neon DB + local fallback)
    │
    ├── chats/
    │   ├── route.ts        # GET: fetch sessions, POST: save session
    │   └── [id]/
    │       └── route.ts    # GET/PATCH/DELETE: individual session operations
    │
    ├── knowledge/
    │   ├── route.ts        # GET: list docs, POST: upload/create, DELETE: remove
    │   ├── auth/
    │   │   └── route.ts    # POST: verify admin passcode
    │   └── media/
    │       └── route.ts    # GET: serve extracted .docx images
    │
    └── admin/
        └── db-status/
            └── route.ts    # GET: Neon DB connection health + row counts
```

### `src/lib/` — Core Business Logic

```
src/lib/
├── auth.ts                 # User auth: register/login with Neon DB + localStorage fallback
├── admin-auth.ts           # Admin passcode verification helper
├── chat-store.ts           # Chat sessions: CRUD + Neon DB cloud sync + localStorage cache
├── db.ts                   # Neon DB client, connection, auto schema initialization
├── knowledge.ts            # Knowledge engine: parsing, chunking, scoring, RAG search
└── openrouter.ts           # OpenRouter API client + streaming + demo fallback mode
```

### `src/types/` — Shared TypeScript Types

```
src/types/
└── (any shared interfaces and types)
```

---

## 🎬 `Videos/` — Avatar Videos

```
Videos/
├── Idle.mp4         # Looping idle animation (no conversation active)
├── Thinking.mp4     # Looping thinking animation (AI processing)
└── Answering.mp4    # Looping speaking animation (AI streaming response)
```

> ⚠️ **Note:** The video files in `Videos/` need to be copied to `public/videos/` for the web app to serve them. They are served at `/videos/Idle.mp4`, etc.

---

## 🛠️ `scripts/` — Utility Scripts

```
scripts/
└── generate_diagram.py     # Python script for generating architecture diagrams
```

---

## 📋 Key Configuration Files

### `next.config.mjs`
```js
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/**/*': ['./knowledge/**/*', './knowledge/*'],
    },
  },
};
```
> The `outputFileTracingIncludes` ensures that all files in the `knowledge/` directory are bundled with Vercel serverless functions so the RAG engine can access them.

### `tsconfig.json`
- Targets `ES2017`
- Path alias: `@/*` → `./src/*` (enables `import { x } from '@/lib/y'`)
- JSX: `preserve` (Next.js handles JSX transform)
- Strict mode enabled

### `.gitignore`
Key exclusions:
- `.env.local` (never commit API keys!)
- `.next/` (build output)
- `node_modules/`
- `tsconfig.tsbuildinfo` (TypeScript incremental build cache)

---

## 📊 File Size Overview

| File | Size | Description |
|------|------|-------------|
| `src/app/globals.css` | ~52 KB | Complete CSS design system |
| `src/app/page.tsx` | ~48 KB | Main chat UI (1271 lines) |
| `src/app/admin/page.tsx` | ~30 KB | Admin panel (880 lines) |
| `src/lib/knowledge.ts` | ~21 KB | RAG engine (652 lines) |
| `src/lib/openrouter.ts` | ~9 KB | LLM client |
| `src/lib/chat-store.ts` | ~7 KB | Chat persistence |
| `src/lib/auth.ts` | ~5 KB | Authentication |
| `src/lib/db.ts` | ~3 KB | Database client |
| `src/lib/admin-auth.ts` | ~0.5 KB | Admin passcode helper |
