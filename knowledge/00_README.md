# 📖 Abhij-AI — Project Overview & Index

> **Abhij-AI** is a fully self-hosted, cloud-deployable **AI Knowledge Assistant** that answers user questions strictly from an uploaded knowledge base (Markdown files, Word documents). It is powered by **Next.js 14**, **OpenRouter LLM APIs**, a **Neon Serverless PostgreSQL** database, and a real-time streaming chat interface with a video avatar.

---

## 🗂️ Documentation Index

This folder contains the complete handover documentation for the Abhij-AI project.

| # | File | Contents |
|---|------|----------|
| 1 | **[01_PROJECT_OVERVIEW.md](./01_PROJECT_OVERVIEW.md)** | Project summary, goals, features |
| 2 | **[02_TECH_STACK.md](./02_TECH_STACK.md)** | Full technology stack breakdown |
| 3 | **[03_ARCHITECTURE.md](./03_ARCHITECTURE.md)** | System architecture, data flows, diagrams |
| 4 | **[04_FILE_STRUCTURE.md](./04_FILE_STRUCTURE.md)** | Every file and directory explained |
| 5 | **[05_HOW_IT_WORKS.md](./05_HOW_IT_WORKS.md)** | Step-by-step technical explanation of request flow |
| 6 | **[06_ENVIRONMENT_SETUP.md](./06_ENVIRONMENT_SETUP.md)** | Local development setup guide |
| 7 | **[07_ENVIRONMENT_VARIABLES.md](./07_ENVIRONMENT_VARIABLES.md)** | All environment variables documented |
| 8 | **[08_API_REFERENCE.md](./08_API_REFERENCE.md)** | Full API endpoint documentation |
| 9 | **[09_KNOWLEDGE_BASE_GUIDE.md](./09_KNOWLEDGE_BASE_GUIDE.md)** | How to manage knowledge base documents |
| 10 | **[10_ADMIN_PANEL_GUIDE.md](./10_ADMIN_PANEL_GUIDE.md)** | Admin panel usage guide |
| 11 | **[11_DATABASE_GUIDE.md](./11_DATABASE_GUIDE.md)** | Neon DB setup and schema reference |
| 12 | **[12_DEPLOYMENT_GUIDE.md](./12_DEPLOYMENT_GUIDE.md)** | Vercel deployment, custom domains, env config |
| 13 | **[13_USER_GUIDE.md](./13_USER_GUIDE.md)** | End-user guide (chat, accounts, history) |
| 14 | **[14_MAKING_CHANGES.md](./14_MAKING_CHANGES.md)** | Developer guide to modifying the project |
| 15 | **[15_TROUBLESHOOTING.md](./15_TROUBLESHOOTING.md)** | Common problems and how to fix them |

---

## ⚡ Quick Reference

| Item | Value |
|------|-------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **LLM Provider** | OpenRouter.ai |
| **Default Model** | `google/gemma-3-12b-it` |
| **Database** | Neon Serverless PostgreSQL |
| **Deployment** | Vercel |
| **GitHub Repo** | https://github.com/developmentabacusdigital/Abhij-AI |
| **Admin Panel** | `/admin` (passcode-protected) |
| **Default Admin Passcode** | `admin123` |

---

## 🚀 5-Minute Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/developmentabacusdigital/Abhij-AI.git
cd Abhij-AI

# 2. Install dependencies
npm install

# 3. Copy environment file and fill in values
cp .env.example .env.local
# Edit .env.local with your OPENROUTER_API_KEY

# 4. Start development server
npm run dev

# 5. Open the app
# http://localhost:3000
```

> 📝 The app works **without an OpenRouter API key** using a built-in demo fallback mode.
