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
 * Retrieve all chat sessions for a specific user
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
 * Save or update a chat session
 */
export function saveUserSession(session: ChatSession): void {
  if (typeof window === 'undefined') return;
  try {
    const sessions = getUserSessions(session.userId);
    const existingIndex = sessions.findIndex(s => s.id === session.id);

    const updatedSession: ChatSession = {
      ...session,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      sessions[existingIndex] = updatedSession;
    } else {
      sessions.unshift(updatedSession);
    }

    localStorage.setItem(getStorageKey(session.userId), JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to save chat session:', err);
  }
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
 * Delete a specific chat session
 */
export function deleteUserSession(userId: string, sessionId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const sessions = getUserSessions(userId).filter(s => s.id !== sessionId);
    localStorage.setItem(getStorageKey(userId), JSON.stringify(sessions));
  } catch (err) {
    console.error('Failed to delete chat session:', err);
  }
}

/**
 * Update the title of a specific session
 */
export function updateSessionTitle(userId: string, sessionId: string, newTitle: string): void {
  if (typeof window === 'undefined') return;
  try {
    const sessions = getUserSessions(userId);
    const target = sessions.find(s => s.id === sessionId);
    if (target) {
      target.title = newTitle.trim() || 'Untitled Chat';
      target.updatedAt = Date.now();
      localStorage.setItem(getStorageKey(userId), JSON.stringify(sessions));
    }
  } catch (err) {
    console.error('Failed to update session title:', err);
  }
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
