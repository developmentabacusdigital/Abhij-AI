'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Edit2,
  Check,
  Moon,
  Sun,
  Menu,
  X,
  ShieldCheck,
  Thermometer,
  ExternalLink,
  ChevronRight,
  Database,
  Cpu,
  ArrowRight,
  ZoomIn,
  Settings,
  Sparkles,
  User as UserIcon,
  LogOut,
  LogIn,
  UserPlus,
  Navigation
} from 'lucide-react';
import {
  User,
  getCurrentUser,
  loginUser,
  registerUser,
  logoutUser
} from '@/lib/auth';
import {
  Message,
  ChatSession,
  getUserSessions,
  fetchUserSessionsFromCloud,
  saveUserSession,
  createNewSession,
  deleteUserSession,
  updateSessionTitle,
  generateChatTitle,
  groupSessionsByDate
} from '@/lib/chat-store';

interface KnowledgeDoc {
  filename: string;
  filetype?: 'md' | 'docx' | 'doc' | 'txt';
  title: string;
  size: number;
  sectionsCount: number;
  content: string;
}

const STARTER_QUERIES = [
  {
    query: "Hi, can you introduce yourself and tell me what you can do?",
    context: "General Introduction",
  },
  {
    query: "Can you explain the high-level system architecture?",
    context: "HOW-IT-WORKS.md",
  },
  {
    query: "What are the key features and latency of VectorStream Engine?",
    context: "product_guide.md",
  },
  {
    query: "Where are Apex Systems' office locations and operating hours?",
    context: "company_overview.md",
  },
];

/**
 * Parses raw assistant markdown to separate the main body from suggested next questions
 */
function parseAssistantResponse(rawContent: string): {
  markdownBody: string;
  suggestedQuestions: string[];
} {
  if (!rawContent) return { markdownBody: '', suggestedQuestions: [] };

  const suggestedQuestionsHeader = /###\s+Suggested\s+Questions/i;
  const match = rawContent.match(suggestedQuestionsHeader);

  if (!match || match.index === undefined) {
    return { markdownBody: rawContent, suggestedQuestions: [] };
  }

  const markdownBody = rawContent.slice(0, match.index).trim();
  const rawSuggestions = rawContent.slice(match.index + match[0].length).trim();

  const suggestedQuestions = rawSuggestions
    .split('\n')
    .map(line => line.replace(/^[\s*\-–—\d.)\]>]+/, '').replace(/^\[|\]$/g, '').trim())
    .filter(line => line.length > 5 && line.length < 160 && !line.startsWith('#'));

  return { markdownBody, suggestedQuestions };
}

