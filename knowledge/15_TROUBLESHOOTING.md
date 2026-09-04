# 15 — Troubleshooting Guide

Solutions to the most common problems encountered with Abhij-AI.

---

## 🟢 Installation & Startup Issues

### `Error: Cannot find module 'next'` or similar
```bash
# Solution: Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### `Error: Port 3000 is already in use`
```bash
# Run on a different port
npm run dev -- --port 3001

# Or kill the existing process
# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:3000 | xargs kill -9
```

### `Module not found: mammoth / word-extractor`
```bash
npm install mammoth word-extractor
```

### TypeScript compilation errors on `npm run build`
```bash
# Run type check to see all errors
npx tsc --noEmit
# Fix the reported errors, then rebuild
```

---

## 💬 Chat Not Working

### AI responds with "demo mode" messages instead of real AI answers

**Cause:** `OPENROUTER_API_KEY` is not set or is invalid.

**Fix:**
1. Check `.env.local` has `OPENROUTER_API_KEY=your_api_key`
2. Verify the key is valid at [openrouter.ai/keys](https://openrouter.ai/keys)
3. Restart the dev server after changing `.env.local`

### AI responses are empty / blank

**Cause:** The model might have returned an empty response.

**Fix:**
1. Check Vercel logs (or terminal for local) for error messages
2. Try a different model:
   ```env
   OPENROUTER_MODEL=google/gemini-flash-1.5
   ```
3. Check your OpenRouter account has sufficient credits

### Chat sends but never loads a response (spinner forever)

**Cause:** API route is hanging or timing out.

**Fix:**
1. Open browser DevTools → Network tab
2. Find the `/api/chat` request
3. Check the Status Code:
   - `500`: Server error — check Vercel/terminal logs
   - `401`: OpenRouter auth failed — check API key
   - `504`: Timeout — the model took too long, try a faster model like `google/gemini-flash-1.5`

### "I couldn't find information regarding this in the current knowledge base"

**Cause:** The query tokens didn't match any document sections with score > 0.

**Fix:**
1. Verify documents are in the `knowledge/` directory
2. Check the admin panel shows documents (go to `/admin`)
3. Try rephrasing the question using words from the document headings
4. Add more specific headings to your documents

---

## 🔐 Authentication Issues

### "Invalid username or password" when credentials are correct

**Cause (with Neon DB):** User may exist in localStorage but not in Neon DB, or vice versa.

**Fix:**
1. Go to Neon Dashboard → SQL Editor
2. Run: `SELECT * FROM users WHERE username = 'your_username';`
3. If the user doesn't exist in DB, register again
4. Clear browser localStorage: DevTools → Application → Local Storage → Clear All

### Admin panel returns 401 Unauthorized

**Cause:** Admin password mismatch.

**Fix:**
1. Check `ADMIN_PASSWORD` in `.env.local` (or Vercel env vars)
2. The app also accepts `admin123` and `Admin@123` as fallback passcodes
3. Try all three: your configured password, `admin123`, `Admin@123`
4. Restart the server after changing `ADMIN_PASSWORD`

### Session lost after page refresh

**Cause:** localStorage was cleared, or the browser is in private/incognito mode.

**Fix:**
- For permanent sessions, register a user account and ensure `DATABASE_URL` is configured
- Avoid using private browsing mode if persistent sessions are needed

---

## 🗄️ Database Issues

### "DATABASE_URL is not set" warning in logs

**Cause:** `DATABASE_URL` environment variable is not configured.

**Fix:** This is expected if you're running in local mode. To enable cloud persistence, see [11_DATABASE_GUIDE.md](./11_DATABASE_GUIDE.md).

### Neon DB connection error: `connection refused` or `ECONNREFUSED`

**Cause:** Invalid connection string or network issue.

**Fix:**
1. Verify the `DATABASE_URL` format: `postgresql://user:pass@host/db?sslmode=require`
2. Ensure the Neon project is active (not suspended) — free tier suspends after inactivity
3. Try the **Pooled Connection** URL from Neon dashboard instead of direct connection

### Neon DB error: `SSL connection required`

