export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  suggestedQuestions?: string[];
  timestamp?: number;
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

function getStorageKey(userId: string): string {
  const safeUser = (userId || 'guest').trim().toLowerCase();
  return `abhij_chats_${safeUser}`;
}

/**
 * Retrieve all chat sessions for a specific user from local cache
 */
export function getUserSessions(userId: string): ChatSession[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const sessions: ChatSession[] = JSON.parse(raw);
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('Failed to load user chat sessions:', err);
    return [];
  }
}

/**
 * Fetch and synchronize chat sessions from Neon DB cloud
 */
export async function fetchUserSessionsFromCloud(userId: string): Promise<ChatSession[]> {
  if (typeof window === 'undefined' || !userId) return [];

  // Local fallback baseline
  const local = getUserSessions(userId);

  try {
    const res = await fetch(`/api/chats?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return local;

    const data = await res.json();
    if (data.dbConfigured && data.success && Array.isArray(data.sessions)) {
      const cloudSessions: ChatSession[] = data.sessions;

      // Merge cloud and local, taking whichever has higher updatedAt
      const mergedMap = new Map<string, ChatSession>();
      for (const s of local) mergedMap.set(s.id, s);
      for (const s of cloudSessions) {
        const existing = mergedMap.get(s.id);
        if (!existing || s.updatedAt >= existing.updatedAt) {
          mergedMap.set(s.id, s);
        }
      }

      const mergedList = Array.from(mergedMap.values()).sort((a, b) => b.updatedAt - a.updatedAt);
      localStorage.setItem(getStorageKey(userId), JSON.stringify(mergedList));
      return mergedList;
    }
  } catch (err) {
    console.warn('Could not sync with Neon DB, using local cache:', err);
  }

  return local;
}

/**
 * Save or update a chat session (optimistic local + Neon cloud background sync)
 */
export function saveUserSession(session: ChatSession): void {
  if (typeof window === 'undefined') return;

  const updatedSession: ChatSession = {
    ...session,
    updatedAt: Date.now(),
  };

  // 1. Optimistic Local Save
  try {
    const sessions = getUserSessions(session.userId);
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    if (existingIndex >= 0) {
      sessions[existingIndex] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }

    localStorage.setItem(getStorageKey(session.userId), JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save chat session locally:', err);
  }

  // 2. Background Neon Cloud Sync
  fetch('/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedSession),
  }).catch(err => {
    // Non-blocking fallback
    console.debug('Neon DB background sync deferred:', err);
  });
}

/**
 * Create a fresh chat session
 */
export function createNewSession(userId: string): ChatSession {
  const newSession: ChatSession = {
    id: 'chat_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now(),
    userId: (userId || 'guest').trim().toLowerCase(),
    title: 'New Chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };

  saveUserSession(newSession);
  return newSession;
}

/**
 * Delete a specific chat session (optimistic local + Neon cloud sync)
 */
export function deleteUserSession(userId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;

  // 1. Optimistic Local Delete
  try {
    const sessions = getUserSessions(userId).filter(s => s.id !== sessionId);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to delete chat session locally:', err);
  }

  // 2. Background Neon Cloud Delete
  fetch(`/api/chats/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
  }).catch(err => {
    console.debug('Neon DB background delete deferred:', err);
  });
}

/**
 * Update the title of a specific session (optimistic local + Neon cloud sync)
 */
export function updateSessionTitle(userId: string, sessionId: string, newTitle: string): void {
  if (typeof window === 'undefined') return;

  const trimmed = newTitle.trim() || 'Untitled Chat';

  // 1. Optimistic Local Rename
  try {
    const sessions = getUserSessions(userId);
    const target = sessions.find(s => s.id === sessionId);
    if (target) {
      target.title = trimmed;
      target.updatedAt = Date.now();
      localStorage.setItem(getStorageKey(userId), JSON.stringify(sessions));
    }
  } catch (err) {
    console.error('Failed to update session title locally:', err);
  }

  // 2. Background Neon Cloud Rename
  fetch(`/api/chats/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: trimmed }),
  }).catch(err => {
    console.debug('Neon DB background rename deferred:', err);
  });
}

/**
 * Auto-generate a smart chat title from the first exchange
 */
export function generateChatTitle(firstPrompt: string, firstReply?: string): string {
  if (!firstPrompt || !firstPrompt.trim()) return 'New Conversation';

  const cleanPrompt = firstPrompt.trim();

  // Check common greetings
  if (/^(hi|hello|hey|good\s+(morning|afternoon|evening))\b/i.test(cleanPrompt)) {
    return 'Greeting & Intro';
  }

  // If prompt is short, use clean capitalized version
  if (cleanPrompt.length <= 32) {
    return cleanPrompt
      .replace(/[?.,!]+$/, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Extract key nouns/topic from prompt
  const stripped = cleanPrompt
    .replace(/^(what is|can you explain|how does|tell me about|how to|why is|explain)\s+/i, '')
    .replace(/[?.,!]+$/, '');

  const words = stripped.split(/\s+/).slice(0, 4);
  const title = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return title.length > 3 ? title : 'New Conversation';
}

/**
 * Group sessions by date timeframe (Today, Previous 7 Days, Older)
 */
export function groupSessionsByDate(sessions: ChatSession[]): {
  today: ChatSession[];
  previous7Days: ChatSession[];
  older: ChatSession[];
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sevenDaysAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const today: ChatSession[] = [];
  const previous7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    if (session.updatedAt >= startOfToday) {
      today.push(session);
    } else if (session.updatedAt >= sevenDaysAgo) {
      previous7Days.push(session);
    } else {
      older.push(session);
    }
  }

  return { today, previous7Days, older };
}
