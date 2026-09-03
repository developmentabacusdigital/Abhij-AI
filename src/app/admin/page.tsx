'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  FileText,
  Upload,
  Plus,
  Trash2,
  Lock,
  Unlock,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Eye,
  Edit3,
  RefreshCw,
  X,
  FileCode,
  HardDrive,
  Layers,
  ZoomIn
} from 'lucide-react';

interface KnowledgeDoc {
  filename: string;
  filetype?: 'md' | 'docx' | 'doc' | 'txt';
  title: string;
  size: number;
  sectionsCount: number;
  content: string;
}

export default function AdminPage() {
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [activeTab, setActiveTab] = useState<'documents' | 'upload' | 'create'>('documents');
  
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Document creation / editing state
  const [editingFilename, setEditingFilename] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docFilename, setDocFilename] = useState('');
  const [docContent, setDocContent] = useState('');
  const [createPreviewMode, setCreatePreviewMode] = useState(false);

  // Modal states
  const [viewingDoc, setViewingDoc] = useState<KnowledgeDoc | null>(null);
  const [deletingFilename, setDeletingFilename] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check session storage for saved admin key
    const savedKey = sessionStorage.getItem('abhij_admin_key');
    if (savedKey) {
      setPasscode(savedKey);
      verifyAndLoad(savedKey);
    }
  }, []);

  const verifyAndLoad = async (keyToVerify: string) => {
    setIsLoading(true);
    setAuthError('');
    try {
      const authRes = await fetch('/api/knowledge/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': keyToVerify,
        },
        body: JSON.stringify({ passcode: keyToVerify }),
      });

      if (!authRes.ok) {
        sessionStorage.removeItem('abhij_admin_key');
        setIsAuthenticated(false);
        return;
      }

      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
        setIsAuthenticated(true);
        sessionStorage.setItem('abhij_admin_key', keyToVerify);
      } else {
        throw new Error('Failed to load documents');
      }
    } catch (err: any) {
      setAuthError('Could not connect to knowledge base service.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanKey = passcode.trim();
    if (!cleanKey) {
      setAuthError('Please enter the admin passcode.');
      return;
    }

    setIsLoading(true);
    setAuthError('');
    try {
      const authRes = await fetch('/api/knowledge/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': cleanKey,
        },
        body: JSON.stringify({ passcode: cleanKey }),
      });

      const authData = await authRes.json();
      if (!authRes.ok) {
        setAuthError(authData.error || 'Invalid admin passcode. Please check ADMIN_PASSWORD in your environment.');
        return;
      }

      const res = await fetch('/api/knowledge');
      const data = await res.json();
      setDocuments(data.documents || []);
      setIsAuthenticated(true);
      sessionStorage.setItem('abhij_admin_key', cleanKey);
      showToast('success', 'Admin session unlocked successfully');
    } catch (err) {
      setAuthError('Authentication failed. Please check network connection.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('abhij_admin_key');
    setIsAuthenticated(false);
    setPasscode('');
    showToast('success', 'Admin session locked');
  };

  const refreshDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      showToast('error', 'Failed to refresh documents list');
    } finally {
      setIsLoading(false);
    }
  };

  const showToast = (type: 'success' | 'error', text: string) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(prev => (prev?.text === text ? null : prev));
    }, 4000);
  };

  // Upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'x-admin-key': passcode,
        },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('abhij_admin_key');
          setIsAuthenticated(false);
          setAuthError('Unauthorized: Your admin passcode is invalid or has changed. Please re-enter the passcode.');
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      showToast('success', `"${file.name}" uploaded and indexed successfully!`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refreshDocuments();
      setActiveTab('documents');
    } catch (err: any) {
      showToast('error', err.message || 'File upload failed');
    } finally {
      setIsLoading(false);
    }
  };

  // Save or Update Markdown Document
  const handleSaveMarkdown = async (e: React.FormEvent) => {
    e.preventDefault();
    let filename = docFilename.trim();
    if (!filename) {
      showToast('error', 'Please provide a filename');
      return;
    }
    if (!filename.endsWith('.md') && !filename.endsWith('.markdown') && !filename.endsWith('.txt')) {
      filename = `${filename}.md`;
    }

    let finalContent = docContent;
    if (docTitle.trim() && !finalContent.startsWith('# ')) {
      finalContent = `# ${docTitle.trim()}\n\n${finalContent}`;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': passcode,
        },
        body: JSON.stringify({
          filename,
          content: finalContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('abhij_admin_key');
          setIsAuthenticated(false);
          setAuthError('Unauthorized: Your admin passcode is invalid or has changed. Please re-enter the passcode.');
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      showToast('success', `Document "${filename}" saved successfully!`);
      // Reset form
      setDocTitle('');
      setDocFilename('');
      setDocContent('');
      setEditingFilename(null);
      await refreshDocuments();
      setActiveTab('documents');
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save document');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete document
  const confirmDelete = async () => {
    if (!deletingFilename) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/knowledge?file=${encodeURIComponent(deletingFilename)}`, {
        method: 'DELETE',
        headers: {
          'x-admin-key': passcode,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          sessionStorage.removeItem('abhij_admin_key');
          setIsAuthenticated(false);
          setAuthError('Unauthorized: Your admin passcode is invalid or has changed. Please re-enter the passcode.');
          return;
        }
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      showToast('success', `"${deletingFilename}" deleted successfully!`);
      setDeletingFilename(null);
      await refreshDocuments();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to delete file');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger edit for existing markdown/text doc
  const handleEditClick = (doc: KnowledgeDoc) => {
    setEditingFilename(doc.filename);
    setDocFilename(doc.filename);
    setDocTitle(doc.title);
    setDocContent(doc.content);
    setActiveTab('create');
  };

  // Format bytes helper
  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = documents.reduce((acc, d) => acc + (d.size || 0), 0);
  const totalSections = documents.reduce((acc, d) => acc + (d.sectionsCount || 0), 0);

  // If not authenticated, render Passcode Gate
  if (!isAuthenticated) {
    return (
      <div className="admin-gate-wrapper">
        <div className="admin-gate-card">
          <div className="gate-header">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Abhij-AI.png" alt="Abhij-AI Logo" className="admin-gate-logo-img" />
          </div>

          <p className="gate-desc">
            Enter the admin passcode to manage, upload, create, and delete knowledge base documents.
          </p>

          <form onSubmit={handleLogin} className="gate-form">
            <div className="gate-input-wrapper">
              <Lock size={16} className="gate-icon" />
              <input
                type="password"
                placeholder="Enter admin passcode (default: admin123)"
                value={passcode}
                onChange={e => setPasscode(e.target.value)}
                className="gate-input"
                autoFocus
              />
            </div>

            {authError && (
              <div className="gate-error">
                <AlertCircle size={14} />
                <span>{authError}</span>
              </div>
            )}

            <button type="submit" className="gate-btn" disabled={isLoading}>
              {isLoading ? 'Verifying...' : 'Unlock Admin Panel'}
            </button>
          </form>

          <div className="gate-footer">
            <Link href="/" className="back-link">
              <ArrowLeft size={14} />
              <span>Back to Chatbot</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Admin Top Navigation */}
      <header className="admin-header">
        <div className="admin-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/Abhij-AI.png" alt="Abhij-AI Logo" className="admin-nav-logo-img" />
          <span className="admin-nav-subtitle">Knowledge Base Manager</span>
        </div>

        <div className="admin-nav-actions">
          <button
            onClick={refreshDocuments}
            className="icon-btn-text"
            title="Refresh documents list"
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-anim' : ''} />
            <span>Sync</span>
          </button>
          <Link href="/" className="icon-btn-text">
            <ArrowLeft size={14} />
            <span>Back to Chat</span>
          </Link>
          <button onClick={handleLogout} className="icon-btn-text danger" title="Lock admin session">
            <Lock size={14} />
            <span>Lock</span>
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="admin-main">
        {/* Toast Notification */}
        {statusMessage && (
          <div className={`admin-toast ${statusMessage.type}`}>
            {statusMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* Dashboard Stats */}
        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-box">
              <FileText size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{documents.length}</div>
              <div className="stat-label">Active Documents</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-box">
              <Layers size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{totalSections}</div>
              <div className="stat-label">Indexed Sections</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-box">
              <HardDrive size={20} />
            </div>
            <div className="stat-info">
              <div className="stat-value">{formatBytes(totalBytes)}</div>
              <div className="stat-label">Storage Used</div>
            </div>
          </div>
        </section>

        {/* Action Tabs Header */}
        <div className="admin-tabs">
          <button
            className={`admin-tab ${activeTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveTab('documents')}
          >
            <FileText size={16} />
            <span>All Documents ({documents.length})</span>
          </button>
          <button
            className={`admin-tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload size={16} />
            <span>Upload Document</span>
          </button>
          <button
            className={`admin-tab ${activeTab === 'create' ? 'active' : ''}`}
            onClick={() => {
              if (activeTab !== 'create') {
                setEditingFilename(null);
                setDocTitle('');
                setDocFilename('');
                setDocContent('');
              }
              setActiveTab('create');
            }}
          >
            <Plus size={16} />
            <span>{editingFilename ? `Edit "${editingFilename}"` : 'Write Markdown'}</span>
          </button>
        </div>

        {/* TAB 1: ALL DOCUMENTS LIST */}
        {activeTab === 'documents' && (
          <div className="tab-content">
            <div className="search-bar-row">
              <div className="search-input-box">
                <Search size={15} color="var(--text-muted)" />
                <input
                  type="text"
                  placeholder="Filter documents by name or title..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="icon-btn-subtle">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="search-count">
                Showing {filteredDocuments.length} of {documents.length} docs
              </div>
            </div>

            {filteredDocuments.length === 0 ? (
              <div className="empty-state-box">
                <FileCode size={36} />
                <h3>No Documents Found</h3>
                <p>
                  {searchQuery
                    ? `No files matched "${searchQuery}". Try a different keyword.`
                    : 'Your knowledge base is empty. Upload or create your first document.'}
                </p>
                <button className="primary-action-btn" onClick={() => setActiveTab('upload')}>
                  <Upload size={16} />
                  <span>Upload Document</span>
                </button>
              </div>
            ) : (
              <div className="docs-table-wrapper">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Sections</th>
                      <th>Size</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDocuments.map(doc => (
                      <tr key={doc.filename}>
                        <td>
                          <div className="table-doc-title">{doc.title}</div>
                          <div className="table-doc-filename">{doc.filename}</div>
                        </td>
                        <td>
                          <span className="doc-type-pill">
                            {doc.filetype ? doc.filetype.toUpperCase() : 'DOC'}
                          </span>
                        </td>
                        <td>{doc.sectionsCount}</td>
                        <td>{formatBytes(doc.size)}</td>
                        <td>
                          <div className="table-actions">
                            <button
                              onClick={() => setViewingDoc(doc)}
                              className="action-pill-btn"
                              title="Inspect content"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </button>
                            {(!doc.filetype || doc.filetype === 'md' || doc.filetype === 'txt') && (
                              <button
                                onClick={() => handleEditClick(doc)}
                                className="action-pill-btn"
                                title="Edit markdown"
                              >
                                <Edit3 size={13} />
                                <span>Edit</span>
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingFilename(doc.filename)}
                              className="action-pill-btn danger"
                              title="Delete document"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UPLOAD DOCUMENT */}
        {activeTab === 'upload' && (
          <div className="tab-content upload-tab-content">
            <div
              className="dropzone-box"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,.markdown,.docx,.doc,.txt"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <div className="dropzone-icon">
                <Upload size={32} />
              </div>
              <h3>Click to select or drag document here</h3>
              <p>
                Supported formats: <strong>.md</strong>, <strong>.markdown</strong>, <strong>.docx</strong>, <strong>.doc</strong>, <strong>.txt</strong>
              </p>
              <span className="dropzone-hint">
                Files are automatically indexed into the Abhij-AI retrieval engine upon upload.
              </span>
            </div>

            <div className="upload-tips-card">
              <h4>Knowledge Document Best Practices</h4>
              <ul>
                <li>Use clean headers (`#`, `##`, `###`) to create logical section boundaries.</li>
                <li>Word (`.docx`) files with embedded diagrams are automatically extracted.</li>
                <li>Factual, concise descriptions result in the highest retrieval accuracy.</li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: WRITE / EDIT MARKDOWN */}
        {activeTab === 'create' && (
          <div className="tab-content create-tab-content">
            <form onSubmit={handleSaveMarkdown} className="markdown-editor-form">
              <div className="editor-top-bar">
                <div className="editor-field">
                  <label>Document Title</label>
                  <input
                    type="text"
                    placeholder="e.g., Return & Warranty Policy"
                    value={docTitle}
                    onChange={e => {
                      setDocTitle(e.target.value);
                      if (!editingFilename) {
                        const slug = e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]+/g, '_')
                          .replace(/^_+|_+$/g, '');
                        if (slug) setDocFilename(`${slug}.md`);
                      }
                    }}
                    className="admin-input"
                  />
                </div>

                <div className="editor-field">
                  <label>Filename</label>
                  <input
                    type="text"
                    placeholder="e.g., return_policy.md"
                    value={docFilename}
                    onChange={e => setDocFilename(e.target.value)}
                    className="admin-input"
                    disabled={!!editingFilename}
                  />
                </div>
              </div>

              <div className="editor-mode-toggle">
                <button
                  type="button"
                  className={`subtab-btn ${!createPreviewMode ? 'active' : ''}`}
                  onClick={() => setCreatePreviewMode(false)}
                >
                  Edit Markdown
                </button>
                <button
                  type="button"
                  className={`subtab-btn ${createPreviewMode ? 'active' : ''}`}
                  onClick={() => setCreatePreviewMode(true)}
                >
                  Live Preview
                </button>
              </div>

              {!createPreviewMode ? (
                <textarea
                  placeholder="Write markdown content here... (Headers, bullet lists, code blocks, tables supported)"
                  value={docContent}
                  onChange={e => setDocContent(e.target.value)}
                  className="admin-textarea"
                  rows={16}
                />
              ) : (
                <div className="markdown-preview-pane">
                  {docContent.trim() ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {docContent}
                    </ReactMarkdown>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Start typing to see live markdown preview...
                    </div>
                  )}
                </div>
              )}

              <div className="editor-actions">
                <button
                  type="button"
                  className="action-pill-btn"
                  onClick={() => {
                    setActiveTab('documents');
                    setEditingFilename(null);
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-action-btn" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingFilename ? 'Update Document' : 'Save Document'}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* DOCUMENT PREVIEW MODAL */}
      {viewingDoc && (
        <div className="modal-overlay" onClick={() => setViewingDoc(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <FileText size={18} />
                <span>{viewingDoc.filename}</span>
              </h3>
              <button
                className="icon-btn"
                onClick={() => setViewingDoc(null)}
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
                  {viewingDoc.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingFilename && (
        <div className="modal-overlay" onClick={() => setDeletingFilename(null)}>
          <div className="modal-content" style={{ maxWidth: '440px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ color: 'var(--text-primary)' }}>Delete Document?</h3>
              <button className="icon-btn" onClick={() => setDeletingFilename(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.25rem 1.5rem' }}>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Are you sure you want to permanently delete <strong>{deletingFilename}</strong> from the knowledge base?
              </p>
              <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="action-pill-btn"
                  onClick={() => setDeletingFilename(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="primary-action-btn danger"
                  onClick={confirmDelete}
                  disabled={isLoading}
                >
                  {isLoading ? 'Deleting...' : 'Confirm Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
          <div className="lightbox-content" onClick={e => e.stopPropagation()}>
            <div className="lightbox-header">
              <span className="lightbox-title">{lightboxImage.alt || 'Image Preview'}</span>
              <button className="icon-btn" onClick={() => setLightboxImage(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="lightbox-body">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightboxImage.src} alt={lightboxImage.alt} className="lightbox-img" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
