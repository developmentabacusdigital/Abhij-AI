# 03 — System Architecture

This document describes the full system architecture of Abhij-AI, including data flows, component relationships, and the RAG (Retrieval-Augmented Generation) pipeline.

---

## 🗺️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                      │
│                                                             │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Auth Modal │  │  Sidebar     │  │   Chat Interface   │  │
│  │  (Login /  │  │  (Sessions / │  │  (Messages /       │  │
│  │  Register) │  │  History)    │  │  Video Avatar)     │  │
│  └─────┬──────┘  └──────┬───────┘  └─────────┬──────────┘  │
│        │                │                     │             │
│        └────────────────┴─────────────────────┘             │
│                         │                                   │
│                 Next.js App Router                          │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP / SSE (Server-Sent Events)
┌─────────────────────────▼───────────────────────────────────┐
│                    Next.js API Routes                        │
│                                                             │
│  POST /api/chat          POST /api/auth/register            │
│  GET  /api/knowledge     POST /api/auth/login               │
│  POST /api/knowledge     GET  /api/chats                    │
│  DEL  /api/knowledge     POST /api/chats                    │
│  POST /api/knowledge/auth  GET/PATCH/DELETE /api/chats/[id] │
│  GET  /api/knowledge/media                                  │
│  GET  /api/admin/db-status                                  │
└──────────────────┬──────────────────────┬───────────────────┘
                   │                      │
        ┌──────────▼──────────┐  ┌────────▼─────────────┐
        │   Knowledge Engine   │  │   Neon PostgreSQL     │
        │   (src/lib/knowledge)│  │                       │
        │                     │  │  - users              │
        │  1. Parse documents  │  │  - chat_sessions      │
        │  2. Chunk sections   │  │  - chat_messages      │
        │  3. Score relevance  │  │  - knowledge_documents│
        │  4. Build context    │  └──────────┬────────────┘
        └──────────┬──────────┘             │
                   │                        │ Fallback
        ┌──────────▼──────────┐    ┌────────▼──────────┐
        │   OpenRouter API     │    │  Browser LocalStorage│
        │   (LLM Gateway)     │    │  (no DB_URL mode)  │
        │                     │    └───────────────────┘
        │  google/gemma-3-12b │
        │  (or configured     │
        │   model)            │
        └──────────┬──────────┘
                   │ SSE stream
        ┌──────────▼──────────┐
        │   Response Streamed  │
        │   back to Browser    │
        │   token by token     │
        └─────────────────────┘
```

---

## 🔄 RAG Pipeline (Core Data Flow)

The heart of Abhij-AI is the **Retrieval-Augmented Generation (RAG)** pipeline. Here is the exact step-by-step flow for every user message:

```
User Types Message
      │
      ▼
POST /api/chat
      │
      ▼
1. isConversationalQuery(query)?
      │
      ├─ YES → Skip RAG, use greeting system prompt
      │
      └─ NO → Continue to RAG...
            │
            ▼
2. getAllDocumentSections()
      │
      ├─ Neon DB configured? → Query knowledge_documents table
      │                         Auto-seed from knowledge/ if empty
      └─ No DB → Read from knowledge/ directory + os.tmpdir()
            │
            ▼
3. Parse & Chunk Documents
      │
      ├─ .md / .txt → Gray-matter + header-based chunking
      ├─ .docx → Mammoth.js → Markdown → Chunking
      └─ .doc  → Word Extractor → Markdown → Chunking
            │
            ▼
4. searchRelevantKnowledge(query)
      │
      ├─ Tokenize query (lowercase, remove stopwords)
      ├─ Score every section:
      │     +10  exact query match in content
      │     +15  exact query match in heading
      │     +1.5 per keyword match in content (max 5)
      │     +5   keyword in heading
      │     +3   keyword in title
      │     +2   keyword in filename
      └─ Return top 4 highest-scoring sections
            │
            ▼
5. Build System Prompt
      │
      ├─ Include knowledge context (top sections)
      ├─ Include available source filenames
      └─ Add persona + guidelines + suggested questions format
            │
            ▼
