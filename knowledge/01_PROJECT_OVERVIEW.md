# 01 — Project Overview

## What is Abhij-AI?

**Abhij-AI** is a custom-built, fully self-hostable **AI Knowledge Assistant** designed for the **Abacus Digital** team. It functions as an intelligent chatbot that answers user questions by searching through an uploaded knowledge base of documents — including Markdown files and Microsoft Word documents.

Unlike general-purpose chatbots, Abhij-AI is **strictly grounded**: it only answers from the content present in its knowledge base, preventing hallucination. When information is not available, it honestly tells the user rather than making things up.

---

## 🎯 Core Goals

| Goal | Description |
|------|-------------|
| **Grounded AI** | All answers are sourced strictly from knowledge base documents. No hallucination. |
| **Document-Driven** | The knowledge base can be updated at runtime without code changes |
| **User Accounts** | Persistent login system with multi-device chat history sync via Neon DB |
| **Self-Hostable** | Runs locally with zero API keys (demo mode) or fully in Vercel production |
| **Humanized UX** | Conversational, warm responses with a video avatar (Idle / Thinking / Answering states) |

---

## ✨ Key Features

### 💬 Chat Interface
- Real-time **streaming responses** (characters appear as they are generated, like ChatGPT)
- **Message history** within a conversation session
- Suggested follow-up questions after every AI response
- Source citations showing which document an answer came from
- Low-opacity glassmorphism styled chat bubbles — user messages right-aligned, AI responses left-aligned

### 🎬 Video Avatar
- A round video frame at the bottom-right corner of the screen
- **3 animated states:**
  - 🟢 **Idle** — Plays `/videos/Idle.mp4` when no conversation is happening
  - 🟡 **Thinking** — Plays `/videos/Thinking.mp4` while the AI processes a query
  - 🔵 **Answering** — Plays `/videos/Answering.mp4` while streaming a response

### 👤 User Authentication System
- Sign In / Register modal with username + password
- Users are stored in **Neon PostgreSQL DB** (cross-device sync) with localStorage fallback
- Each user's chat history is namespaced separately
- Automatically logged out when sharing links

### 📚 Multi-Session Chat History
- Sidebar panel listing all past conversations
- Auto-generated chat titles from the first message
- Sessions grouped as: **Today**, **Previous 7 Days**, **Older**
- Rename or delete any conversation
- Continue past conversations from any browser/device (when Neon DB is configured)

### 🗄️ Knowledge Base
- Supports `.md`, `.markdown`, `.txt`, `.docx`, `.doc` file formats
- Documents stored in `knowledge/` directory (and synced to Neon DB when configured)
- Full-text search with token-based relevance scoring and stopword filtering
- Heading-weighted scoring (answers from relevant sections get priority)
- Word document image extraction (diagrams and screenshots rendered inline in answers)

### 🔒 Admin Panel (`/admin`)
- Passcode-protected management interface
- Upload Word documents or plain text files
- Write/edit Markdown documents with live preview
- View all indexed documents with sizes, section counts, and type badges
- Delete documents with confirmation modals
- Database Engine status card (Neon Postgres vs Local Storage fallback)

### 📱 Mobile Optimized
- Responsive design working on phones and tablets
- Collapsible sidebar via hamburger menu
- Touch-friendly suggestion chips

### 🌐 SEO & Social Sharing
- Full OpenGraph meta tags (title, description, image)
- Twitter Card support
- Custom favicon from `Abhij-AI.png`
- Social sharing image from `SOCIAL.png`
- Logged-out state by default when sharing links

---

## 🏗️ Project Repository

| Item | Value |
|------|-------|
| **GitHub** | https://github.com/developmentabacusdigital/Abhij-AI |
| **Default Branch** | `main` |
| **Deployment** | Vercel (auto-deploys on push to `main`) |

---

## 📊 Project Status

The project is fully functional and deployed. All core features are implemented:
- ✅ Streaming chat with RAG (Retrieval-Augmented Generation)
- ✅ User authentication (local + Neon DB)
- ✅ Persistent multi-session chat history
- ✅ Video avatar with 3 states
- ✅ Admin panel for knowledge base management
- ✅ Knowledge base persisted in Neon DB
- ✅ Mobile responsive design
- ✅ Social sharing and SEO metadata
