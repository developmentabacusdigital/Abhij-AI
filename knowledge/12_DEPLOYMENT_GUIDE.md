# 12 — Deployment Guide

How to deploy Abhij-AI to Vercel for production hosting.

---

## 🌐 Deployment Platform: Vercel

Abhij-AI is purpose-built for **Vercel** deployment:
- Zero-config Next.js deployment
- Automatic builds on every `git push`
- Free tier: 100 GB bandwidth/month, unlimited deployments
- Built-in environment variable management
- Global CDN, automatic HTTPS, SSL

---

## 🚀 Initial Deployment (First Time)

### Method 1: Vercel Dashboard (Recommended)

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-org/Abhij-AI.git
   git push -u origin main
   ```

2. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com/) and sign in
   - Click **"Add New"** → **"Project"**
   - Select your GitHub repository from the list
   - Vercel auto-detects Next.js — click **"Deploy"**

3. **Set Environment Variables**
   - In Vercel: Go to Project Settings → Environment Variables
   - Add all required variables (see below)
   - Click **Save**

4. **Redeploy with Environment Variables**
   - Go to Deployments → Latest Deployment → Click **"..."** → **"Redeploy"**
   - Or push a new commit to trigger auto-deploy

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy (from project root)
vercel

# Follow prompts, then for production:
vercel --prod
```

---

## ⚙️ Production Environment Variables

Set all of these in **Vercel Dashboard → Project → Settings → Environment Variables:**

| Variable | Value | Required? |
|----------|-------|-----------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | ✅ For real AI |
| `OPENROUTER_MODEL` | `google/gemma-3-12b-it` | ❌ (has default) |
| `LLM_TEMPERATURE` | `0.2` | ❌ (has default) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` | ✅ Strongly recommended |
| `NEXT_PUBLIC_SITE_NAME` | `Abhij-AI` | ❌ |
| `ADMIN_PASSWORD` | Your secure passcode | ✅ Change from default! |
| `DATABASE_URL` | Neon connection string | ✅ For cloud persistence |

> ⚠️ Set `NEXT_PUBLIC_SITE_URL` to your **exact** production URL (including `https://`) for OpenGraph sharing to work correctly.

---

## 📁 Knowledge Base in Production

### The Challenge
Vercel serverless functions are read-only — you cannot write to the filesystem in production (beyond `/tmp` which is ephemeral).

### The Solution: Neon DB
- Documents uploaded via the admin panel are stored in **Neon DB** (`knowledge_documents` table)
- Initial documents in `knowledge/` directory are **bundled** with the deployment via `outputFileTracingIncludes` in `next.config.mjs`
- Uploaded documents via admin panel go to Neon DB → **persistent across deploys**

### `next.config.mjs` Knowledge Bundling
```js
experimental: {
  outputFileTracingIncludes: {
    '/api/**/*': ['./knowledge/**/*', './knowledge/*'],
  },
},
```
This ensures all `.md`, `.docx`, etc. files in `knowledge/` are included in the serverless function bundle.

### File Upload Fallback
For files uploaded in production (without Neon DB):
- Saved to `os.tmpdir()/knowledge/` (ephemeral — lost on function restart)
- ✅ **Always configure `DATABASE_URL` for production knowledge persistence**

---

## 🔄 Deployment Workflow (Ongoing)

### Auto-Deploy (Recommended)
After initial setup, every `git push` to `main` automatically triggers a Vercel deployment:

```bash
# Make code changes
git add .
git commit -m "Update: added new feature"
git push origin main
# Vercel auto-deploys within ~60 seconds
```

### Updating Knowledge Base in Production
1. Go to your production URL + `/admin`
2. Upload new documents or create markdown files
3. The changes are immediately live (no redeploy needed)

### Adding New Knowledge Files via Git
1. Add `.md` files to `knowledge/` directory
2. Commit and push to `main`
3. Vercel redeploys with new files bundled
4. On first query after deploy, files auto-seed to Neon DB

---

## 🌐 Custom Domain Setup

### Step 1: Add Domain in Vercel
1. Go to Vercel → Your Project → **Settings → Domains**
2. Click **"Add"**
3. Enter your domain: `ai.yourcompany.com` or `chat.yourcompany.com`
4. Vercel shows you the DNS records to add

### Step 2: Configure DNS
Add these records at your domain registrar (GoDaddy, Cloudflare, Namecheap, etc.):

**For apex domain (`yourcompany.com`):**
```
Type: A
Name: @
Value: 76.76.21.21
```

**For subdomain (`ai.yourcompany.com`):**
```
Type: CNAME
Name: ai
Value: cname.vercel-dns.com
```

### Step 3: Update Environment Variables
After custom domain is verified, update `NEXT_PUBLIC_SITE_URL`:
```env
NEXT_PUBLIC_SITE_URL=https://ai.yourcompany.com
```

---

## 📊 Vercel Deployment Dashboard

After deployment, you can see:
- **Build logs** — compilation output, errors
- **Function logs** — API route execution logs (including Neon DB queries)
- **Analytics** — page views, performance metrics
- **Speed Insights** — Core Web Vitals scores

Access logs at: Vercel Dashboard → Project → **Logs** tab

---

## 🛠️ Build Configuration

Vercel auto-detects these settings for Next.js:

| Setting | Value |
|---------|-------|
| **Framework** | Next.js |
| **Build Command** | `npm run build` |
| **Output Directory** | `.next` |
| **Install Command** | `npm install` |
| **Node.js Version** | 18.x |

> ⚠️ Do not change the Node.js version to below 18 — the app uses `crypto.createHash` and other Node 18 features.

---

## 🔬 Preview Deployments

Vercel creates a preview deployment for **every pull request** automatically. This is great for testing changes before merging to `main`.

Preview URLs look like:
```
https://abhij-ai-git-feature-branch-your-org.vercel.app
```

> 📝 Preview deployments share the same environment variables as production. Be careful if using the same Neon DB — test data will affect production DB.

---

## 🔥 Production Checklist

Before going live, verify:
- [ ] `OPENROUTER_API_KEY` is set and valid
- [ ] `ADMIN_PASSWORD` is changed from `admin123`
- [ ] `DATABASE_URL` is set to Neon connection string
- [ ] `NEXT_PUBLIC_SITE_URL` matches your production URL
- [ ] Knowledge base documents are uploaded or seeded
- [ ] Videos (`Idle.mp4`, `Thinking.mp4`, `Answering.mp4`) are in `public/videos/`
- [ ] `SOCIAL.png` is present in `public/` for social sharing
- [ ] Tested the chat with a real query that should return a knowledge base answer
- [ ] Tested admin panel login works with the production passcode
- [ ] Tested user registration and login

---

## ⚡ Performance Notes

| Feature | Vercel Optimization |
|---------|-------------------|
| Fonts | Loaded via `next/font` — zero CLS, self-hosted |
| Images | Next.js Image optimization (future-ready) |
| CSS | Static CSS file — cached by CDN |
| API routes | Cold start ~200ms, warm start ~30ms |
| Neon DB | Connection pooled — add `?pgbouncer=true` for high traffic |

For the Neon DB connection string, add `&pgbouncer=true` for connection pooling:
```
postgresql://user:pass@host/db?sslmode=require&pgbouncer=true
```
