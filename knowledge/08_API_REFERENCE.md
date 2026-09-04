# 08 — API Reference

Complete documentation for every HTTP API endpoint in Abhij-AI.

---

## Base URL

| Environment | Base URL |
|-------------|----------|
| Local | `http://localhost:3000` |
| Production | `https://your-vercel-app.vercel.app` |

---

## 🔒 Authentication Headers

### Admin Routes
Most knowledge management endpoints require the admin passcode:

```http
x-admin-key: <ADMIN_PASSWORD value from .env.local>
```

### User Routes
Chat history endpoints require the userId as a query parameter:

```http
GET /api/chats?userId=<username>
```

---

## 💬 Chat API

### `POST /api/chat`

Sends a user message and streams the AI response.

**Request:**
```http
POST /api/chat
Content-Type: application/json

{
  "messages": [
    { "role": "user", "content": "What is the refund policy?" },
    { "role": "assistant", "content": "Previous response..." },
    { "role": "user", "content": "Can I get a full refund?" }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `messages` | Array | Full conversation history including current message |
| `messages[].role` | `"user"` or `"assistant"` | Message author |
| `messages[].content` | string | Message text |

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: text/event-stream
X-Sources: ["document.md", "report.docx"]
X-Is-Greeting: false

data: {"choices":[{"delta":{"content":"Based "}}]}
data: {"choices":[{"delta":{"content":"on the "}}]}
data: {"choices":[{"delta":{"content":"documents..."}}]}
data: [DONE]
```

| Header | Description |
|--------|-------------|
| `X-Sources` | JSON array of filenames used to answer the query |
| `X-Is-Greeting` | `"true"` if the query was detected as a greeting |

**SSE Data Format (each line):**
```json
{
  "choices": [
    {
      "delta": {
        "content": "token"
      }
    }
  ]
}
```

**Error Responses:**
| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "No messages provided" }` | Empty messages array |
| `500` | `{ "error": "LLM streaming failed" }` | OpenRouter API error |

---

## 📚 Knowledge Base API

### `GET /api/knowledge`

Lists all knowledge base documents.

**Request:**
```http
GET /api/knowledge
x-admin-key: admin123
```

**Response:**
```json
{
  "documents": [
    {
      "filename": "my-doc.md",
      "filetype": "md",
      "title": "My Document",
      "content": "# My Document\n\nContent here...",
      "size": 1024,
      "sectionsCount": 5
    }
  ]
}
```

---

### `POST /api/knowledge`

Uploads a new document to the knowledge base.

**Request (File upload):**
```http
POST /api/knowledge
x-admin-key: admin123
Content-Type: multipart/form-data

file: <binary file data>
```

Supported file types: `.md`, `.txt`, `.docx`, `.doc`

**Request (Create Markdown):**
```http
POST /api/knowledge
x-admin-key: admin123
Content-Type: application/json

{
  "filename": "new-article.md",
  "content": "# New Article\n\nContent here..."
}
```

**Response:**
```json
{
  "success": true,
  "filename": "new-article.md",
  "message": "Document saved successfully"
}
```

**Error Responses:**
| Status | Body | Cause |
|--------|------|-------|
| `401` | `{ "error": "Unauthorized" }` | Wrong or missing admin key |
| `400` | `{ "error": "No file or content provided" }` | Missing payload |
| `415` | `{ "error": "Unsupported file type" }` | Invalid file extension |

---

### `DELETE /api/knowledge`

Deletes a document from the knowledge base.

**Request:**
```http
DELETE /api/knowledge
x-admin-key: admin123
Content-Type: application/json

{
  "filename": "old-doc.md"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Document deleted"
}
```

---

### `POST /api/knowledge/auth`

Verifies an admin passcode.

**Request:**
```http
POST /api/knowledge/auth
Content-Type: application/json

