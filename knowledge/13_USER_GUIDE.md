# 13 — User Guide

How to use Abhij-AI as an end user — chatting, managing accounts, and working with chat history.

---

## 🌐 Getting Started

Open the Abhij-AI URL in any browser:
- **Local:** `http://localhost:3000`
- **Production:** Your deployed URL (e.g., `https://abhij-ai.vercel.app`)

You will see the welcome screen with:
- A central **welcome message** with the Abhij-AI branding
- A **text input** at the bottom for your message
- **Suggestion chips** — quick questions to get started
- A **video avatar** in the bottom-right corner

---

## 💬 Chatting with Abhij-AI

### Starting a Conversation
1. Click the chat input at the bottom of the screen
2. Type your question (e.g., *"What is the refund policy?"*)
3. Press **Enter** or click the **Send** button (arrow icon)

### What happens next:
- The **video avatar** transitions from Idle → Thinking animation
- The AI processes your question against the knowledge base
- The avatar transitions to Answering animation as the response streams in
- Text appears **token by token** (like watching someone type in real-time)
- After the response:
  - **Sources cited** are shown below the message
  - **Suggested Questions** appear as clickable chips

### Using Suggestion Chips
- After every AI response, 2-3 **suggested follow-up questions** appear as clickable buttons
- Click any chip to send that question automatically
- The initial welcome screen also shows suggestions to get you started

### Multi-turn Conversations
- Keep typing follow-up questions — the AI maintains the **full conversation history**
- Each response is grounded in both the knowledge base and the prior conversation context
- To start fresh, click **"New Chat"** in the sidebar

---

## 👤 User Accounts

User accounts let you **save and sync chat history** across sessions and devices.

### Creating an Account
1. Click the **user icon** at the top-left of the screen
2. The Auth modal appears
3. Click **"Register"** tab
4. Enter a **username** (3-32 characters, alphanumeric and underscores only)
5. Enter a **password** (minimum 6 characters)
6. Click **"Create Account"**

### Logging In
1. Click the **user icon** at the top-left
2. The Auth modal appears
3. Enter your **username** and **password**
4. Click **"Sign In"**

### Logging Out
1. Click your **username** at the top-left
2. A dropdown appears
3. Click **"Sign Out"**
4. Your local session is cleared (cloud history remains in Neon DB)

> 💡 **Without an account:** You can still chat freely. Conversations are saved to your browser's localStorage. Clearing browser data will erase them.

---

## 📜 Chat History Sidebar

### Opening the Sidebar
- **Desktop:** The sidebar is visible by default on the left
- **Mobile:** Tap the **hamburger menu** (☰) icon at the top-left to open the sidebar

### What the Sidebar Shows
- **New Chat** button at the top
- Conversations grouped by time:
  - **Today** — conversations from today
  - **Previous 7 Days** — recent conversations
  - **Older** — all other conversations

### Navigating Conversations
- Click any conversation to load it and see the full message history
- The current active conversation is **highlighted**

### Renaming a Conversation
1. Hover over a conversation in the sidebar
2. Click the **Edit (pencil)** icon that appears
3. Type the new name
4. Press **Enter** or click away to save

### Deleting a Conversation
1. Hover over a conversation in the sidebar
2. Click the **Delete (trash)** icon
3. Confirm deletion in the popup

> ⚠️ **Deletion is permanent.** Cloud-synced sessions are deleted from Neon DB too.

---

## 📱 Mobile Usage

Abhij-AI is fully optimized for mobile phones:

- **Sidebar:** Hidden by default, accessible via ☰ hamburger menu
- **Touch keyboard:** Chat input is properly positioned above the keyboard
- **Tap to start:** Tap suggestion chips to begin chatting
- **Avatarsize:** The video avatar is smaller on mobile to save screen space
- **Font sizes:** Slightly smaller on mobile for comfortable reading without zooming

**Recommended browsers:**
- iOS: Safari 15+
- Android: Chrome 90+

---

## 🔗 Sharing a Link

When you share the Abhij-AI URL on social media or messaging apps:
- A **preview card** appears with:
  - Title: "Abhij-AI | Humanized Knowledge Assistant"
  - Description: "AI Knowledge Assistant strictly grounded in documentation..."
  - Image: The `SOCIAL.png` preview image
- The link always opens in the **logged-out state** (user privacy preserved)

---

## ❓ FAQ

### Q: Why didn't Abhij-AI answer my question?
**A:** The AI can only answer from documents in its knowledge base. If your question isn't covered by any document, it will politely say it couldn't find the information. Ask the admin to add relevant documentation.

### Q: Can I attach files to my messages?
**A:** Not currently. File uploads are only available in the admin panel. The AI reads from the pre-loaded knowledge base only.

### Q: Will my chat history be visible to others?
**A:** No. Chat histories are user-namespaced — only you can see your conversations. Admins can see the count of sessions in the DB status panel, but not the content.

### Q: What happens to my chat if I close the browser?
**A:** 
- **With an account + Neon DB configured:** History is saved to the cloud — it will be there when you log back in from any device.
- **Without an account:** History is in browser localStorage — it survives page refreshes but is lost if you clear browser data.

### Q: Why are there suggested questions at the end of responses?
**A:** The AI is instructed to predict the 2-3 most likely follow-up questions you might want to ask, based on the knowledge base content. Clicking them is a quick way to explore related topics.

### Q: What is the video avatar?
**A:** It's an animated character that visually indicates what the AI is doing:
- **Idle animation:** AI is waiting for your message
- **Thinking animation:** AI is processing your question
- **Answering animation:** AI is generating and streaming the response

---

## 💡 Tips for Better Results

1. **Be specific:** "What are the eligibility criteria for a refund?" gets better results than "refund?"
2. **Use key terms:** The search is keyword-based — use words that would appear in the documents
3. **Ask follow-ups:** The AI remembers the conversation — "Tell me more about point 2" works well
4. **Click suggestions:** Suggested questions are curated from the actual document content — great for exploring
5. **Try reformulations:** If you get "I couldn't find this," try phrasing the question differently
