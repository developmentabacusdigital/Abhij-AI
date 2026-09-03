# 🐮 GOD_MOMO.md — The Ultimate Miss MoMo Document

> The single source of truth for **Miss MoMo**, the RAG chatbot on
> [www.loadcontrols.com](https://www.loadcontrols.com). Written for four audiences:
> **① people who use it**, **② people who develop on it**, **③ people who maintain/operate it**,
> and **④ people who update its knowledge or behavior**.
>
> Companion documents:
> - `RAG-VERSIONS.md` — how v1 and v2 differ, and why v2 exists.
> - `RAG-SYSTEM-DOCUMENTATION.md` — deep architecture & code reference.
> - `HANDOVER.md` — access checklist & ops runbook (condensed).
> - `HOW-IT-WORKS.md` — short architecture overview.

---

## Table of contents

1. [The 60-second overview](#1-the-60-second-overview)
2. [Glossary — every term in one place](#2-glossary)
3. [Where everything lives (systems map)](#3-where-everything-lives)
4. [FAQ — General & business](#4-faq--general--business)
5. [FAQ — Using the chatbot](#5-faq--using-the-chatbot)
6. [FAQ — How it works (conceptual)](#6-faq--how-it-works-conceptual)
7. [FAQ — Developing on it](#7-faq--developing-on-it)
8. [FAQ — Maintaining & operating it](#8-faq--maintaining--operating-it)
9. [FAQ — Updating the knowledge base](#9-faq--updating-the-knowledge-base)
10. [FAQ — Updating behavior, tone & UI](#10-faq--updating-behavior-tone--ui)
11. [FAQ — Costs, scaling & limits](#11-faq--costs-scaling--limits)
12. [FAQ — Security & privacy](#12-faq--security--privacy)
13. [Troubleshooting matrix](#13-troubleshooting-matrix)
14. [Deploy playbook (copy-paste)](#14-deploy-playbook)
15. [Emergency / rollback](#15-emergency--rollback)

---

## 1. The 60-second overview

**What it is.** Miss MoMo is a Retrieval-Augmented Generation (RAG) assistant. When a visitor asks a
question, the system finds the most relevant passages from Load Controls' own documents and website,
feeds them to a language model, and streams back an answer grounded in that material — with product
cards, contact buttons, and deep links where useful.

**The live chat path (what runs on every message):**

```
Visitor → Widget (Vercel) → Cloudflare Worker /chat/v2
   → rewrite query → resolve product → embed (OpenRouter)
   → hybrid search (Supabase: vector + keyword, RRF) → rerank (Cohere)
   → relevance gate → build context → Gemma LLM (OpenRouter, streamed)
   → answer + product cards + deep links → back to the widget
```

**The ingestion path (what runs when you add documents — NOT during chat):**

```
PDF / URL → Hugging Face Space (FastAPI) → parse (Docling / BeautifulSoup)
   → chunk → embed each chunk → insert rows into Supabase (documents_gemini)
```

**The golden separation:** The **Hugging Face Space is ingestion-only** and is **not** in the chat
path. If chat is down, HF is almost never the cause. If you can't add documents, HF is usually the cause.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **RAG** | Retrieval-Augmented Generation — retrieve relevant text, then have an LLM answer using it. Stops the model inventing facts. |
| **Chunk** | A small passage of a document (a few hundred words, a table, or a diagram) stored as one DB row. |
| **Embedding** | A 3072-number vector representing a chunk's meaning. Similar meaning → nearby vectors. Model: `google/gemini-embedding-2`. |
| **Vector search** | Finding chunks whose embedding is closest to the question's embedding (semantic similarity). Uses an HNSW index. |
| **Keyword search (FTS)** | Postgres full-text search — exact word/term matching. Uses a GIN index on `content_tsv`. |
| **Hybrid retrieval** | Running both searches and fusing the two ranked lists with **RRF**. |
| **RRF** | Reciprocal Rank Fusion — merges two ranked lists; each list contributes `1/(k+rank)`, `k=60`. |
| **Rerank** | A second, more accurate relevance model (`cohere/rerank-v3.5`) re-orders the candidate pool. Orders, doesn't veto. |
| **Relevance gate** | The decision to answer or politely decline, based on best embedding similarity (`SIM_GATE=0.35`). |
| **The Worker** | The Cloudflare Worker — the chat backend/brain (`worker/src/chat_v2.ts`). |
| **The Space** | The Hugging Face Space `ADIDDev/momo-ingestion` — the ingestion backend (FastAPI/Docker). |
| **Widget** | The embeddable chat UI (floating launcher + chat window) served from Vercel and embedded in the Shopify theme. |
| **Deep link** | A URL with a `#:~:text=start,end` fragment that scrolls to and highlights the exact passage on a page. |
| **Product card** | The visual product tile (image + title + link) shown when an answer relates to a product. |
| **Metadata** | The JSON attached to each chunk row: `source`, `content_type`, `product_handles`, `source_url`, `image_url`, etc. |
| **Handle** | Shopify's URL slug for a product (e.g. `pump-load-control-…-pmp-25-ct200`). |

---

## 3. Where everything lives

**One git repo, two GitHub remotes:**
- `origin` → `github.com/Abhijay0306/load-chat`
- `abacus` → `github.com/developmentabacusdigital/load-chat`

| Component | Code (in the repo) | Runs on (hosted) | Deploy method |
|---|---|---|---|
| **Chat backend** (the brain) | `worker/` (`chat_v2.ts`, `index.ts`) | **Cloudflare** Workers (`development-abacusdigital`) | `wrangler deploy` |
| **Ingestion backend** | `ingestion-server/` (`main.py`, `pipeline_v2.py`, `pipeline_web.py`) | **Hugging Face Space** `ADIDDev/momo-ingestion` (Docker) | `git push` to Space |
| **Knowledge base / DB** | `supabase/migrations/` | **Supabase** Postgres `bwsqmhtacmdmzscvjcqa` | run migrations in SQL editor |
| **Chat widget** | `frontend/` (`embed-v2.js`, `chat-v2.html`) | **Vercel** `load-chat` | git push → auto-deploy |
| **Admin UI** | `admin/` (Next.js) | **Vercel** `load-chat-wwnr` | git push → auto-deploy |
| **Products, PDFs, embed** | — | **Shopify** `load-controls.myshopify.com` / `www.loadcontrols.com` | Shopify admin |

**Models (all via OpenRouter):** embeddings `google/gemini-embedding-2` (3072-dim) · generation
`google/gemma-4-26b-a4b-it` · reranking `cohere/rerank-v3.5`.

---

## 4. FAQ — General & business

**Q: What is Miss MoMo, in plain terms?**
An AI assistant on the Load Controls website that answers product and technical questions using the
company's own datasheets, manuals, and website content — and points people to the right product or
the sales team.

**Q: Why build a RAG chatbot instead of just using ChatGPT?**
A general chatbot doesn't know Load Controls' specific products, spec tables, or wiring diagrams, and
would invent plausible-but-wrong answers. RAG grounds every answer in *your* documents, cites the
source, and declines when it genuinely doesn't know — which is what a technical audience needs.

**Q: What can it actually do for a visitor?**
Answer product/spec questions, read spec tables and offer wiring diagrams, recommend the right product
(with a clickable card), deep-link to the exact section of a web page, hand over phone/email when it
can't help, and hold a short conversation (it remembers the last several turns).

**Q: What can't it do?**
It won't answer things outside Load Controls' domain, won't invent specs, and won't act on anything
not in its knowledge base. It has no access to orders, inventory, or customer accounts. It doesn't do
live pricing math or place orders.

**Q: Is there a v1 and a v2? Which is live?**
Yes. **v2 is the current production experience** (hybrid retrieval + rerank + streaming + product
cards). v1 is the original, simpler pipeline, kept intact as a baseline. See `RAG-VERSIONS.md` for the
full comparison.

**Q: Who owns/pays for the moving parts?**
Cloudflare, Supabase, Vercel, and Hugging Face are on free/low tiers. The real recurring cost is
**OpenRouter** (the AI model calls). See [§11](#11-faq--costs-scaling--limits).

---

## 5. FAQ — Using the chatbot

**Q: How does a visitor open it?**
A floating launcher (an MP4 avatar with a red border) sits in the corner. A greeting bubble pops up
once per session a few seconds after arrival. Clicking the launcher opens the chat; the launcher
becomes an ✕ to close it.

**Q: Does it remember the conversation?**
Yes, within a session — the widget stores the conversation in `localStorage` and sends the last turns
back with each question, so follow-ups like "what about the 3-phase version?" resolve correctly. It
carries the **last 10 turns** into the model (older turns are dropped).

**Q: What happens if I ask something it doesn't know?**
It says so briefly and offers the team's phone/email (with tappable **Call** / **Email** buttons)
rather than making something up.

**Q: Why did it show a product card / a wiring diagram?**
When your question maps to a product, it surfaces that product's card. When you ask about wiring or
installation, it force-includes the relevant safety/wiring passages and can offer the diagram.

**Q: Why did clicking a link navigate the whole page instead of opening a tab?**
Inside the embedded widget, links use `target="_top"` so they load in the full browser tab. Loading
the storefront *inside* the small iframe is blocked by the site's frame rules ("refused to connect"),
so full-tab navigation is deliberate.

**Q: Does the chat close if I click away or change pages?**
Yes — clicking outside it or navigating closes the window, but the conversation is preserved so it's
still there when reopened.

**Q: What are the quick replies (catalog / contact) about?**
"What products do you have?" returns a **fixed, pre-written** 5-category catalog message (no AI call),
and contact questions return a **fixed** phone/email reply with buttons. These are instant and never
vary — deliberately not generated by the model each time.

---

## 6. FAQ — How it works (conceptual)

**Q: Walk me through what happens when I hit send.**
1. **Fast-path intents.** If the message is a greeting, a catalog ask, or a contact ask, it returns a
   canned/persona reply immediately — no retrieval.
2. **Query rewriting.** For real questions, the model rewrites your message into a standalone search
   query using the conversation history (resolves "it", "that model", etc.).
3. **Product resolution.** It scans the rewritten query for model-number tokens and matches them
   against the live Shopify catalog to get product handles.
4. **Embedding.** The rewritten query is embedded into a 3072-dim vector.
5. **Hybrid retrieval.** Supabase runs vector search + keyword search in parallel and fuses them with
   RRF, returning a wide pool of ~25 candidate chunks (optionally filtered to the resolved product).
6. **Rerank.** Cohere re-orders the pool by true relevance; the top 6 are kept.
7. **Relevance gate.** If the best embedding similarity is below 0.35 **and** no product was resolved,
   it declines (no hallucinating). Otherwise it proceeds.
8. **Context enrichment.** Full spec tables are pulled in when a table row matched; safety/wiring
   chunks are force-included for wiring queries; product cards and page deep links are assembled.
9. **Generation.** Gemma writes the answer from the context + the last 10 turns, **streamed** token by
   token over SSE.
10. **Post-processing.** Stray image tokens are stripped; product cards / contact buttons / sources
    render in the widget.

**Q: What's "hybrid" retrieval and why not just vector search?**
Vector search is great for meaning ("dry running pump" ≈ "loss of prime") but can miss exact part
numbers; keyword search nails exact terms ("PMP-25-CT200") but misses paraphrases. Fusing both (RRF)
gets the strengths of each.

**Q: Does the reranker decide whether to answer?**
No. The reranker only **orders** candidates. The **answer/decline** decision uses embedding similarity
(`SIM_GATE=0.35`). This is deliberate: broad/thematic questions ("problems in the chemical industry")
are genuinely relevant but score low on a literal reranker, so we don't let the reranker veto them.

**Q: Can one answer use multiple documents?**
Yes. Retrieval pools candidates across the entire knowledge base and the top 6 can come from different
PDFs and web pages, so the model synthesizes across sources in a single answer.

**Q: How does it avoid making things up?**
Three guards: (1) it answers only from retrieved context, (2) the relevance gate declines when nothing
relevant is found, (3) the system prompt forbids inventing specs, URLs, or product links.

**Q: How do product links get the right image and URL?**
Documents are tagged with short handles (`pmp-25-ct200`) but Shopify uses long slugs. `matchCatalog`
reconciles them by containment and picks the canonical (shortest) match, then uses Shopify's own
`onlineStoreUrl` and `featuredImage` — so images and links are always live and correct.

---

## 7. FAQ — Developing on it

**Q: Where's the chat logic I'd edit?**
[worker/src/chat_v2.ts](worker/src/chat_v2.ts) — the entire v2 pipeline (`handleChatV2`), plus every
helper: `rewriteQuery`, `embedQuery`, `fetchProductCatalog`, `resolveProductHandles`, `matchCatalog`,
`hybridRetrieve`, `rerank`, `fetchTable`, `fetchSafetyChunks`, `generate`/`generateStreaming`,
`buildMessages`, `deepLink`, and the fast-path intent detectors.

**Q: How do I run the Worker locally?**
`cd worker && npx wrangler dev`. Put secrets in `worker/.dev.vars` (`OPENROUTER_API_KEY`,
`SUPABASE_KEY_V2`, `SHOPIFY_STOREFRONT_TOKEN`, etc.). Non-secret vars are in `wrangler.toml [vars]`.
It serves on `http://localhost:8787`; POST to `/chat/v2`.

**Q: What's the request/response shape of `/chat/v2`?**
Request: `{ "query": string, "history"?: [{role, content}], "stream"?: boolean }`.
Non-streaming response (JSON): `{ answer, input_tokens, output_tokens, finish_reason, sources,
engine, rewritten_query, product_handles, images, product_candidates, web_pages, debug_* }`.
Streaming (`stream:true`): SSE frames — a `meta` frame (everything except `answer`), then `token`
frames, then a `done` frame.

**Q: How do I add a new fast-path intent (like catalog/contact)?**
Add a regex + handler near `isCatalogQuery`/`isContactQuery`, and branch early in `handleChatV2`
before the retrieval block. Return a fixed message (support both streaming and JSON paths). Anchor the
regex tightly so it doesn't swallow real questions (see how `CONTACT_RE` avoids "auxiliary contact").

**Q: How do I tune retrieval quality?**
Constants at the top of `chat_v2.ts`: `WIDE_MATCH_COUNT` (candidate pool, 25), `RERANK_TOP_N` (kept,
6), `RERANK_GATE` (0.1, ordering trim), `SIM_GATE` (0.35, the answer/decline threshold). Raise
`SIM_GATE` to be stricter (more declines), lower it to answer more (risk of weak answers).

**Q: How do I change which model is used?**
`EMBED_MODEL`, `GEN_MODEL`, `RERANK_MODEL` constants. ⚠️ Changing `EMBED_MODEL` means **re-embedding
the entire knowledge base** (the vectors must be from the same model/dimensionality) — not a drop-in
swap. `GEN_MODEL` and `RERANK_MODEL` can be swapped freely.

**Q: How does streaming work end to end?**
`sseResponse` opens a `ReadableStream`, emits the `meta` frame, then `generateStreaming` calls
OpenRouter with `stream:true`, parses the `data:` lines, and forwards each token delta via `send`. The
widget's `renderAnswer` appends tokens live and does the final render (cards/links) on `done`.

**Q: Where are the DB functions defined?**
[supabase/migrations/0002_functions.sql](supabase/migrations/0002_functions.sql):
`match_documents_gemini` (pure vector) and `hybrid_match_documents_gemini` (vector + FTS + RRF, with an
optional product-handle filter). Table + indexes are in `0001_documents_v2.sql`.

**Q: How do I test a change safely?**
Deploy Worker changes and test against the `/chat/v2` endpoint directly (curl or the test HTML). The
`rag-v2` branch drives the Vercel **preview**; `main` is production. Keep v1 (`/chat`) untouched — it's
the fallback baseline.

---

## 8. FAQ — Maintaining & operating it

**Q: What do I need access to?**
Six services — Cloudflare, Supabase, OpenRouter, Hugging Face, Vercel, Shopify. Exact levels and the
three secret stores are in `HANDOVER.md §1`.

**Q: How do I watch traffic and health?**
- **Cloudflare** → Workers → Metrics/Logs (`wrangler tail` for live) — request volume, errors, step traces.
- **OpenRouter** → Activity/Usage — token spend, per-model usage, rate limits.
- **Supabase** → Reports/Logs — DB/RPC volume, cold-start signs.
- **Vercel** → Analytics — widget page loads.
There is no single unified dashboard, and **question-level analytics is not built yet** (would need a
logging table).

**Q: Why do I sometimes get a 500 when adding a document?**
The HF Space sleeps after ~48h idle (free tier). Ingest/admin calls then 500. **Restart the Space**
(UI: Settings → Restart, or `POST https://huggingface.co/api/spaces/ADIDDev/momo-ingestion/restart`
with `-L`) and wait for `RUNNING`. Chat is unaffected by this.

**Q: Why do chat replies sometimes lag on the first message?**
Supabase free tier can go cold. Mitigated by a **cron every 5 minutes** (`wrangler.toml [triggers]`)
that pings both DBs (`warmDatabases`), plus a `/warmup` endpoint the widget hits on page load.

**Q: A key was rotated and things broke — what now?**
Re-put the new key as the relevant **Worker secret** (`wrangler secret put NAME`) and/or **HF Space
secret**, then redeploy that surface. A key changed only in a provider dashboard does nothing until
it's set as a secret where it's used.

**Q: How do I see exactly what the chat retrieved for a query?**
The response `meta` includes `rewritten_query`, `product_handles`, `sources`, `debug_chunk_types`, and
`debug_max_sim`. Hit `/chat/v2` directly (non-streaming) to inspect them.

**Q: How do I check what's in the knowledge base?**
Supabase SQL editor: `select metadata->>'source' as source, count(*) from documents_gemini group by 1
order by 1;` — or the Space's `GET /documents/v2`.

---

## 9. FAQ — Updating the knowledge base

**Q: How do I add a new PDF?**
Make sure the Space is `RUNNING`, then upload via the admin UI (or `POST` the file to the Space
`/ingest/v2`). Docling parses layout/tables/diagrams, it chunks, embeds, and inserts. New rows are
live in chat immediately — **no Worker redeploy**.

**Q: How do I add website pages?**
`POST` URLs to the Space `/ingest/web`, or run `ingestion-server/reingest_web.py` to crawl the sitemap
and batch pages. They're stored with `content_type:"web"` and a `source_url` (enables deep links).

**Q: How do I connect a document to a product (so the card shows)?**
Set the document's `product_handles` — via the admin UI's tagging, or the Space endpoint that calls
`set_product_handles_v2(source, handles)`. This updates every chunk of that document **in place**
without re-ingesting.

**Q: How do I update/replace a document?**
There's no in-place content edit — ingestion is append-only. **Delete** the old document's rows, then
**re-ingest** the new version.

**Q: How do I delete a document?**
Supabase SQL editor (service role):
```sql
-- preview first
select metadata->>'source' as source, count(*) from documents_gemini group by 1 order by 1;
-- delete one
delete from documents_gemini where metadata->>'source' = 'PMP-25-Data-Sheet.pdf';
-- delete a web page's chunks
delete from documents_gemini where metadata->>'source_url' = 'https://www.loadcontrols.com/pages/x';
```
Indexes update automatically; the chat stops finding those chunks immediately. If the PDF also lives
in a Supabase Storage bucket or on Shopify Files, remove those copies too.

**Q: What metadata does each chunk carry, and why does it matter?**

| Field | Purpose |
|---|---|
| `source` | Filename/page name — shown as the citation, matched on delete. |
| `content_type` | `text` / `table` / `spec_table_row` / `diagram` / `web` — drives special handling. |
| `table_source` | Ties spec rows to their parent table so the **whole table** can be injected when a row matches. |
| `image_url` | Diagram image (in Supabase Storage) surfaced to the widget. |
| `is_safety_critical` | Flags wiring/install passages for **force-include** on safety queries. |
| `product_handles` | Which products the chunk relates to → product cards + optional hard filter. |
| `source_url` | Original web page URL → enables `#:~:text=` deep links. |

**Q: Besides PDFs and website, what else is in the KB?**
Only two content types (`pdf`, `web`), but within PDFs it also captures **tables** (as structured
markdown), **diagram/image descriptions**, and **product tags**. The **live Shopify catalog is
deliberately NOT ingested** — it's fetched live at query time so prices/images/links never go stale.

---

## 10. FAQ — Updating behavior, tone & UI

**Q: How do I change the assistant's tone or rules?**
Edit `SYSTEM_PROMPT` in `chat_v2.ts` (tone, casual-chat rule, product-recommendation rule, reference-
page rule, decline behavior), then `wrangler deploy`. No DB/ingestion change.

**Q: How do I change the fixed catalog or contact replies?**
Edit `CATALOG_MSG` / `CONTACT_MSG` in `chat_v2.ts` (and the collection URLs), then redeploy the Worker.

**Q: How do I change the phone number / email everywhere?**
It appears in `CONTACT_MSG`, in the decline message, and in the system prompt — update all three in
`chat_v2.ts`, and the contact-button rendering in the widget (`frontend/chat-v2.html`).

**Q: How do I change the launcher avatar, colors, or greeting?**
`frontend/embed-v2.js` (launcher MP4, red border, greeting bubble timing/animation, close behavior)
and `frontend/chat-v2.html` (DM Sans font, red send button, product cards, contact buttons). Push to
git → Vercel redeploys.

**Q: How do I change how many conversation turns it remembers?**
`HISTORY_TURNS` (10) and `HISTORY_CHAR_CAP` (2000) in `chat_v2.ts`.

**Q: How do I make it answer more or less freely?**
`SIM_GATE` in `chat_v2.ts`. Higher = stricter (more "I don't have that") ; lower = more attempts.

---

## 11. FAQ — Costs, scaling & limits

**Q: Where does the money go?**
Almost entirely **OpenRouter**: each real question makes up to ~3 calls — a rewrite (small), an
embedding (small), a rerank (medium), and a generation (largest). Fast-path intents (greeting/catalog/
contact) cost **nothing** (no model calls). Monitor and cap on the OpenRouter dashboard.

**Q: Does it get slower as the knowledge base grows?**
Not meaningfully. Vector search (HNSW) and keyword search (GIN) are both sub-linear; thousands of
chunks retrieve in a few milliseconds. LLM generation dominates latency and is independent of KB size.

**Q: What are the hard limits I should know?**
- Generation is capped at `max_tokens = 4096`; truncation logs `finish_reason=length`.
- Shopify catalog fetch pulls `first: 250` products, edge-cached 5 min.
- Retrieval pool is 25 candidates, top 6 kept.
- HF Space free tier sleeps after ~48h idle; Supabase free tier can cold-start.

**Q: How would I scale for much higher traffic?**
Cloudflare Workers scale automatically. The likely limits are OpenRouter rate limits/credits and the
Supabase/HF free tiers — upgrade those tiers. The architecture itself doesn't need to change.

---

## 12. FAQ — Security & privacy

**Q: Where are the secrets?**
Never in git. Three stores: **Cloudflare Worker secrets**, **HF Space secrets**, **Vercel env vars**.
See `HANDOVER.md §1`.

**Q: What data does the chatbot store about visitors?**
The conversation is kept in the visitor's own browser (`localStorage`) for continuity. There's no
server-side chat logging today (beyond ephemeral Cloudflare request logs). If you add analytics, that
changes — disclose accordingly.

**Q: Can a user jailbreak it or pull it off-topic?**
The system prompt includes a guardrail rule that redirects off-topic/rule-breaking attempts back to
Load Controls topics. It answers only from retrieved context, which further limits abuse.

**Q: Is the database exposed?**
The Worker talks to Supabase with a key held as a Worker secret. Deletions/migrations must be run with
the **service role** in the SQL editor, not the anon key (RLS).

---

## 13. Troubleshooting matrix

| Symptom | Most likely cause | First action |
|---|---|---|
| Chat returns 500 / dead | Worker error, OpenRouter credits/limit, or Supabase down | `wrangler tail`; check OpenRouter credits; check Supabase status |
| Chat is slow on first message | Supabase cold start | Confirm keep-warm cron is active; hit `/warmup` |
| Chat replies are truncated | `max_tokens` hit | Look for `finish_reason=length`; raise `max_tokens` or tighten prompt |
| Chat politely declines everything | Gate too strict, or KB missing content | Check `debug_max_sim`; lower `SIM_GATE`; add the document |
| Can't add a document / admin 500 | HF Space asleep | Restart the Space; wait for `RUNNING` |
| Product card missing/wrong image | Handle mismatch or missing tags | Check `product_handles` on the doc; verify Shopify handle/`onlineStoreUrl` |
| Link opens a password page | Wrong link domain | `SHOPIFY_LINK_DOMAIN` must be `www.loadcontrols.com` |
| "Refused to connect" clicking a link | Loading storefront inside the iframe | Links must use `target="_top"` |
| Widget not visible on site | Vercel deploy or Shopify embed | Check Vercel deploy + Shopify theme embed snippet |
| Deep link doesn't highlight | Text fragment didn't match | Passage text changed on the page; re-ingest that page |
| Answer ignores recent turns | History not sent / too old | Confirm widget sends `history`; note only last 10 turns are used |

---

## 14. Deploy playbook

**Chat logic (the Worker):**
```bash
cd worker
npx wrangler deploy
# secrets (one-time / on rotation):
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put SUPABASE_KEY_V2
npx wrangler secret put SHOPIFY_STOREFRONT_TOKEN
```

**Front-end widget / admin (Vercel):**
```bash
git push origin rag-v2      # → Vercel PREVIEW
git push origin main        # → Vercel PRODUCTION
```

**Ingestion (Hugging Face Space):**
```bash
# push the ingestion-server code to the Space's git remote → Docker rebuild
git push space main
# if asleep, restart:
curl -L -X POST https://huggingface.co/api/spaces/ADIDDev/momo-ingestion/restart
```

**Database (Supabase):**
Run `supabase/migrations/*.sql` in the SQL editor (in order). Retrieval functions are idempotent
(`create or replace`).

---

## 15. Emergency / rollback

- **Bad Worker deploy:** `cd worker && npx wrangler rollback` (or redeploy the previous commit). v1
  (`/chat`) is an independent fallback and is never touched by v2 changes.
- **Bad front-end deploy:** in Vercel, promote the previous deployment (Deployments → ⋯ → Promote).
- **Bad ingestion (garbage chunks):** delete that document's rows in Supabase (see [§9](#9-faq--updating-the-knowledge-base)) and re-ingest a corrected version.
- **Runaway cost:** cap/disable the key on the OpenRouter dashboard; the chat will error rather than
  overspend.
- **Everything's weird after a key rotation:** re-put the key as the correct secret and redeploy that
  surface ([§8](#8-faq--maintaining--operating-it)).

---

*This document pairs with `RAG-VERSIONS.md` (v1 vs v2), `RAG-SYSTEM-DOCUMENTATION.md` (deep reference),
and `HANDOVER.md` (access & ops). When behavior changes, update `chat_v2.ts` first, then reflect it here.*