{
  "password": "admin123"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Authentication successful"
}
```

**Response (failure):**
```json
{
  "success": false,
  "error": "Invalid password"
}
```

---

### `GET /api/knowledge/media`

Serves an extracted image from a `.docx` document.

**Request:**
```http
GET /api/knowledge/media?doc=Abacus%20Framer%20Site%20Document&img=image_1.png
```

| Query Param | Description |
|-------------|-------------|
| `doc` | Document name (without `.docx` extension) |
| `img` | Image filename (e.g., `image_1.png`) |

**Response:**
```http
HTTP/1.1 200 OK
Content-Type: image/png

<binary image data>
```

**Error Responses:**
| Status | Cause |
|--------|-------|
| `400` | Missing `doc` or `img` parameter |
| `404` | Image not found |

---

## 👤 Authentication API

### `POST /api/auth/register`

Creates a new user account.

**Request:**
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "john_doe",
  "password": "mySecurePassword"
}
```

**Response (success):**
```json
{
  "success": true,
  "user": {
    "username": "john_doe",
    "createdAt": 1725196800000
  }
}
```

**Error Responses:**
| Status | Body | Cause |
|--------|------|-------|
| `400` | `{ "error": "Username and password required" }` | Missing fields |
| `400` | `{ "error": "Username already taken" }` | Duplicate username |
| `400` | `{ "error": "Username must be 3-32 alphanumeric characters" }` | Invalid format |
| `400` | `{ "error": "Password must be at least 6 characters" }` | Short password |

---

### `POST /api/auth/login`

Authenticates a user.

**Request:**
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "john_doe",
  "password": "mySecurePassword"
}
```

**Response (success):**
```json
{
  "success": true,
  "user": {
    "username": "john_doe",
    "createdAt": 1725196800000
  }
}
```

**Error Responses:**
| Status | Body | Cause |
|--------|------|-------|
| `401` | `{ "error": "Invalid username or password" }` | Wrong credentials |
| `400` | `{ "error": "Username and password required" }` | Missing fields |

---

## 🗃️ Chat History API

### `GET /api/chats`

Fetches all chat sessions for a user.

**Request:**
```http
GET /api/chats?userId=john_doe
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "chat_abc123_1725196800000",
      "title": "Refund Policy Questions",
      "createdAt": 1725196800000,
      "updatedAt": 1725200000000,
      "messages": [
        {
          "id": "msg_xyz_1725196810000",
          "role": "user",
          "content": "What is the refund policy?",
          "sources": [],
          "suggestedQuestions": [],
          "createdAt": 1725196810000
        }
      ]
    }
  ]
}
```

---

### `POST /api/chats`

Creates or updates a chat session.

**Request:**
```http
POST /api/chats
Content-Type: application/json

{
  "session": {
    "id": "chat_abc123_1725196800000",
    "userId": "john_doe",
    "title": "My Chat Session",
    "createdAt": 1725196800000,
    "updatedAt": 1725200000000,
    "messages": [...]
  }
}
```

**Response:**
```json
{
  "success": true
}
```

---

### `PATCH /api/chats/[id]`

Updates a specific session (add messages, rename title).

**Request:**
```http
PATCH /api/chats/chat_abc123_1725196800000
Content-Type: application/json

{
  "title": "Renamed Chat Title"
}
```

or to add a message:
```json
{
  "message": {
    "id": "msg_new_001",
    "role": "user",
    "content": "New question",
    "sources": [],
    "suggestedQuestions": [],
    "createdAt": 1725200000000
  }
}
```

---

### `DELETE /api/chats/[id]`

Deletes a chat session and all its messages.

**Request:**
```http
DELETE /api/chats/chat_abc123_1725196800000?userId=john_doe
```

**Response:**
```json
{
  "success": true
}
```

---

## 🔧 Admin Utility API

### `GET /api/admin/db-status`

Returns the Neon DB connection status and table row counts.

**Request:**
```http
GET /api/admin/db-status
x-admin-key: admin123
```

**Response (DB connected):**
```json
{
  "connected": true,
  "engine": "Neon PostgreSQL",
  "tables": {
    "users": 42,
    "chat_sessions": 157,
    "chat_messages": 1204,
    "knowledge_documents": 8
  }
}
```

**Response (No DB):**
```json
{
  "connected": false,
  "engine": "Browser localStorage",
  "tables": null
}
```
