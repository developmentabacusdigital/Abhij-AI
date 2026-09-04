# 07 — Environment Variables Reference

Complete documentation for every environment variable used by Abhij-AI.

---

## 📄 Environment File Location

| Environment | File |
|-------------|------|
| Local development | `.env.local` (at project root) |
| Vercel production | Vercel Dashboard → Project Settings → Environment Variables |

> ⚠️ **Never commit `.env.local` to Git.** It is listed in `.gitignore`. Your API keys would be exposed publicly.

---

## 🔑 All Environment Variables

### `OPENROUTER_API_KEY`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No (app runs in demo mode without it) |
| **Type** | String |
| **Format** | `your_openrouter_api_key` |
| **Where to get** | https://openrouter.ai/keys |

**What it does:**
- The API key for the OpenRouter LLM gateway.
- When missing or blank, the app runs in **demo mode**: it pulls context from knowledge documents and returns a simulated streaming response (no real AI generation).
- When present, all queries are processed by the configured LLM model via OpenRouter's API.

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

---

### `OPENROUTER_MODEL`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No |
| **Default** | `google/gemma-3-12b-it` |
| **Type** | String (model ID from openrouter.ai) |

**What it does:**
- Specifies which LLM model to use for generating responses.
- Can be any model supported by OpenRouter. Browse models at [openrouter.ai/models](https://openrouter.ai/models).

**Popular options:**
| Model ID | Description |
|----------|-------------|
| `google/gemma-3-12b-it` | Default. Fast, good quality, low cost |
| `anthropic/claude-sonnet-4-5:thinking` | Claude Sonnet with extended thinking |
| `anthropic/claude-3.5-sonnet` | Excellent quality, slightly higher cost |
| `openai/gpt-4o-mini` | OpenAI GPT-4o mini, good balance |
| `meta-llama/llama-3.1-70b-instruct` | Open-source Llama 3.1 70B |
| `google/gemini-flash-1.5` | Google Gemini Flash, very fast |
| `mistralai/mixtral-8x7b-instruct` | Good open-source model |

```env
OPENROUTER_MODEL=google/gemma-3-12b-it
```

---

### `LLM_TEMPERATURE`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No |
| **Default** | `0.2` |
| **Type** | Float (0.0 to 1.0) |

**What it does:**
- Controls the randomness/creativity of AI responses.
- **Lower values (0.0–0.3):** More deterministic, strictly factual, closely follows the source documents.
- **Higher values (0.7–1.0):** More creative, varied responses, higher chance of going off-document.
- `0.2` is the sweet spot for a knowledge base assistant: mostly grounded with slight fluency variation.

```env
LLM_TEMPERATURE=0.2
```

---

### `NEXT_PUBLIC_SITE_URL`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No (but recommended for production) |
| **Default** | `http://localhost:3000` |
| **Type** | URL string |
| **Client-visible?** | ✅ Yes (prefix `NEXT_PUBLIC_` makes it available in browser) |

**What it does:**
- Used as the `HTTP-Referer` header in OpenRouter API calls (for billing attribution).
- Used as the base URL for OpenGraph metadata, canonical URLs, etc.
- **In production**, set this to your Vercel deployment URL:

```env
NEXT_PUBLIC_SITE_URL=https://abhij-ai.vercel.app
```

---

### `NEXT_PUBLIC_SITE_NAME`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No |
| **Default** | `Abhij-AI Markdown Chatbot` |
| **Type** | String |
| **Client-visible?** | ✅ Yes |

**What it does:**
- Used as the `X-Title` header in OpenRouter API calls (identifies your app to OpenRouter).
- Used in SEO metadata.

```env
NEXT_PUBLIC_SITE_NAME=Abhij-AI
```

---

### `ADMIN_PASSWORD`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No |
| **Default** | `admin123` |
| **Type** | String |

**What it does:**
- The passcode required to access the Admin Panel at `/admin`.
- Entered by the admin in the passcode gate UI.
- Stored in `sessionStorage` (clears on browser close) after successful verification.
- The `/api/knowledge` endpoints require this in the `x-admin-key` header.

> ⚠️ **Change this to something secure in production!** The default `admin123` is insecure.

```env
ADMIN_PASSWORD=MySecureAdminPasscode2025!
```

> 📝 **Note:** The server tolerates both `admin123` and `Admin@123` as valid passcodes as a fallback safety net to prevent admin lockout.

---

### `DATABASE_URL`

| Property | Value |
|----------|-------|
| **Required?** | ❌ No (but strongly recommended for production) |
| **Default** | Empty (uses localStorage fallback) |
| **Type** | PostgreSQL connection string |

**What it does:**
- When set, enables **Neon Serverless PostgreSQL** integration:
  - User accounts are stored in the `users` table
  - Chat sessions are stored in `chat_sessions`
  - Chat messages are stored in `chat_messages`
  - Knowledge base documents are stored in `knowledge_documents`
- When empty, all data falls back to browser `localStorage` (data is lost when browser storage is cleared).

**Format:**
```
postgresql://<user>:<password>@<host>/<database>?sslmode=require
```

**Example:**
```env
DATABASE_URL=postgresql://neondb_owner:xyz123@ep-cold-river-a1bcde23.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> 📖 See [11_DATABASE_GUIDE.md](./11_DATABASE_GUIDE.md) for full setup instructions.

---

## 📋 Complete `.env.example` Template

This is the template file committed to the repository (safe to share, has no real secrets):

```env
# OpenRouter API Configuration
# Add your OpenRouter API key below. If left empty, the application will provide an interactive
# fallback demo answering directly from the Markdown Knowledge Base!
OPENROUTER_API_KEY=

# Default to Google Gemma 3 12B model on OpenRouter
OPENROUTER_MODEL=google/gemma-3-12b-it

# Moderate temperature to ensure document grounding without hallucination
LLM_TEMPERATURE=0.2

NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Abhij-AI

# Admin Panel Access Passcode
ADMIN_PASSWORD=admin123

# Neon Serverless PostgreSQL Database URL (Optional: enables cross-device accounts & cloud chat history sync)
# Paste your Neon connection string from https://neon.tech below:
DATABASE_URL=
```

---

## 🔐 Security Notes

1. **Never put `DATABASE_URL` or `OPENROUTER_API_KEY` in the code** — always use `.env.local`.
2. **Vercel encrypts** environment variables at rest. Safe to store there.
3. **Rotate your `OPENROUTER_API_KEY`** if it is ever accidentally committed to Git.
4. **Set a strong `ADMIN_PASSWORD`** in production — this controls who can modify your knowledge base.
5. **`NEXT_PUBLIC_` variables** are bundled into the client-side JavaScript and are visible in the browser — never put secrets in these.