6. streamOpenRouterChat()
      │
      ├─ No API key? → createSimulatedStream() (demo fallback)
      │
      └─ API key present:
            ├─ POST to OpenRouter API
            ├─ model: gemma-3-12b-it (configurable)
            ├─ temperature: 0.2 (configurable)
            └─ stream: true
                  │
                  ▼
7. Stream response back via SSE
      │
      ├─ Client receives tokens, renders via ReactMarkdown
      ├─ X-Sources header carries cited filenames
      └─ Video avatar switches: Thinking → Answering → Idle
```

---

## 🗃️ Database Schema

```sql
-- Users Table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,      -- SHA-256 salted hash
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Sessions Table
CREATE TABLE chat_sessions (
  id VARCHAR(64) PRIMARY KEY,        -- 'chat_abc1234_1725000000000'
  user_id VARCHAR(64) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  title TEXT NOT NULL,               -- Auto-generated from first message
  created_at BIGINT NOT NULL,        -- Unix timestamp (ms)
  updated_at BIGINT NOT NULL         -- Unix timestamp (ms)
);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);

-- Chat Messages Table
CREATE TABLE chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,         -- 'user' or 'assistant'
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',        -- ["filename1.md", "filename2.docx"]
  suggested_questions JSONB DEFAULT '[]', -- ["Question 1", "Question 2"]
  created_at BIGINT NOT NULL
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at ASC);

-- Knowledge Base Documents Table
CREATE TABLE knowledge_documents (
  filename VARCHAR(255) PRIMARY KEY, -- 'my-document.md'
  filetype VARCHAR(16) NOT NULL,     -- 'md', 'docx', 'doc', 'txt'
  title TEXT NOT NULL,
  content TEXT NOT NULL,             -- Full parsed markdown text
  size INT NOT NULL,                 -- Bytes
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📁 Storage Architecture

```
Storage Priority for Knowledge Documents:
1. Neon DB (knowledge_documents table) — if DATABASE_URL configured
   └─ Auto-seeds from local knowledge/ directory on first empty query
   
2. Local Filesystem (knowledge/ directory)
   └─ Primary source for local development
   
3. OS tmpdir (/tmp/knowledge)
   └─ Fallback when knowledge/ is read-only (serverless write operations)
   └─ Vercel deploys can write documents here temporarily
   
4. Auto-Merge Logic:
   └─ Both knowledge/ and /tmp/knowledge are merged; tmpdir overrides
      when a file exists in both (tmpdir = newer uploaded version)
```

---

## 🔐 Authentication Flow

```
User enters username + password
      │
      ▼
Client calls POST /api/auth/login
      │
      ├─ Neon DB available?
      │     └─ YES: Query users table, compare SHA-256 hash
      │     └─ NO: Fall back to localStorage abhij_users_db
      │
      ▼
On success:
      ├─ User object stored in localStorage abhij_current_user
      ├─ Client fetches sessions: GET /api/chats?userId=username
      │     └─ Cloud sessions merged with local localStorage sessions
      └─ Session ID persists in localStorage across page refreshes
```

---

## 🎥 Video Avatar State Machine

```
States: IDLE → THINKING → ANSWERING → IDLE

Transitions:
  App loads → IDLE (play Idle.mp4 loop)
  User submits message → THINKING (play Thinking.mp4 loop)
  First token received from stream → ANSWERING (play Answering.mp4 loop)
  Stream complete → IDLE (play Idle.mp4 loop)

Video element behavior:
  - autoplay, muted, loop, playsInline
  - src swapped via React state (avatarState: 'idle'|'thinking'|'answering')
  - Positioned: fixed bottom-right, circular frame with soft glow
```

---

## 🔀 Admin Authentication Flow

```
Admin visits /admin
      │
      ├─ sessionStorage has 'abhij_admin_key'?
      │     └─ YES: POST /api/knowledge/auth with saved key
      │          ├─ Valid? → Load documents, show admin panel
      │          └─ Invalid? → Clear sessionStorage, show gate
      │
      └─ NO: Show passcode gate UI
            │
            User enters passcode
            │
            POST /api/knowledge/auth
            ├─ Server checks: key === process.env.ADMIN_PASSWORD
            ├─ Tolerant match for both 'admin123' and 'Admin@123'
            ├─ Valid? → Load documents, save key to sessionStorage
            └─ Invalid? → Show error in gate form
```
