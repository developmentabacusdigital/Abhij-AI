# 02 — Technology Stack

A complete breakdown of every technology used in Abhij-AI, why it was chosen, and how it is used.

---

## 🏛️ Core Framework

### Next.js 14 (App Router)
- **Version:** `^14.2.35`
- **Why:** Next.js App Router provides first-class server components, API routes, SSR, and seamless Vercel deployment integration. The App Router's `route.ts` files make building API endpoints extremely clean and co-located with the feature.
- **Used for:** The entire application — pages, API routes, layouts, and metadata.

### React 18
- **Version:** `^18.3.1`
- **Why:** The current React version; required by Next.js 14. Enables concurrent features and Suspense.
- **Used for:** All UI components and interactive state management.

### TypeScript
- **Version:** `^5.7.3`
- **Why:** Type safety across the entire codebase. Catches bugs at compile time, improves IDE intellisense significantly, and makes the codebase much more maintainable for handovers.
- **Used for:** Every `.ts` and `.tsx` file in the project.

---

## 🤖 AI & Language Model

### OpenRouter.ai
- **Endpoint:** `https://openrouter.ai/api/v1/chat/completions`
- **Why:** OpenRouter is a unified gateway to hundreds of LLMs (Gemma, GPT-4, Claude, Mistral, etc.) under a single API key. It avoids vendor lock-in and lets you swap models with a single environment variable change.
- **Used for:** Streaming chat completions powering all AI responses.

### Default Model: `google/gemma-3-12b-it`
- **Why:** Gemma 3 12B Instruct is a high-quality, instruction-following model from Google DeepMind. It is cost-efficient, fast, well-grounded in document context, and handles long system prompts effectively.
- **Configurable via:** `OPENROUTER_MODEL` environment variable — can be changed to any OpenRouter-supported model without code changes.

### LLM Temperature: `0.2`
- **Why:** A low temperature (0.2 out of 1.0) keeps responses factual and closely grounded in the provided document context. Higher values would make the model more creative but less reliably factual.
- **Configurable via:** `LLM_TEMPERATURE` environment variable.

---

## 🗄️ Database

### Neon Serverless PostgreSQL
- **Package:** `@neondatabase/serverless@^1.1.0`
- **Why:** Neon is a serverless Postgres provider that works natively in Next.js API routes without persistent connections. It handles connection pooling automatically, making it perfect for serverless deployments (Vercel). The free tier is more than sufficient for this application.
- **Used for:** User accounts, chat session history, chat messages, and knowledge base document storage.

### localStorage (Fallback)
- **Why:** When `DATABASE_URL` is not set, all user data, chat history, and sessions are stored client-side in browser localStorage. This ensures the app works perfectly in demo/development mode with zero external dependencies.
- **Used for:** Dev-mode persistence, offline capability, demo mode without Neon.

---

## 💅 Frontend & Styling

### Vanilla CSS
- **File:** `src/app/globals.css` (≈52 KB)
- **Why:** Maximum control and no runtime overhead. The design system uses CSS custom properties (variables) for the color palette, typography, and spacing tokens. No Tailwind or CSS-in-JS dependency overhead.
- **Features:** Dark mode by default, glassmorphism effects, smooth gradient animations, micro-animations, and responsive breakpoints.

### Google Fonts
- **Fonts loaded:**
  - `Poppins` (300, 400, 500, 600, 700 weights) — Main body font
  - `Press Start 2P` — Retro pixel font used in the welcome screen heading
- **How loaded:** Via `next/font/google` in `src/app/layout.tsx` for zero layout-shift font loading.

---

## 📄 Document Processing

### mammoth.js
- **Version:** `^1.12.2`
- **Why:** Converts `.docx` Word documents to Markdown with image extraction support. It handles complex DOCX formatting, lists, headings, tables, and embedded images.
- **Used for:** Parsing `.docx` files uploaded to the admin panel, extracting their markdown content and embedded images for the RAG knowledge base.

### word-extractor
- **Version:** `^1.0.4`
- **Why:** Handles legacy `.doc` (Word 97-2003 binary format) files which mammoth does not support.
- **Used for:** Fallback text extraction for older `.doc` files.

### gray-matter
- **Version:** `^4.0.3`
- **Why:** Parses YAML frontmatter in Markdown files, enabling metadata extraction from `.md` files (title, tags, etc.).
- **Used for:** Extracting titles and metadata from markdown knowledge base documents.

---

## 🖼️ Rendering

### react-markdown
- **Version:** `^9.0.3`
- **Why:** Renders the AI's markdown-formatted responses as rich HTML in the chat interface. Supports headings, bold/italic, code blocks, tables, and image rendering.
- **Used for:** Rendering AI responses and cited document image inline previews.

### remark-gfm
- **Version:** `^4.0.0`
- **Why:** GitHub Flavored Markdown extension for react-markdown. Adds support for tables, task lists, strikethrough text, and autolinks.
- **Used for:** Ensuring AI responses that include tables and GFM features render correctly.

---

## 🎨 Icons

### lucide-react
- **Version:** `^0.475.0`
- **Why:** A comprehensive, consistently designed open-source icon library with React components. Much lighter than heroicons or font-awesome bundles.
- **Used for:** All UI icons across the chat interface, sidebar, admin panel, and navigation.

---

## 🔨 Build Tools

| Tool | Version | Purpose |
|------|---------|---------|
| **TypeScript** | `^5.7.3` | Type checking |
| `@types/node` | `^20.17.19` | Node.js type definitions |
| `@types/react` | `^18.3.18` | React type definitions |
| `@types/react-dom` | `^18.3.5` | React DOM type definitions |

---

## 🚀 Deployment

### Vercel
- **Why:** Native Next.js support with zero configuration. Automatic builds on every `git push` to `main`. Serverless function support for all API routes. Free tier is sufficient for this project's scale.
- **Features used:** Automatic HTTPS, CDN caching, environment variables management, preview deployments on pull requests.

---

## 🔒 Security

| Mechanism | Implementation |
|-----------|---------------|
| **Password Hashing** | SHA-256 with a fixed salt (`_abhij_salt`) via Node.js `crypto` module |
| **Admin Auth** | Server-side passcode check via `x-admin-key` header on every admin API call |
| **Session Storage** | Admin passcode stored in `sessionStorage` (cleared on browser close) |
| **SQL Injection Prevention** | Neon tagged template literals (`sql\`...\``) auto-sanitize all query parameters |

---

## 📦 Complete `package.json` Dependencies

```json
{
  "dependencies": {
    "@neondatabase/serverless": "^1.1.0",
    "gray-matter": "^4.0.3",
    "lucide-react": "^0.475.0",
    "mammoth": "^1.12.2",
    "next": "^14.2.35",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-markdown": "^9.0.3",
    "remark-gfm": "^4.0.0",
    "word-extractor": "^1.0.4"
  },
  "devDependencies": {
    "@types/node": "^20.17.19",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "typescript": "^5.7.3"
  }
}
```
