import { neon, NeonQueryFunction } from '@neondatabase/serverless';

let dbClient: NeonQueryFunction<false, false> | null = null;
let schemaInitialized = false;

/**
 * Check if a Neon DATABASE_URL is configured
 */
export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return !!url && url.trim().length > 0 && !url.includes('your_neon_database_url_here');
}

/**
 * Get the Neon DB SQL query executor
 */
export function getDb(): NeonQueryFunction<false, false> | null {
  if (!isDbConfigured()) {
    return null;
  }

  if (!dbClient) {
    dbClient = neon(process.env.DATABASE_URL!);
  }

  return dbClient;
}

/**
 * Automatically create tables and indexes if they do not exist yet
 */
export async function initDatabaseSchema(): Promise<{ success: boolean; error?: string }> {
  const sql = getDb();
  if (!sql) {
    return { success: false, error: 'DATABASE_URL is not configured' };
  }

  try {
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // 2. Chat Sessions Table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
        title TEXT NOT NULL,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );
    `;

    // 3. Index on user_id and updated_at
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id, updated_at DESC);
    `;

    // 4. Chat Messages Table
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        sources JSONB DEFAULT '[]'::jsonb,
        suggested_questions JSONB DEFAULT '[]'::jsonb,
        created_at BIGINT NOT NULL
      );
    `;

    // 5. Index on session_id
    await sql`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at ASC);
    `;

    // 6. Knowledge Documents Table
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        filename VARCHAR(255) PRIMARY KEY,
        filetype VARCHAR(16) NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        size INT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    schemaInitialized = true;
    return { success: true };
  } catch (err: any) {
    console.error('Neon DB Schema Initialization Error:', err);
    return { success: false, error: err.message || 'Failed to initialize schema' };
  }
}

/**
 * Ensures schema is initialized before performing queries
 */
export async function ensureDbReady(): Promise<NeonQueryFunction<false, false> | null> {
  const sql = getDb();
  if (!sql) return null;

  if (!schemaInitialized) {
    await initDatabaseSchema();
  }

  return sql;
}