**Fix:** Add `?sslmode=require` to the end of your connection string:
```env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

### Tables not being created automatically

**Cause:** Database URL is set but `initializeSchema()` failed.

**Fix:**
1. Check terminal/Vercel logs for SQL errors during startup
2. Ensure your Neon user has `CREATE TABLE` permissions (default role does)
3. Manually create tables via Neon SQL Editor using the schema in [11_DATABASE_GUIDE.md](./11_DATABASE_GUIDE.md)

---

## 📚 Knowledge Base Issues

### Documents not appearing in admin panel

**Cause 1:** Files are not in the `knowledge/` directory.
```bash
ls knowledge/   # Verify your files are here
```

**Cause 2:** File extension not supported.
- Supported: `.md`, `.markdown`, `.txt`, `.docx`, `.doc`
- Not supported: `.pdf`, `.xlsx`, `.pptx`

**Cause 3:** Files start with `.` (hidden files).
```bash
# Remove the dot prefix from the filename
mv knowledge/.hidden-doc.md knowledge/hidden-doc.md
```

### `.docx` images not rendering

**Cause:** Extracted images haven't been generated yet, or the `public/knowledge-media/` directory doesn't exist.

**Fix:**
1. Ensure the `public/` directory is writable
2. Make a query that references the document — images extract on first use
3. Check `public/knowledge-media/<DocName>/` for extracted images
4. If directory is empty, check Vercel/terminal logs for mammoth extraction errors

### AI answers from wrong document / mixing up documents

**Cause:** Multiple documents have similar content, leading to ambiguous scoring.

**Fix:**
1. Make section headings more distinct between documents
2. Remove overlapping content across files
3. Use more specific keywords in headings that differentiate the documents
4. Increase `maxResults` in `searchRelevantKnowledge(query, maxResults = 4)` to retrieve more context

---

## 🎬 Avatar Video Issues

### Video avatar shows a black box

**Cause:** Video files are missing from `public/videos/`.

**Fix:**
```bash
# Copy videos from Videos/ folder at project root
# Windows:
xcopy /Y Videos\*.mp4 public\videos\

# Mac/Linux:
cp Videos/*.mp4 public/videos/
```

### Video avatar doesn't animate (stays on one frame)

**Cause:** The browser autoplay policy is blocking the video.

**Fix:**
- The videos must be `muted` to autoplay (they are by default)
- Ensure the video elements have `autoPlay`, `muted`, and `playsInline` attributes
- Check browser console for `NotAllowedError: play() failed` — this means user interaction is needed first

### Video flickers or shows wrong state

**Cause:** React state update race condition.

**Fix:** This should be rare. Hard-reload the page (`Ctrl+Shift+R`) to reset state.

---

## 📱 Mobile / Responsive Issues

### Layout looks broken on mobile

**Fix:**
1. Ensure the viewport meta tag is present in `layout.tsx`:
   ```tsx
   export const viewport = {
     width: 'device-width',
     initialScale: 1,
     maximumScale: 1,
   };
   ```
2. Check `globals.css` for the correct media query breakpoints (`@media (max-width: 768px)`)

### Sidebar not closing on mobile after navigation

**Fix:** The sidebar toggle is controlled by `sidebarOpen` state in `page.tsx`. If stuck open, tap the ☰ hamburger menu again to close.

---

## 🌐 Deployment Issues on Vercel

### Build fails: `Cannot read properties of undefined`

**Cause:** A required environment variable is missing during build.

**Fix:**
1. Check Vercel → Settings → Environment Variables
2. Ensure all variables (especially `DATABASE_URL` if used in build-time code) are set
3. Redeploy after adding missing variables

### Knowledge documents not found in production

**Cause:** Files in `knowledge/` weren't included in the serverless bundle.

**Fix:**
1. Verify `next.config.mjs` has the `outputFileTracingIncludes` config
2. Commit the `knowledge/` directory files to Git (they need to be in the repository)
3. Re-deploy after ensuring the files are committed

### API calls return 504 Gateway Timeout

**Cause:** Serverless function exceeded execution time limit (60s on Vercel free tier).

**Fix:**
- Switch to a faster model: `google/gemini-flash-1.5` or `google/gemma-3-12b-it`
- Reduce the number of knowledge documents (fewer sections to search)
- Reduce `maxResults` from 4 to 2 in `searchRelevantKnowledge()`

### CORS errors in browser console

**Cause:** If calling the API from a different domain.

**Fix:** This shouldn't happen for normal use (same-origin). If building a separate frontend, add CORS headers:
```typescript
// In your API route:
return NextResponse.json(data, {
  headers: {
    'Access-Control-Allow-Origin': '*',
  }
});
```

---

## 🆘 Getting Help

If you're stuck:

1. **Check the terminal output** — Next.js server errors appear there with full stack traces
2. **Check Vercel function logs** — Vercel Dashboard → Project → Logs → Functions
3. **Check browser DevTools** — Console and Network tabs show client-side and API errors
4. **Check the GitHub issues** — https://github.com/developmentabacusdigital/Abhij-AI/issues
5. **Search OpenRouter docs** — https://openrouter.ai/docs for model/API issues
6. **Search Neon docs** — https://neon.tech/docs for database issues

---

## ✅ Quick Health Check

Run through these steps to verify the app is working correctly:

```bash
# 1. App loads
curl http://localhost:3000  # Should return HTML

# 2. Knowledge API works
curl -H "x-admin-key: admin123" http://localhost:3000/api/knowledge

# 3. DB status
curl -H "x-admin-key: admin123" http://localhost:3000/api/admin/db-status

# 4. Chat endpoint works (no real API key needed for demo mode)
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages": [{"role": "user", "content": "hello"}]}'
```
