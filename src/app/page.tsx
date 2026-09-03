'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Send,
  FileText,
  BookOpen,
  Sparkles,
  Trash2,
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
  Settings
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

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
    query: "What is the refund policy for Pro subscriptions?",
    context: "faq_and_policies.md",
  },
  {
    query: "What are the key features and latency of VectorStream Engine?",
    context: "product_guide.md",
  },
  {
    query: "Where are Apex Systems' office locations and what are their hours?",
    context: "company_overview.md",
  },
  {
    query: "How does the markdown knowledge base ground responses?",
    context: "faq_and_policies.md",
  }
];

/**
 * Parses raw assistant markdown to separate the main body from suggested next questions
 */
function parseAssistantResponse(rawContent: string): {
  markdownBody: string;
  suggestedQuestions: string[];
} {
  if (!rawContent) return { markdownBody: '', suggestedQuestions: [] };

  const regex = /###?\s*(?:Suggested|Related|Recommended)\s*(?:Next\s*)?Questions[:\s]*([\s\S]*?)$/i;
  const match = rawContent.match(regex);

  if (!match) {
    return { markdownBody: rawContent, suggestedQuestions: [] };
  }

  const suggestionsBlock = match[1];
  const markdownBody = rawContent.replace(regex, '').trim();

  const suggestedQuestions = suggestionsBlock
    .split('\n')
    .map(line => line.replace(/^[\s*\-–—\d.)\]>]+/, '').replace(/^\[|\]$/g, '').trim())
    .filter(line => line.length > 5 && line.length < 160 && !line.startsWith('#'));

  return { markdownBody, suggestedQuestions };
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDoc[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDoc | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load theme preference and knowledge docs on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    fetchKnowledgeDocs();
  }, [theme]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

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
                accumulatedText += delta;

                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: accumulatedText, sources }
                      : msg
                  )
                );
              } catch (parseError) {
                // non-JSON stream chunk or raw text
              }
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Chat error:', err);
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                content: `⚠️ Error: ${err.message || 'Failed to reach OpenRouter Gemma service. Please check your connection and configuration.'}`,
              }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    if (confirm('Clear the current conversation?')) {
      setMessages([]);
    }
  };

  const openDocViewer = (filename: string) => {
    const doc = knowledgeDocs.find(d => d.filename === filename);
    if (doc) {
      setSelectedDoc(doc);
    }
  };

  return (
    <div className="app-container">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Knowledge Base Drawer */}
      <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-mark">A</div>
            <div className="logo-text">
              <h1>Abhij-AI</h1>
              <span>Gemma Knowledge Base</span>
            </div>
          </div>
          <button
            className="icon-btn mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-content">
          <div className="sidebar-section">
            <h3>
              <span>Knowledge Base</span>
              <span className="badge-text">{knowledgeDocs.length} files</span>
            </h3>
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

          <div className="sidebar-section">
            <h3>System Grounding</h3>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
              Queries are mapped to local Markdown chunks. Answers are strictly synthesized
              from these documents using a moderate LLM temperature (0.2).
            </div>
          </div>
        </div>

        <div className="sidebar-footer">
          <Link href="/admin" className="sidebar-admin-btn">
            <Settings size={14} />
            <span>Manage Knowledge (Admin)</span>
          </Link>
          <div className="config-badge-group">
            <span className="config-badge" title="Active Model">
              <Cpu size={12} />
              gemma-2-9b-it
            </span>
            <span className="config-badge" title="Strict Grounding Temperature">
              <Thermometer size={12} />
              Temp: 0.2
            </span>
            <span className="config-badge" title="Strict factual alignment">
              <ShieldCheck size={12} />
              RAG Guarded
            </span>
          </div>
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
              <h2>Document Grounded Assistant</h2>
              <div className="header-status-indicator">
                <span className="status-dot" />
                <span>OpenRouter Gemma · Temperature 0.2</span>
              </div>
            </div>
          </div>

          <div className="header-actions">
            <Link href="/admin" className="header-admin-pill" title="Knowledge Base Admin Panel">
              <Settings size={14} />
              <span>Admin</span>
            </Link>
            {messages.length > 0 && (
              <button
                className="icon-btn"
                onClick={handleClearChat}
                title="Clear conversation"
                aria-label="Clear chat"
              >
                <Trash2 size={17} />
              </button>
            )}
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

        {/* Message Feed */}
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-hero">
              <div className="hero-icon">
                <BookOpen size={28} />
              </div>
              <h2>Ask Your Document Knowledge Base</h2>
              <p>
                This chatbot is strictly grounded in your repository’s local <code>.md</code>, <code>.docx</code>, and <code>.doc</code> files.
                Powered by OpenRouter's Gemma model at a moderate temperature (0.2) to prevent fabrication.
              </p>

              <div className="suggestions-grid">
                {STARTER_QUERIES.map((item, idx) => (
                  <div
                    key={idx}
                    className="suggestion-card"
                    onClick={() => handleSubmit(item.query)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="query">{item.query}</div>
                    <div className="context-hint">
                      Source doc: <code>{item.context}</code>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isAssistant = msg.role === 'assistant';
              const { markdownBody, suggestedQuestions } = isAssistant
                ? parseAssistantResponse(msg.content)
                : { markdownBody: msg.content, suggestedQuestions: [] };

              return (
                <div key={msg.id || index} className={`message-row ${msg.role}`}>
                  {isAssistant && (
                    <div className="message-avatar assistant-avatar">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div className="message-bubble">
                    {isAssistant ? (
                      <>
                        {msg.content === '' && isLoading ? (
                          <div className="typing-indicator">
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                            <span className="typing-dot" />
                          </div>
                        ) : (
                          <div className="markdown-content">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                img: ({ node, ...props }) => (
                                  <span
                                    className="doc-image-wrapper"
                                    onClick={() => setLightboxImage({ src: (props.src as string) || '', alt: (props.alt as string) || '' })}
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
                              {markdownBody}
                            </ReactMarkdown>
                          </div>
                        )}

                        {/* Source Citations */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="sources-container">
                            <span className="source-label">Referenced:</span>
                            {msg.sources.map(src => (
                              <button
                                key={src}
                                className="source-chip"
                                onClick={() => openDocViewer(src)}
                                title="Click to view full markdown document"
                              >
                                <FileText size={11} />
                                <span>{src}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Suggested Follow-up Questions */}
                        {suggestedQuestions.length > 0 && (
                          <div className="followup-container">
                            <div className="followup-header">
                              <Sparkles size={12} className="followup-icon" />
                              <span>Suggested Next Questions</span>
                            </div>
                            <div className="followup-chips">
                              {suggestedQuestions.map((question, qIdx) => (
                                <button
                                  key={qIdx}
                                  className="followup-chip"
                                  onClick={() => handleSubmit(question)}
                                  disabled={isLoading}
                                  title="Click to ask this question"
                                >
                                  <span>{question}</span>
                                  <ArrowRight size={12} className="chip-arrow" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <div>{msg.content}</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="input-dock">
          <div className="input-wrapper">
            <div className="input-box">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything based on your markdown and doc files..."
                rows={1}
                className="chat-textarea"
                disabled={isLoading}
              />
              <button
                className="send-btn"
                onClick={() => handleSubmit()}
                disabled={!input.trim() || isLoading}
                aria-label="Send query"
              >
                <Send size={16} />
              </button>
            </div>
            <div className="input-hint">
              Abhij-AI strictly references local docs (<code>.md</code>, <code>.docx</code>, <code>.doc</code>). Shift+Enter for new line.
            </div>
          </div>
        </div>
      </main>

      {/* Markdown Document Viewer Modal */}
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
                        onClick={() => setLightboxImage({ src: (props.src as string) || '', alt: (props.alt as string) || '' })}
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

      {/* Image Lightbox Modal */}
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
