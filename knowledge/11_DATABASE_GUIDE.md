# 11 — Database Guide (Neon PostgreSQL)

Complete guide for setting up and managing the Neon DB integration in Abhij-AI.

---

## 🧩 Why Neon DB?

Abhij-AI needs a database for:
- **User accounts** — store usernames and hashed passwords
- **Chat history** — persist conversation sessions across devices and sessions
- **Knowledge documents** — store uploaded/created documents durably (survives Vercel deploys)

**Why Neon specifically?**
- **Serverless-native:** Works without persistent TCP connections — essential for Next.js/Vercel serverless functions
- **Auto-scaling:** Scales to zero when not in use (free during downtime)
- **Free tier:** 0.5 GB storage, 3 GB data transfer/month — more than enough for this project
- **PostgreSQL compatible:** Full SQL, no proprietary query language

---

## 🚀 Setting Up Neon DB (First Time)

### Step 1: Create a Neon Account
1. Go to [neon.tech](https://neon.tech/)
2. Sign up with GitHub, Google, or email

### Step 2: Create a New Project
1. Click **"New Project"**
2. **Project name:** `abhij-ai` (or any name)
3. **PostgreSQL version:** `16` (latest stable)
4. **Region:** Choose the closest to your Vercel deployment region (e.g., `US East` for `iad1`)
5. Click **"Create Project"**

### Step 3: Get the Connection String
1. On the project dashboard, click **"Connection Details"**
2. Select **"Pooled Connection"** (recommended for serverless)
3. Copy the connection string. It looks like:
   ```
   postgresql://neondb_owner:AbCdEfGhIjKl@ep-cold-river-a1bcde23.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```

### Step 4: Add to Environment Variables
**Local development (`.env.local`):**
```env
DATABASE_URL=postgresql://neondb_owner:AbCd...@ep-cold-river-a1bcde23.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Production (Vercel):**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add: `DATABASE_URL` = your connection string
3. Save and redeploy

### Step 5: Auto-Schema Initialization
- **No SQL to run manually!** 🎉
- The app automatically creates all required tables on the **first API call** after `DATABASE_URL` is set.
- This is handled by `initializeSchema()` in `src/lib/db.ts`

---

## 🗄️ Database Schema Reference

### `users` Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(64) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | SERIAL | Auto-increment internal ID |
| `username` | VARCHAR(64) | Unique username, case-sensitive |
| `password_hash` | TEXT | SHA-256 hash of `password + '_abhij_salt'` |
| `created_at` | TIMESTAMPTZ | Account creation timestamp |

---

### `chat_sessions` Table

```sql
CREATE TABLE IF NOT EXISTS chat_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | `chat_<random>_<timestamp>` |
| `user_id` | VARCHAR(64) | Username FK to users table |
| `title` | TEXT | Auto-generated from first message |
| `created_at` | BIGINT | Unix timestamp in milliseconds |
| `updated_at` | BIGINT | Unix timestamp in milliseconds (when last message added) |

---

### `chat_messages` Table

```sql
CREATE TABLE IF NOT EXISTS chat_messages (
  id VARCHAR(64) PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  suggested_questions JSONB DEFAULT '[]',
  created_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
```

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(64) | `msg_<random>_<timestamp>` |
| `session_id` | VARCHAR(64) | FK to chat_sessions.id |
| `role` | VARCHAR(20) | `'user'` or `'assistant'` |
| `content` | TEXT | Full message text (markdown for AI messages) |
| `sources` | JSONB | Array of cited filenames: `["doc.md", "guide.docx"]` |
| `suggested_questions` | JSONB | Array of follow-up questions: `["Q1?", "Q2?"]` |
| `created_at` | BIGINT | Unix timestamp in milliseconds |

---

### `knowledge_documents` Table

```sql
CREATE TABLE IF NOT EXISTS knowledge_documents (
  filename VARCHAR(255) PRIMARY KEY,
  filetype VARCHAR(16) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  size INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

| Column | Type | Description |
|--------|------|-------------|
| `filename` | VARCHAR(255) | `my-doc.md` — unique identifier |
| `filetype` | VARCHAR(16) | `md`, `docx`, `doc`, `txt` |
| `title` | TEXT | Document title (from frontmatter or first heading) |
| `content` | TEXT | Full parsed markdown content |
| `size` | INT | File size in bytes |
| `created_at` | TIMESTAMPTZ | Upload timestamp |
| `updated_at` | TIMESTAMPTZ | Last update timestamp |

---

## 🔧 Manual SQL Operations

For direct database access (via Neon SQL Editor or psql):

### View all users
```sql
SELECT id, username, created_at FROM users ORDER BY created_at DESC;
```

### View all chat sessions for a user
```sql
SELECT s.id, s.title, s.updated_at, COUNT(m.id) AS message_count
FROM chat_sessions s
LEFT JOIN chat_messages m ON m.session_id = s.id
WHERE s.user_id = 'username_here'
GROUP BY s.id
ORDER BY s.updated_at DESC;
```

### Delete a specific user and all their data
```sql
-- CASCADE deletes their sessions and messages automatically
DELETE FROM users WHERE username = 'username_to_delete';
```

### Clear all chat history (but keep users)
```sql
DELETE FROM chat_messages;
DELETE FROM chat_sessions;
```

### View all knowledge documents
```sql
SELECT filename, filetype, title, size, created_at FROM knowledge_documents ORDER BY created_at DESC;
```

### Delete a knowledge document
```sql
DELETE FROM knowledge_documents WHERE filename = 'old-doc.md';
```

### Re-seed knowledge documents from scratch
```sql
TRUNCATE knowledge_documents;
-- Then restart the app — it will re-seed from the knowledge/ directory
```

### Count statistics
```sql
SELECT 
  (SELECT COUNT(*) FROM users) AS total_users,
  (SELECT COUNT(*) FROM chat_sessions) AS total_sessions,
  (SELECT COUNT(*) FROM chat_messages) AS total_messages,
  (SELECT COUNT(*) FROM knowledge_documents) AS total_docs;
```

---

## 🌊 How the Auto-Seeding Works

When `DATABASE_URL` is set and the first knowledge query comes in:

```typescript
// In knowledge.ts: getAllKnowledgeDocuments()
const dbRows = await sql`SELECT * FROM knowledge_documents`;

if (dbRows.rows.length === 0) {
  // DB is empty, seed from local files
  const localFiles = fs.readdirSync(KNOWLEDGE_DIR);
  for (const file of localFiles) {
    const { title, content, filetype } = await parseFileContent(file, fullPath);
    await sql`
      INSERT INTO knowledge_documents (filename, filetype, title, content, size)
      VALUES (${file}, ${filetype}, ${title}, ${content}, ${size})
      ON CONFLICT (filename) DO UPDATE SET content = EXCLUDED.content, ...
    `;
  }
}
```

This means:
1. First request after enabling DB: slow (seeding from disk)
2. All subsequent requests: fast (reading from DB)
3. `ON CONFLICT DO UPDATE`: updating a file in `knowledge/` + restarting app will re-sync it to DB

---

## 🔐 Database Security

| Security Measure | Implementation |
|-----------------|----------------|
| **Passwords never stored** | Only SHA-256 salted hash stored |
| **Parameterized queries** | Neon `sql\`\`` template literal auto-sanitizes |
| **SSL required** | `?sslmode=require` in connection string |
| **No raw credentials in code** | `DATABASE_URL` via environment variable only |
| **Cascade deletes** | Deleting a user cascades to sessions → messages |

---

## 💾 Backup Recommendations

Neon's free tier provides automated backups for 7 days. For extra safety:

### Manual database dump
```bash
# Install pg_dump if needed
pg_dump "<your_DATABASE_URL>" --schema-only > schema_backup.sql
pg_dump "<your_DATABASE_URL>" --data-only > data_backup.sql
```

### Export knowledge documents via API
```bash
curl -H "x-admin-key: admin123" https://your-app.vercel.app/api/knowledge > knowledge_backup.json
```

---

## 🆓 Neon Free Tier Limits

| Resource | Free Tier Limit | Typical Usage |
|----------|----------------|---------------|
| Storage | 512 MB | ~50 MB for typical use |
| Data Transfer | 3 GB/month | Very low — text only |
| Compute | 191.9 cu/month | Low — serverless |
| Projects | 1 | 1 (this project) |
| Branches | 10 | 1 (main) |

**The free tier is more than sufficient for this project.**
