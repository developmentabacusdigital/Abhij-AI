# 14 — Making Changes: Developer Guide

Everything a developer needs to know to understand, modify, and extend Abhij-AI.

---

## 🏗️ Development Prerequisites

- **Node.js 18+**
- **npm 9+**
- **VS Code** (recommended) with extensions:
  - TypeScript + ESLint
  - Tailwind CSS IntelliSense (for class hints)
  - Prisma (for SQL preview)

---

## 🛠️ Local Development Workflow

```bash
# Start dev server with hot reload
npm run dev

# TypeScript type checking
npx tsc --noEmit

# Check for lint errors
npm run lint

# Build production bundle (for testing)
npm run build && npm start
```

Changes to `.tsx`, `.ts`, `.css` files hot-reload instantly in the browser without losing state (Next.js Fast Refresh).

---

## 🎨 Changing the AI Persona & Tone

**File:** `src/lib/openrouter.ts` → `createGroundingSystemPrompt()`

The AI's personality, behavior rules, and formatting requirements are all defined in the system prompt.

### Changing the AI's Name
```typescript
// Line ~23 and ~37
return `You are Abhij-AI, a brilliant, warm...`
//             ^^^^^^^^ Change "Abhij-AI" to your custom name
```

### Adjusting Humor Frequency
```typescript
// Current: "once every 4-5 exchanges"
"Subtle Humor: Occasionally (around once every 4-5 turns when suitable)..."
// Change to "once every 8-10 exchanges" to reduce humor
// Or remove the humor guideline entirely for a more formal tone
```

### Adding Custom Instructions
Add your rules to the `STRICT GUIDELINES` section:
```typescript
return `...
STRICT GUIDELINES:
1. Humanized Explanations...
2. Subtle Humor...
3. Grounding...
...
8. [Your new rule]: [Your instruction]`
```

### Changing Suggested Questions Format
```typescript
// Current format instruction:
"7. Suggested Next Questions... Format them EXACTLY as:\n### Suggested Questions\n- [Follow-up]..."
// Change count from "2 to 3" to "3 to 5" for more suggestions
```

---

## 🔍 Modifying the Search Algorithm

**File:** `src/lib/knowledge.ts` → `searchRelevantKnowledge()`

### Return More Results
```typescript
// Line ~559: Change maxResults parameter default
export async function searchRelevantKnowledge(query: string, maxResults: number = 4)
//                                                                                ^ Change from 4 to 6 or 8
```

### Adjust Scoring Weights
```typescript
// Line ~595-618
if (lowerContent.includes(cleanQuery)) score += 10;   // exact match boost
if (lowerHeading.includes(cleanQuery)) score += 15;   // heading match boost
// ...
score += Math.min(contentMatches, 5) * 1.5;           // per-token content score
if (lowerHeading.includes(token)) score += 5;          // per-token heading score
if (lowerTitle.includes(token)) score += 3;            // per-token title score
if (lowerFilename.includes(token)) score += 2;         // per-token filename score
```

### Add Custom Stopwords
```typescript
// Line ~516-521
const STOP_WORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'a', 'an',...
  'your_custom_stopword',  // Add domain-specific stopwords here
]);
```

---

## 🎬 Changing the Video Avatar

**Videos served from:** `public/videos/`

The three video states are controlled by `avatarState` in `src/app/page.tsx`:

```typescript
const [avatarState, setAvatarState] = useState<'idle' | 'thinking' | 'answering'>('idle');

// State transitions:
setAvatarState('thinking');   // On message submit
setAvatarState('answering');  // On first token received
setAvatarState('idle');       // On stream complete
```

To change the avatar style (size, position):
```css
/* In src/app/globals.css — find .avatar-container */
.avatar-container {
  width: 120px;   /* Change size */
  height: 120px;
  bottom: 80px;   /* Distance from bottom */
  right: 24px;    /* Distance from right */
}
```

---

## 🎨 Changing the Design System

**File:** `src/app/globals.css`

All design tokens are at the top of the file as CSS variables:

```css
:root {
  /* Color palette */
  --bg-primary: #0a0a0f;           /* Main background */
  --bg-secondary: #12121a;         /* Panel backgrounds */
  --accent-primary: #7c3aed;       /* Brand purple */
  --accent-secondary: #4f46e5;     /* Indigo accent */
  --text-primary: #f1f5f9;         /* Main text color */
  --text-muted: #94a3b8;           /* Muted text */
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 48px;
  
  /* Border radius */
  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;
}
```

**Change the accent color** (affects buttons, highlights, message borders):
```css
--accent-primary: #7c3aed;   /* Purple → Change to any hex */
--accent-secondary: #4f46e5; /* Indigo → Change accordingly */
```

---

## 🤖 Switching the LLM Model

### Via Environment Variable (no code change)
```env
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5:thinking
```