export default function Home() {
  // User Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Chat Sessions State
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleText, setEditingTitleText] = useState('');
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'docs'>('chats');

  // Chat Input & Theme State
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  // Avatar Video State (idle, thinking, answering)
  const [avatarState, setAvatarState] = useState<'idle' | 'thinking' | 'answering'>('idle');
  const idleVideoRef = useRef<HTMLVideoElement>(null);
  const thinkingVideoRef = useRef<HTMLVideoElement>(null);
  const answeringVideoRef = useRef<HTMLVideoElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync avatar video playback with avatarState
  useEffect(() => {
    if (avatarState === 'idle') {
      idleVideoRef.current?.play().catch(() => {});
    } else if (avatarState === 'thinking') {
      thinkingVideoRef.current?.play().catch(() => {});
    } else if (avatarState === 'answering') {
      answeringVideoRef.current?.play().catch(() => {});
    }
  }, [avatarState]);

  // Initialize auth and sessions on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    fetchKnowledgeDocs();

    const user = getCurrentUser();
    setCurrentUser(user);

    if (user) {
      loadUserSessions(user.username);
    }
  }, [theme]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const loadUserSessions = async (username: string) => {
    // 1. Instant local render
    const localSessions = getUserSessions(username);
    setSessions(localSessions);

    if (localSessions.length > 0) {
      const active = localSessions[0];
      setCurrentSessionId(active.id);
      setMessages(active.messages || []);
    } else {
      // Create initial session
      const freshSession = createNewSession(username);
      setSessions([freshSession]);
      setCurrentSessionId(freshSession.id);
      setMessages([]);
    }

    // 2. Synchronize from Neon DB
    try {
      const cloudSessions = await fetchUserSessionsFromCloud(username);
      if (cloudSessions.length > 0) {
        setSessions(cloudSessions);
        // If current session is empty, focus on latest cloud session
        if (localSessions.length === 0 || (localSessions.length === 1 && localSessions[0].messages.length === 0)) {
          setCurrentSessionId(cloudSessions[0].id);
          setMessages(cloudSessions[0].messages || []);
        }
      }
    } catch (err) {
      console.debug('Cloud sync deferred:', err);
    }
  };

  const fetchKnowledgeDocs = async () => {
    try {
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const data = await res.json();
        setKnowledgeDocs(data.documents || []);
      }
    } catch (err) {
      console.error('Failed to load knowledge docs:', err);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
  };

  // Auth Handlers
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (authTab === 'login') {
      const res = await loginUser(authUsername, authPassword);
      if (!res.success || !res.user) {
        setAuthError(res.error || 'Login failed');
        return;
      }
      setCurrentUser(res.user);
      setShowAuthModal(false);
      setAuthUsername('');
      setAuthPassword('');
      await loadUserSessions(res.user.username);
    } else {
      const res = await registerUser(authUsername, authPassword);
      if (!res.success || !res.user) {
        setAuthError(res.error || 'Registration failed');
        return;
      }
      setCurrentUser(res.user);
      setShowAuthModal(false);
      setAuthUsername('');
      setAuthPassword('');
      await loadUserSessions(res.user.username);
    }
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    setSessions([]);
    setCurrentSessionId('');
    setMessages([]);
    setShowAuthModal(true);
  };

  // Chat Session Handlers
  const handleNewChat = () => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    const fresh = createNewSession(currentUser.username);
    setSessions(prev => [fresh, ...prev.filter(s => s.id !== fresh.id)]);
    setCurrentSessionId(fresh.id);
    setMessages([]);
    setMobileMenuOpen(false);
  };

  const handleSelectSession = (session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages || []);
    setMobileMenuOpen(false);
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser) return;

    deleteUserSession(currentUser.username, sessionId);
    const remaining = sessions.filter(s => s.id !== sessionId);
    setSessions(remaining);

    if (currentSessionId === sessionId) {
      if (remaining.length > 0) {
        setCurrentSessionId(remaining[0].id);
        setMessages(remaining[0].messages || []);
      } else {
        const fresh = createNewSession(currentUser.username);
        setSessions([fresh]);
        setCurrentSessionId(fresh.id);
        setMessages([]);
      }
    }
  };

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditingTitleText(session.title);
  };

  const handleSaveRename = (sessionId: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser) return;

    const trimmed = editingTitleText.trim() || 'Untitled Chat';
    updateSessionTitle(currentUser.username, sessionId, trimmed);
    setSessions(prev =>
      prev.map(s => (s.id === sessionId ? { ...s, title: trimmed } : s))
    );
    setEditingSessionId(null);
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async (overrideQuery?: string) => {
    const queryToSend = overrideQuery || input.trim();
    if (!queryToSend || isLoading) return;

    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    // Ensure we have an active session
    let activeSessionId = currentSessionId;
    let currentSession = sessions.find(s => s.id === activeSessionId);
    if (!currentSession) {
      const fresh = createNewSession(currentUser.username);
      activeSessionId = fresh.id;
      currentSession = fresh;
      setSessions(prev => [fresh, ...prev]);
      setCurrentSessionId(fresh.id);
    }

    const userMessageId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMessageId,
      role: 'user',
      content: queryToSend,
    };

    const assistantMessageId = (Date.now() + 1).toString();
    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
    };

    const updatedMessages = [...messages, newUserMessage];
    setMessages([...updatedMessages, initialAssistantMessage]);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);
    setAvatarState('thinking');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: updatedMessages.map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      // Extract sources header if provided
      const sourcesHeader = response.headers.get('X-Sources');
      let sources: string[] = [];
      if (sourcesHeader) {
        try {
          sources = JSON.parse(sourcesHeader);
        } catch {}
      }

      // Stream the response tokens
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6).trim();
              if (dataStr === '[DONE]') break;

              try {
                const parsed = JSON.parse(dataStr);
                const delta = parsed.choices?.[0]?.delta?.content || '';
                if (delta) {
                  setAvatarState('answering');
                }
                accumulatedText += delta;

                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedText, sources }
                      : msg
                  )
                );
              } catch (parseError) {
                // non-JSON stream chunk
              }
            }
          }
        }
      }

      // Finalize messages for current session
      const finalAssistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: accumulatedText,
        sources,
      };
      const finalConversation = [...updatedMessages, finalAssistantMessage];

      // Auto-title session if this is the first exchange
      let sessionTitle = currentSession.title;
      if (
        sessionTitle === 'New Chat' ||
        sessionTitle === 'New Conversation' ||
        currentSession.messages.length === 0
      ) {
        sessionTitle = generateChatTitle(queryToSend, accumulatedText);
      }

      const updatedSession: ChatSession = {
        ...currentSession,
        title: sessionTitle,
        messages: finalConversation,
        updatedAt: Date.now(),
      };

      saveUserSession(updatedSession);
      setSessions(prev =>
        prev.map(s => (s.id === activeSessionId ? updatedSession : s))
      );
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `⚠️ Error: ${err.message || 'Failed to reach OpenRouter service.'}`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
      setAvatarState('idle');
    }
  };

  const groupedSessions = groupSessionsByDate(sessions);

  return (
    <div className="app-container">
      {/* Sidebar Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Abhij-AI.png"
              alt="Abhij-AI"
              className="brand-logo-img"
            />
          </div>
          <button
            className="icon-btn mobile-close-btn"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* New Chat Button */}
        <div className="sidebar-action-row">
          <button className="new-chat-btn" onClick={handleNewChat}>
            <Plus size={16} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Segmented Switcher: Chats vs Knowledge Docs */}
        <div className="sidebar-segmented-tabs">
          <button
            className={`segmented-tab ${sidebarTab === 'chats' ? 'active' : ''}`}
            onClick={() => setSidebarTab('chats')}
          >
            <MessageSquare size={14} />
            <span>Chats ({sessions.length})</span>
          </button>
          <button
            className={`segmented-tab ${sidebarTab === 'docs' ? 'active' : ''}`}
            onClick={() => setSidebarTab('docs')}
          >
            <FileText size={14} />
            <span>Docs ({knowledgeDocs.length})</span>
          </button>
        </div>

        {/* Sidebar Body */}
        <div className="sidebar-content">
          {sidebarTab === 'chats' ? (
            <div className="chat-history-container">
              {!currentUser ? (
                <div className="empty-history-text">
                  <p>Sign in to save and access your chat history across sessions.</p>
                  <button
                    className="sidebar-auth-prompt-btn"
                    onClick={() => setShowAuthModal(true)}
                  >
                    <LogIn size={13} />
                    <span>Sign In / Register</span>
                  </button>
                </div>
              ) : sessions.length === 0 ? (
                <div className="empty-history-text">
                  No conversation history yet. Start a new chat!
                </div>
              ) : (
                <>
                  {/* Today */}
                  {groupedSessions.today.length > 0 && (
                    <div className="history-group">
                      <div className="history-group-title">Today</div>
                      {groupedSessions.today.map(session => (
                        <div
                          key={session.id}
                          className={`history-item ${session.id === currentSessionId ? 'active' : ''}`}
                          onClick={() => handleSelectSession(session)}
                        >
                          <MessageSquare size={14} className="history-item-icon" />
                          {editingSessionId === session.id ? (
                            <form
                              onSubmit={e => handleSaveRename(session.id, e)}
                              className="rename-inline-form"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingTitleText}
                                onChange={e => setEditingTitleText(e.target.value)}
                                autoFocus
                                className="rename-inline-input"
                              />
                              <button type="submit" className="rename-btn-check">
                                <Check size={12} />
                              </button>
                            </form>
                          ) : (
                            <span className="history-item-title">{session.title}</span>
                          )}
                          <div className="history-item-actions">
                            <button
                              className="history-action-btn"
                              title="Rename chat"
                              onClick={e => handleStartRename(session, e)}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="history-action-btn danger"
                              title="Delete chat"
                              onClick={e => handleDeleteSession(session.id, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Previous 7 Days */}
                  {groupedSessions.previous7Days.length > 0 && (
                    <div className="history-group">
                      <div className="history-group-title">Previous 7 Days</div>
                      {groupedSessions.previous7Days.map(session => (
                        <div
                          key={session.id}
                          className={`history-item ${session.id === currentSessionId ? 'active' : ''}`}
                          onClick={() => handleSelectSession(session)}
                        >
                          <MessageSquare size={14} className="history-item-icon" />
                          {editingSessionId === session.id ? (
                            <form
                              onSubmit={e => handleSaveRename(session.id, e)}
                              className="rename-inline-form"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingTitleText}
                                onChange={e => setEditingTitleText(e.target.value)}
                                autoFocus
                                className="rename-inline-input"
                              />
                              <button type="submit" className="rename-btn-check">
                                <Check size={12} />
                              </button>
                            </form>
                          ) : (
                            <span className="history-item-title">{session.title}</span>
                          )}
                          <div className="history-item-actions">
                            <button
                              className="history-action-btn"
                              title="Rename chat"
                              onClick={e => handleStartRename(session, e)}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="history-action-btn danger"
                              title="Delete chat"
                              onClick={e => handleDeleteSession(session.id, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Older */}
                  {groupedSessions.older.length > 0 && (
                    <div className="history-group">
                      <div className="history-group-title">Older</div>
                      {groupedSessions.older.map(session => (
                        <div
                          key={session.id}
                          className={`history-item ${session.id === currentSessionId ? 'active' : ''}`}
                          onClick={() => handleSelectSession(session)}
                        >
                          <MessageSquare size={14} className="history-item-icon" />
                          {editingSessionId === session.id ? (
                            <form
                              onSubmit={e => handleSaveRename(session.id, e)}
                              className="rename-inline-form"
                              onClick={e => e.stopPropagation()}
                            >
                              <input
                                type="text"
                                value={editingTitleText}
                                onChange={e => setEditingTitleText(e.target.value)}
                                autoFocus
                                className="rename-inline-input"
                              />
                              <button type="submit" className="rename-btn-check">
                                <Check size={12} />
                              </button>
                            </form>
                          ) : (
                            <span className="history-item-title">{session.title}</span>
                          )}
                          <div className="history-item-actions">
                            <button
                              className="history-action-btn"
                              title="Rename chat"
                              onClick={e => handleStartRename(session, e)}
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              className="history-action-btn danger"
                              title="Delete chat"
                              onClick={e => handleDeleteSession(session.id, e)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="sidebar-section">
              <div className="doc-list">
                {knowledgeDocs.length === 0 ? (
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    No documents found in /knowledge folder.
                  </div>
                ) : (
                  knowledgeDocs.map(doc => (
                    <div
                      key={doc.filename}
                      className="doc-item"
                      onClick={() => {
                        setSelectedDoc(doc);
                        setMobileMenuOpen(false);
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <FileText size={16} className="doc-icon" />
                      <div className="doc-info">
                        <div className="doc-name">{doc.title}</div>
                        <div className="doc-meta">
                          <span className="doc-type-pill">{doc.filetype ? doc.filetype.toUpperCase() : 'DOC'}</span>
                          <span>{doc.filename} · {doc.sectionsCount} sections</span>
                        </div>
                      </div>
                      <ChevronRight size={14} color="var(--text-muted)" />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          {/* Current User Card */}
          {currentUser ? (
            <div className="sidebar-user-card">
              <div className="user-avatar-pill">
                <span className="user-avatar-initial">
                  {currentUser.username.charAt(0).toUpperCase()}
                </span>
                <span className="user-avatar-name">{currentUser.username}</span>
              </div>
              <button
                className="icon-btn-subtle"
                onClick={handleLogout}
                title="Sign out"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              className="sidebar-auth-btn"
              onClick={() => setShowAuthModal(true)}
            >
              <LogIn size={14} />
              <span>Sign In / Register</span>
            </button>
          )}

          <Link href="/admin" className="sidebar-admin-btn">
            <Settings size={14} />
            <span>Manage Knowledge (Admin)</span>
          </Link>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main className="chat-area">
        {/* Header */}
        <header className="chat-header">
          <div className="header-left">
            <button
              className="icon-btn mobile-menu-btn"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open knowledge menu"
            >
              <Menu size={18} />
            </button>
            <div className="header-title-wrapper">
              <h2>
                {sessions.find(s => s.id === currentSessionId)?.title || 'Document Grounded Assistant'}
              </h2>
              <div className="header-status-indicator">
                <span className="status-dot" />
                <span>Humanized Knowledge Assistant</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <button
              className="header-new-chat-btn"
              onClick={handleNewChat}
              title="Start a new chat"
            >
              <Plus size={14} />
              <span>New</span>
            </button>

            <Link href="/admin" className="header-admin-pill" title="Knowledge Base Admin Panel">
              <Settings size={14} />
              <span>Admin</span>
            </Link>

            <button
              className="icon-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
          </div>
        </header>

        {/* Message Stream Area */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-hero">
              <div className="hero-badge">
                <Sparkles size={14} />
                <span>Conversational & Factual Grounding</span>
              </div>
              <h2 className="pixel-font">Ask Abhij-AI Anything</h2>
              <p>
                Strictly grounded in your Markdown and Word documentation with natural, humanized explanations. Say hi or select an inquiry below to begin.
              </p>

              <div className="suggestions-grid">
                {STARTER_QUERIES.map((item, idx) => (
                  <button
                    key={idx}
                    className="suggestion-card"
                    onClick={() => handleSubmit(item.query)}
                  >
                    <div className="suggestion-query">{item.query}</div>
                    <div className="suggestion-context">
                      <span>{item.context}</span>
                      <ChevronRight size={13} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map(message => {
                const isUser = message.role === 'user';
                const { markdownBody, suggestedQuestions } = isUser
                  ? { markdownBody: message.content, suggestedQuestions: [] }
                  : parseAssistantResponse(message.content);

                return (
                  <div
                    key={message.id}
                    className={`message-wrapper ${isUser ? 'user-align' : 'assistant-align'}`}
                  >
                    <div className={`message-avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
                      {isUser ? (
                        currentUser ? currentUser.username.charAt(0).toUpperCase() : 'U'
                      ) : (
                        <span className="pixel-font">A</span>
                      )}
                    </div>
                    <div className={`message-bubble ${isUser ? 'user-bubble' : 'assistant-bubble'}`}>
                      {isUser ? (
                        <div className="user-text">{message.content}</div>
                      ) : (
                        <>
                          {message.content === '' && isLoading ? (
                            <div className="thinking-indicator">
                              <span className="dot dot-1" />
                              <span className="dot dot-2" />
                              <span className="dot dot-3" />
                            </div>
                          ) : (
                            <div className="markdown-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  img: ({ node, ...props }) => {
                                    const rawSrc = (props.src as string) || '';
                                    const altText = (props.alt as string) || 'Document visual';

                                    // Auto-normalize relative paths, figure references, or alt-based references
                                    let resolvedSrc = rawSrc;
                                    if (resolvedSrc && !resolvedSrc.startsWith('http') && !resolvedSrc.startsWith('/api/knowledge/media')) {
                                      resolvedSrc = `/api/knowledge/media?file=${encodeURIComponent(resolvedSrc)}`;
                                    } else if (!resolvedSrc && altText) {
                                      resolvedSrc = `/api/knowledge/media?file=${encodeURIComponent(altText)}`;
                                    }

                                    return (
                                      <span
                                        className="doc-image-wrapper"
                                        onClick={() =>
                                          setLightboxImage({
                                            src: resolvedSrc,
                                            alt: altText,
                                          })
                                        }
                                        role="button"
                                        tabIndex={0}
                                        title="Click to zoom image"
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={resolvedSrc}
                                          alt={altText}
                                          className="doc-rendered-img"
                                          loading="lazy"
                                          onError={e => {
                                            const target = e.currentTarget;
                                            if (altText && !target.dataset.triedAlt) {
                                              target.dataset.triedAlt = 'true';
                                              target.src = `/api/knowledge/media?file=${encodeURIComponent(altText)}`;
                                            }
                                          }}
                                        />
                                        <span className="doc-image-overlay">
                                          <ZoomIn size={14} />
                                          <span>Click to enlarge</span>
                                        </span>
                                        {altText && (
                                          <span className="doc-image-caption">{altText}</span>
                                        )}
                                      </span>
                                    );
                                  },
                                }}
                              >
                                {markdownBody}
                              </ReactMarkdown>
                            </div>
                          )}

                          {/* Source Citations */}
                          {message.sources && message.sources.length > 0 && (
                            <div className="sources-container">
                              <span className="sources-label">Referenced:</span>
                              <div className="sources-chips">
                                {message.sources.map(source => {
                                  const matchingDoc = knowledgeDocs.find(
                                    d => d.filename === source
                                  );
                                  return (
                                    <button
                                      key={source}
                                      className="source-chip"
                                      onClick={() => matchingDoc && setSelectedDoc(matchingDoc)}
                                      title={`View source file ${source}`}
                                    >
                                      <FileText size={12} />
                                      <span>{source}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Interactive Suggested Questions */}
                          {suggestedQuestions.length > 0 && (
                            <div className="followup-container">
                              <div className="followup-header">
                                <Sparkles size={13} />
                                <span>Suggested Next Questions</span>
                              </div>
                              <div className="followup-chips">
                                {suggestedQuestions.map((question, qIdx) => (
                                  <button
                                    key={qIdx}
                                    className="followup-chip"
                                    onClick={() => handleSubmit(question)}
                                    disabled={isLoading}
                                  >
                                    <span>{question}</span>
                                    <ArrowRight size={13} />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Dock */}
        <div className="input-dock">
          <div className="input-wrapper">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                className="chat-textarea"
                placeholder={
                  currentUser
                    ? `Message Abhij-AI (${currentUser.username})...`
                    : 'Message Abhij-AI...'
                }
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="input-hint">
              Abhij-AI is strictly grounded in Markdown and Word knowledge base documents. Press Enter to send, Shift+Enter for new line.
            </div>
          </div>
        </div>
      </main>

      {/* DOCUMENT VIEWER MODAL */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FileText size={18} />
                <span>{selectedDoc.filename}</span>
              </h3>
              <button
                className="icon-btn"
                onClick={() => setSelectedDoc(null)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="markdown-content">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    img: ({ node, ...props }) => (
                      <span
                        className="doc-image-wrapper"
                        onClick={() =>
                          setLightboxImage({
                            src: (props.src as string) || '',
                            alt: (props.alt as string) || '',
                          })
                        }
                        role="button"
                        tabIndex={0}
                        title="Click to zoom image"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={props.src}
                          alt={props.alt || 'Document visual'}
                          className="doc-rendered-img"
                          loading="lazy"
                        />
                        <span className="doc-image-overlay">
                          <ZoomIn size={14} />
                          <span>Click to enlarge</span>
                        </span>
                        {props.alt && <span className="doc-image-caption">{props.alt}</span>}
                      </span>
                    ),
                  }}
                >
                  {selectedDoc.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* USER AUTH MODAL */}
      {showAuthModal && (
        <div className="modal-overlay" onClick={() => setShowAuthModal(false)}>
          <div className="modal-content auth-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="auth-modal-title-group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/Abhij-AI.png"
                  alt="Abhij-AI"
                  className="auth-modal-logo-img"
                />
              </div>
              <button
                className="icon-btn"
                onClick={() => setShowAuthModal(false)}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="auth-modal-tabs">
              <button
                className={`auth-modal-tab ${authTab === 'login' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  setAuthError('');
                }}
              >
                <LogIn size={14} />
                <span>Sign In</span>
              </button>
              <button
                className={`auth-modal-tab ${authTab === 'register' ? 'active' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  setAuthError('');
                }}
              >
                <UserPlus size={14} />
                <span>Create Account</span>
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="auth-modal-form">
              <div className="auth-field">
                <label>Username</label>
                <input
                  type="text"
                  placeholder="e.g. abhijay"
                  value={authUsername}
                  onChange={e => setAuthUsername(e.target.value)}
                  className="auth-input"
                  required
                  autoFocus
                />
              </div>

              <div className="auth-field">
                <label>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={authPassword}
                  onChange={e => setAuthPassword(e.target.value)}
                  className="auth-input"
                  required
                />
              </div>

              {authError && <div className="auth-error-banner">{authError}</div>}

              <button type="submit" className="primary-action-btn" style={{ width: '100%', marginTop: '0.5rem' }}>
                {authTab === 'login' ? 'Sign In' : 'Create Account & Continue'}
              </button>

              <div className="auth-modal-footer-note">
                Chat history and settings are automatically saved and isolated for each account.
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Round Video Avatar Frame in Bottom-Right Corner */}
      <div className={`avatar-frame-container ${avatarState}`} title={`Abhij-AI (${avatarState})`}>
        {/* Thought Bubble - Navigation to Gautam's on Google Maps */}
        <a
          href="https://www.google.com/maps/dir/?api=1&destination=22.5874109,88.4088797&destination_place_id=ChIJh89WnN11AjoR7R3ie41Ux4Q"
          target="_blank"
          rel="noopener noreferrer"
          className="avatar-thought-bubble"
          title="Start trip to Gautam's from current location"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="thought-bubble-cloud">
            <span className="thought-bubble-text">gautam&apos;s?</span>
            <Navigation size={10} className="thought-bubble-icon" />
          </span>
          <span className="thought-dot thought-dot-lg" />
          <span className="thought-dot thought-dot-sm" />
        </a>

        <div className="avatar-frame-inner">
          {/* Idle Video */}
          <video
            ref={idleVideoRef}
            src="/videos/Idle.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`avatar-video ${avatarState === 'idle' ? 'active' : ''}`}
          />
          {/* Thinking Video */}
          <video
            ref={thinkingVideoRef}
            src="/videos/Thinking.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`avatar-video ${avatarState === 'thinking' ? 'active' : ''}`}
          />
          {/* Answering Video */}
          <video
            ref={answeringVideoRef}
            src="/videos/Answering.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className={`avatar-video ${avatarState === 'answering' ? 'active' : ''}`}
          />
        </div>
        <div className="avatar-status-pill">
          <span className={`status-dot-pulse ${avatarState}`} />
          <span className="status-text">
            {avatarState === 'idle' && 'Idle'}
            {avatarState === 'thinking' && 'Thinking...'}
            {avatarState === 'answering' && 'Answering...'}
          </span>
        </div>
      </div>

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title">{lightboxImage.alt || 'Image Preview'}</span>
              <button
                className="icon-btn"
                onClick={() => setLightboxImage(null)}
                aria-label="Close preview"
              >
                <X size={18} />
              </button>
            </div>
            <div className="lightbox-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="lightbox-img"
              />
            </div>
            {lightboxImage.alt && (
              <div className="lightbox-footer">
                <span>{lightboxImage.alt}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
