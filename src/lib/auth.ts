export interface User {
  username: string;
  createdAt: number;
}

interface StoredAccount {
  passwordHash: string;
  createdAt: number;
}

const USERS_STORAGE_KEY = 'abhij_users_db';
const SESSION_USER_KEY = 'abhij_current_user';

// Simple client-side hash helper
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36) + '_' + str.length;
}

function getStoredAccounts(): Record<string, StoredAccount> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      // Initialize with default demo user
      const initial: Record<string, StoredAccount> = {
        abhijay: {
          passwordHash: simpleHash('password123'),
          createdAt: Date.now(),
        },
      };
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveStoredAccounts(accounts: Record<string, StoredAccount>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save user accounts to localStorage:', err);
  }
}

/**
 * Returns current logged-in user or null
 */
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
      // Default to guest/demo user for first visit
      const defaultUser: User = { username: 'abhijay', createdAt: Date.now() };
      localStorage.setItem(SESSION_USER_KEY, JSON.stringify(defaultUser));
      return defaultUser;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set active user session
 */
export function setCurrentUser(user: User | null) {
  if (typeof window === 'undefined') return;
  if (!user) {
    localStorage.removeItem(SESSION_USER_KEY);
  } else {
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  }
}

/**
 * Register a new user account
 */
export function registerUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; user?: User; error?: string } {
  const username = usernameInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!username || username.length < 3) {
    return { success: false, error: 'Username must be at least 3 characters long.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { success: false, error: 'Username can only contain letters, numbers, and underscores.' };
  }
  if (!password || password.length < 4) {
    return { success: false, error: 'Password must be at least 4 characters long.' };
  }

  const accounts = getStoredAccounts();
  if (accounts[username]) {
    return { success: false, error: `Username "${username}" is already taken.` };
  }

  const newAccount: StoredAccount = {
    passwordHash: simpleHash(password),
    createdAt: Date.now(),
  };

  accounts[username] = newAccount;
  saveStoredAccounts(accounts);

  const user: User = { username, createdAt: newAccount.createdAt };
  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Log in an existing user
 */
export function loginUser(
  usernameInput: string,
  passwordInput: string
): { success: boolean; user?: User; error?: string } {
  const username = usernameInput.trim().toLowerCase();
  const password = passwordInput.trim();

  if (!username || !password) {
    return { success: false, error: 'Please enter both username and password.' };
  }

  const accounts = getStoredAccounts();
  const account = accounts[username];

  if (!account) {
    return { success: false, error: 'User not found. Please create an account.' };
  }

  if (account.passwordHash !== simpleHash(password)) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  const user: User = { username, createdAt: account.createdAt };
  setCurrentUser(user);
  return { success: true, user };
}

/**
 * Log out active user
 */
export function logoutUser() {
  setCurrentUser(null);
}