### Making a Specific Model Permanent in Code
```typescript
// src/lib/openrouter.ts line ~14
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'google/gemma-3-12b-it';
//                                                       ^^^^^^^^^^^^^^^^^^^
//                                                       Change this fallback
```

### Using Claude 3.5 Sonnet (higher quality)
```env
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

### Using a Free Model
```env
OPENROUTER_MODEL=google/gemma-3-12b-it:free
```

---

## 🛠️ Adding a New API Endpoint

1. Create a new route file in `src/app/api/`:
   ```bash
   mkdir -p src/app/api/my-endpoint
   touch src/app/api/my-endpoint/route.ts
   ```

2. Write the handler:
   ```typescript
   // src/app/api/my-endpoint/route.ts
   import { NextRequest, NextResponse } from 'next/server';
   
   export async function GET(request: NextRequest) {
     return NextResponse.json({ hello: 'world' });
   }
   
   export async function POST(request: NextRequest) {
     const body = await request.json();
     return NextResponse.json({ received: body });
   }
   ```

3. Access at: `GET /api/my-endpoint`

---

## 🗄️ Adding a New Database Table

1. Edit `src/lib/db.ts` in the `initializeSchema()` function:
   ```typescript
   await sql`
     CREATE TABLE IF NOT EXISTS my_new_table (
       id SERIAL PRIMARY KEY,
       name TEXT NOT NULL,
       created_at TIMESTAMPTZ DEFAULT NOW()
     )
   `;
   ```

2. The table is auto-created on the next API call.

---

## ✏️ Modifying the Chat UI

**File:** `src/app/page.tsx`

Key React state variables:
```typescript
const [messages, setMessages] = useState<Message[]>([]);           // All messages in current chat
const [inputValue, setInputValue] = useState('');                   // Current input text
const [isLoading, setIsLoading] = useState(false);                  // Streaming in progress
const [avatarState, setAvatarState] = useState('idle');             // Avatar animation state
const [sidebarOpen, setSidebarOpen] = useState(false);              // Mobile sidebar toggle
const [currentSession, setCurrentSession] = useState<ChatSession>(); // Active session
```

Key component functions:
- `handleSubmit()` — processes message submission, streaming, state updates
- `handleNewChat()` — resets state for a new conversation
- `loadSession(session)` — loads a past conversation
- `handleDeleteSession(id)` — deletes a conversation

---

## 📦 Adding a New npm Package

```bash
npm install package-name
# Then import and use in any .ts or .tsx file
```

For Vercel deployment, packages are automatically bundled during build.

---

## 🔧 Changing the Admin Passcode Logic

**File:** `src/lib/admin-auth.ts`

```typescript
export function verifyAdminKey(key: string): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  // Tolerant matching for common password variants
  return key === adminPassword || 
         key === 'admin123' || 
         key === 'Admin@123';
         //       ^^^^^^^^^^^ Add more fallback variants here if needed
}
```

> ⚠️ Remove the hardcoded fallbacks (`admin123`, `Admin@123`) in production for maximum security. They are only there to prevent admin lockout during development.

---

## 🧪 Testing Changes

### Manual Testing Checklist
After making changes, verify:
- [ ] Chat sends and receives messages
- [ ] Streaming works (text appears token-by-token)
- [ ] Video avatar transitions correctly
- [ ] Knowledge base returns relevant answers
- [ ] Admin panel loads and can add/delete documents
- [ ] User login/register works
- [ ] Chat history saves and loads
- [ ] Mobile layout looks correct (use browser DevTools device emulation)

### Testing with Browser DevTools
```
F12 → Console tab → Check for red errors
F12 → Network tab → Check API calls return 200 OK
F12 → Application tab → Check localStorage has expected keys
F12 → Responsive Design Mode → Test mobile layouts
```

---

## 🔍 Debug Tips

### API Route Not Working
```bash
# Check Next.js terminal output for errors
# Usually shows route handler errors clearly
```

### Neon DB Query Errors
```typescript
// Add console.log before any sql`` call:
console.log('DB Query:', 'description of what you are doing');
// Check Vercel Logs → Function Logs for output
```

### Knowledge Base Not Returning Results
```typescript
// Temporary debug: Add to searchRelevantKnowledge()
console.log('Query tokens:', queryTokens);
console.log('Top 5 scored sections:', scored.slice(0, 5).map(s => ({
  heading: s.section.heading,
  score: s.score
})));
```

### OpenRouter API Errors
- Check your API key is correct and has credits
- Verify the model ID is exactly as shown on openrouter.ai
- Check the Network tab for the `/api/chat` response body error

---

## 📋 Code Style Conventions

The project follows these conventions:
- **TypeScript strict mode** — all variables typed
- **Async/await** — no raw `.then()` chains
- **Functional components** — no class components
- **CSS class naming** — BEM-like: `.component-name`, `.component-name__element`, `.component-name--modifier`
- **API routes** — always return `NextResponse.json()` with appropriate status codes
- **Error handling** — try/catch in API routes with console.error for server logs
