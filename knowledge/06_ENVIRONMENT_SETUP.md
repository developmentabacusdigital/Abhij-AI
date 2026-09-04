# 06 — Environment Setup (Local Development)

Step-by-step guide to run Abhij-AI locally on your machine.

---

## ✅ Prerequisites

Before starting, ensure you have the following installed:

| Tool | Minimum Version | Check |
|------|----------------|-------|
| **Node.js** | 18.x or higher | `node --version` |
| **npm** | 9.x or higher | `npm --version` |
| **Git** | Any recent version | `git --version` |

> Download Node.js from [nodejs.org](https://nodejs.org/) (LTS version recommended).

---

## 🚀 Step 1: Clone the Repository

```bash
git clone https://github.com/developmentabacusdigital/Abhij-AI.git
cd Abhij-AI
```

---

## 📦 Step 2: Install Dependencies

```bash
npm install
```

This installs all packages defined in `package.json`, including Next.js, React, mammoth, OpenRouter SDK, Neon DB client, etc.

---

## ⚙️ Step 3: Configure Environment Variables

Copy the example environment file and edit it:

```bash
# Copy the template
cp .env.example .env.local
```

Now open `.env.local` in any text editor and set the values:

```env
# OpenRouter API Key (get from https://openrouter.ai/keys)
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Model to use (any model listed on openrouter.ai)
OPENROUTER_MODEL=google/gemma-3-12b-it

# Response temperature (0.0 strict to 1.0 creative)
LLM_TEMPERATURE=0.2

# Your local URL (keep this for local dev)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_NAME=Abhij-AI

# Admin panel passcode (change to something secure)
ADMIN_PASSWORD=admin123

# Neon DB (optional, leave empty for local mode)
DATABASE_URL=
```

> 💡 **The app works without an OpenRouter API key!** It falls back to a built-in demo mode that reads from local `.md` files and simulates streaming. Great for development.

---

## 🎬 Step 4: Set Up Videos (Optional)

The video avatar requires three video files:

1. Place your videos at these exact paths:
   - `public/videos/Idle.mp4`
   - `public/videos/Thinking.mp4`
   - `public/videos/Answering.mp4`

2. If the `Videos/` folder contains them at the project root, copy them:
   ```bash
   # Windows
   xcopy /Y Videos\*.mp4 public\videos\
   
   # Mac/Linux
   cp Videos/*.mp4 public/videos/
   ```

> 📝 If videos are missing, the avatar area will show a black box. The chat functionality is completely unaffected.

---

## 📚 Step 5: Add Knowledge Base Documents

Place your documents in the `knowledge/` directory:

```bash
# Add a markdown file
echo "# My Document\nThis is content" > knowledge/my-doc.md

# Or simply copy any .md, .docx, .doc, or .txt files
cp /path/to/your/documents/* knowledge/
```

The app automatically picks up all documents in this folder — no restart needed for `.md` and `.txt` files. For `.docx` files with images, they are parsed on the first request.

---

## ▶️ Step 6: Start the Development Server

```bash
npm run dev
```

The app will start at **http://localhost:3000**.

You should see:
```
  ▲ Next.js 14.x.x
  - Local:        http://localhost:3000
  - Environments: .env.local

 ✓ Starting...
 ✓ Ready in 2.3s
```

---

## 🔍 Step 7: Verify the Setup

1. **Open** `http://localhost:3000` — you should see the Abhij-AI chat interface
2. **Type a message** like "hello" — the avatar should animate and you should get a response
3. **Check Admin Panel** at `http://localhost:3000/admin` — use the passcode from `ADMIN_PASSWORD`
4. **Test a knowledge query** — type something related to your knowledge documents

---

## 🗄️ Optional: Connect Neon DB

If you want cloud-synced accounts and chat history:

1. Create a free account at [neon.tech](https://neon.tech/)
2. Create a new database project
3. Copy the **Connection String** from the Neon dashboard (looks like `postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require`)
4. Paste it into `.env.local`:
   ```env
   DATABASE_URL=postgresql://user:pass@xxx.neon.tech/dbname?sslmode=require
   ```
5. Restart the dev server — the schema is **automatically created on first run**

> 📖 Full Neon setup: See [11_DATABASE_GUIDE.md](./11_DATABASE_GUIDE.md)

---

## 🛠️ Available npm Scripts

| Script | Command | Description |
|--------|---------|-------------|
| **Development** | `npm run dev` | Start dev server with hot reload |
| **Build** | `npm run build` | Build for production |
| **Start** | `npm run start` | Start production server |
| **Type Check** | `npm run lint` | TypeScript + ESLint checks |

---

## 🚨 Common First-Run Issues

| Issue | Solution |
|-------|----------|
| `Error: Cannot find module` | Run `npm install` again |
| Port 3000 already in use | `npm run dev -- --port 3001` |
| `OPENROUTER_API_KEY not set` | Fine! App runs in demo mode |
| Videos not playing | Copy from `Videos/` to `public/videos/` |
| Knowledge docs not found | Ensure they are in `knowledge/` directory |
| Admin panel returns 401 | Check `ADMIN_PASSWORD` in `.env.local` |

> 📖 For more troubleshooting, see [15_TROUBLESHOOTING.md](./15_TROUBLESHOOTING.md)
