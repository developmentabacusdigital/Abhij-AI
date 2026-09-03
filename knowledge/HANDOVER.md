# Miss MoMo (v2 RAG Chatbot) — Handover & Operations Guide

A practical, ops-focused companion to `RAG-SYSTEM-DOCUMENTATION.md` (which covers the
architecture and code in depth). This file answers the "who do I need access to, how do I
run it, and how do I fix/change it" questions for whoever maintains the system.

> **One-line mental model:** The **live chat** path is Cloudflare Worker → Supabase (retrieval)
> → OpenRouter (embeddings / LLM / rerank), embedded on the Shopify site via a widget hosted on
> Vercel. The **Hugging Face Space is ingestion only** — it fills the knowledge base and is *not*
> in the chat path. If chat breaks, HF is almost never the cause.

---

## 1. Access & Credentials Checklist

To fully operate and deploy the system you need access to six services. Fill in the account
handles/emails as you grant them.

| Service | What it's for | Access needed | Account / project |
|---|---|---|---|
| **Cloudflare** | Deploy & monitor the Worker (the chat brain) | Account access to `development-abacusdigital`, **or** a Wrangler API token with Workers edit | Account: `development-abacusdigital` |
| **Supabase** | Knowledge-base DB: logs, usage, migrations, deleting docs | Collaborator on the v2 project | Project ref: `bwsqmhtacmdmzscvjcqa` |
| **OpenRouter** | Monitor token usage, credits, rate limits (embeddings + LLM + rerank) | Team dashboard access | Team: `____` |
| **Hugging Face** | Deploy ingestion fixes / Docker builds; restart the Space | Write access to the Space repo | Space: `ADIDDev/momo-ingestion` |
| **Vercel** | Front-end (widget) + admin deployments | Member on both projects | `load-chat` (widget), `load-chat-wwnr` (admin) |
| **Shopify** | Theme embed, product/catalog data, hosted Files (PDFs) | Staff/collaborator with Themes & Apps | Store: `load-controls.myshopify.com` / public `www.loadcontrols.com` |

**Secrets live in three places (never in git):**
- **Cloudflare Worker secrets** (`wrangler secret put <NAME>`): `OPENROUTER_API_KEY`,
  `SUPABASE_KEY`, `SUPABASE_KEY_V2`, `SHOPIFY_STOREFRONT_TOKEN` (and `SHOPIFY_ADMIN_TOKEN` if the
  source-PDF feature is enabled later).
- **Hugging Face Space secrets** (Space → Settings → *Variables and secrets*): Supabase v2 URL/key,
  OpenRouter key.
- **Vercel env vars** (Project → Settings → Environment Variables): the Worker URL the widget calls.

> **Golden rule:** rotating a key means updating it in the service above **and** redeploying the
> surface that uses it. A key changed in the OpenRouter dashboard does nothing until it's re-put as
> a Worker/Space secret.

---

## 2. How Hugging Face is used, and where to debug

**Role.** The Space `ADIDDev/momo-ingestion` is the **ingestion backend only** — a FastAPI app in a
Docker container (free tier). It turns source material into knowledge-base rows and is **not** called
during a live chat.

**What it does with a document:** parse → extract text, tables, and diagram/image descriptions →
chunk → embed each chunk (Gemini Embedding 2, 3072-dim, via OpenRouter) → insert rows into the v2
Supabase table `documents_gemini`.

**Endpoints:**
- `POST /ingest` — a PDF (Docling parses layout/tables/diagrams; HybridChunker splits it)
- `POST /ingest/web` — a web page (BeautifulSoup extracts text; `chunk_web` ≈ 1000 chars / 150 overlap)
- `GET /health`, `GET /documents`, `GET /documents/v2` — status & inventory

**Where to debug:**
1. **Space → Logs tab** — build log + runtime app log. Python tracebacks from a failed ingest land here.
2. **Status pill** — `RUNNING` / `SLEEPING` / `BUILDING` / `APP_STARTING` / `BUILD_ERROR`.
3. **#1 issue — the 500 "Space is sleeping":** free tier **sleeps after ~48h idle**. Chat is
   unaffected (HF isn't in the path), but ingest/admin calls return 500. `/health` does **not**
   reliably wake it — **restart** it:
   - UI: Space → Settings → **Restart this Space**, or
   - API: `POST https://huggingface.co/api/spaces/ADIDDev/momo-ingestion/restart`
     (307 redirect — follow with `-L`; the id is case-sensitive: `ADIDDev`).
   - Wait for `BUILDING → APP_STARTING → RUNNING` before retrying.
4. **Deploying an ingestion fix** = `git push` to the Space repo → it rebuilds the Docker image.
   Changes to `requirements.txt` / `Dockerfile` force a full rebuild — watch the build log for
   dependency errors.

---

## 3. How to see chatbot traffic (and what each source tells you)

There's no single dashboard; traffic is visible at each hop, and each answers a different question.

| Where | What you see | Use it for |
|---|---|---|
| **Cloudflare → Workers → (worker) → Metrics / Logs** (`wrangler tail` for live) | Requests to `/chat/v2`, status codes, errors, invocations, CPU time, step traces | **Front door.** Total chat volume, error rate, "is it failing and where." |
| **OpenRouter → Activity / Usage** | Every LLM call (embed, Gemma generate, Cohere rerank): tokens, cost, model, time | **Cost & rate limits**, per-model usage; truncated/slow answers → check credits here. |
| **Supabase → Reports / Logs** | DB query volume, RPC calls (`hybrid_match_documents_gemini`), API requests, storage | Confirms retrieval hits the DB; surfaces cold-start / connection issues. |
| **Vercel → project → Analytics** | Page loads of the widget/admin, edge requests | Front-end reach — how many page views loaded the widget. |

> **Not built today:** product-level analytics (the actual questions asked, thumbs up/down). That
> would require logging each query/answer to a table. Easy to add on request.

---

## 4. What's in the knowledge base (besides PDFs and website), and why

The KB has exactly two content types: `content_type: "pdf"` and `content_type: "web"`. Within those,
several things beyond raw body text are captured **on purpose**:

**From PDFs:**
1. **Tables** — Docling keeps them as structured markdown, not flattened text. *Why:* spec sheets are
   mostly tables; flattening destroys the row/column meaning needed to answer "what's the max RPM."
2. **Diagram / image descriptions** — figures and wiring diagrams are captured (base64 in the chunk,
   swapped to `[📷 DIAGRAM X AVAILABLE]` markers at query time). *Why:* much of the real answer lives
   in the diagram, not the prose.
3. **Product ↔ document tags** (`metadata.tags`) — which product(s) a chunk belongs to. *Why:* drives
   the correct **product card**, reconciled to the real Shopify handle via `matchCatalog`
   (`onlineStoreUrl` + `featuredImage`).

**From web pages:**
4. **`source_url` per chunk** — *Why:* lets the agent **deep-link** to the exact section with a
   `#:~:text=…` fragment (`deepLink`), not just the page top.

**Deliberately NOT ingested:**
- The live **Shopify product catalog** (titles, prices, images, URLs) is fetched **live** from the
  Storefront API at query time — so it's never stale.
- No chat logs, no external/third-party content.

---

## 5. Deleting / editing documents in Supabase

Every chunk of a document is a row in **`documents_gemini`**; the filename is in
`metadata->>'source'`.

**Supabase Dashboard → SQL Editor:**

```sql
-- 1) ALWAYS preview first — see exact stored names + row counts:
select metadata->>'source' as source, count(*)
from documents_gemini
group by 1
order by 1;

-- 2) Delete ONE document (name must match exactly as shown above):
delete from documents_gemini
where metadata->>'source' = 'PMP-25-Data-Sheet.pdf';

-- 3) Delete SEVERAL:
delete from documents_gemini
where metadata->>'source' in ('OldSheet.pdf', 'Legacy-Manual.pdf');

-- 4) Delete all chunks of a website page:
delete from documents_gemini
where metadata->>'source_url' = 'https://www.loadcontrols.com/pages/some-page';
```

Notes:
- **Preview before deleting.** If unsure of the exact name, filter with `ilike '%pmp-25%'`.
- Deletion is by **content only** — HNSW/GIN indexes update automatically; chat stops finding those
  chunks immediately, **no re-index needed**.
- Run in the **SQL Editor (service role)**, not with the anon key (RLS).
- If the PDF was also uploaded to a Supabase **Storage** bucket, delete it there too (Storage →
  bucket → file). If it lives on **Shopify Files**, that's a separate copy again.
- **To replace/update a doc:** delete its rows, then re-ingest the new version via the HF Space
  `/ingest`. (There's no in-place edit — ingestion is append-only.)

---

## 6. Likely follow-up questions (pre-answered)

**Q: How do I add a new PDF to the knowledge base?**
Ensure the HF Space is `RUNNING` (restart if asleep, §2), then `POST` the PDF to the Space `/ingest`
endpoint (the admin UI on Vercel does this for you). Verify with `GET /documents/v2` or a
`select count(*)` grouped by source. No Worker redeploy needed — new rows are live immediately.

**Q: How do I add website pages?**
`POST` the URL(s) to `/ingest/web`, or re-run the sitemap crawler (`ingestion-server/reingest_web.py`)
which batches pages to the Space. It extracts, chunks, embeds, and inserts with `content_type: "web"`
and `source_url`.

**Q: The chat says "I couldn't find any information" / declines to answer. Why?**
The relevance gate: the system declines only when the best chunk's **embedding similarity < 0.35
(`SIM_GATE`)** *and* no product was resolved. Usually means the KB genuinely lacks that content —
add the doc. It is **not** an HF or Worker outage (those throw errors, not polite declines).

**Q: The chat returns a 500 / stops responding entirely.**
That's the **live path**, so look at **Cloudflare** first (`wrangler tail`), then **OpenRouter**
(credits/rate limit) and **Supabase** (DB reachable). The HF Space being asleep does **not** break
chat. Common causes: OpenRouter out of credits, an expired Worker secret, or Supabase cold start
(mitigated by the keep-warm cron; see §7).

**Q: Product card is missing or shows the wrong image.**
Product cards come from the **live Shopify catalog**, matched to doc tags by `matchCatalog`
(containment: short tag `pmp-25-ct200` → full handle `pump-load-control-…-pmp-25-ct200`). If wrong,
check the product's `handle`/`onlineStoreUrl`/`featuredImage` in Shopify and that the doc's
`metadata.tags` reference it.

**Q: A product link goes to a password page / "refused to connect."**
Links must point at the public domain `www.loadcontrols.com` (`SHOPIFY_LINK_DOMAIN`), not the
password-walled `*.myshopify.com`. In the iframe widget, links use `target="_top"` so they navigate
the whole tab (an iframe can't load the frame-blocked storefront inside itself).

**Q: How do I change the system prompt / the agent's behavior or tone?**
Edit the system prompt in `worker/src/chat_v2.ts`, then `wrangler deploy`. No DB or ingestion change.

**Q: How do I deploy a change?**
- **Worker (chat logic):** `cd worker && wrangler deploy`.
- **Front-end widget / admin:** push to the connected git branch → Vercel auto-deploys
  (`rag-v2` = preview, `main` = production).
- **Ingestion:** `git push` to the HF Space repo → Docker rebuild.

**Q: Will it get slower as I add more documents?**
No, practically. Retrieval uses an HNSW vector index + a GIN full-text index, both sub-linear;
thousands of chunks retrieve in the same few ms. LLM latency dominates and is independent of KB size.

**Q: Can it answer using more than one document at once?**
Yes — retrieval pools ~25 candidates across all docs, reranks to the top 6, and the LLM synthesizes
across them, so it can cross-reference multiple PDFs and pages in one answer.

**Q: Where's the money going / how do I control cost?**
Almost entirely **OpenRouter** (embeddings + Gemma generation + Cohere rerank). Monitor and cap on
the OpenRouter dashboard. Cloudflare/Supabase/Vercel/HF are free or low tier.

**Q: Someone changed a Supabase/OpenRouter key and things broke.**
Re-put the new key as the relevant **Worker secret** and/or **HF Space secret**, then redeploy that
surface (§1 golden rule).

---

## 7. Keep-warm (cold-start mitigation)

The Worker runs a **cron trigger** (`wrangler.toml [triggers] crons = ["*/5 * * * *"]`) that pings
both Supabase projects every 5 minutes (`warmDatabases`), and exposes `/warmup` the widget can hit on
page load — so the DB is awake before the first message. The **HF Space is not** on this cron (it's
not in the chat path); it still sleeps after ~48h and is woken by restart when you next ingest (§2).

---

## 8. Quick reference — who owns what

| Symptom | Look here first |
|---|---|
| Chat is slow / truncated | OpenRouter (credits, rate limit, model) |
| Chat returns 500 / dead | Cloudflare Worker logs → then OpenRouter → Supabase |
| Chat politely declines to answer | Knowledge base is missing that content (add the doc) |
| Can't ingest / admin shows 500 | HF Space asleep → restart it |
| Wrong/missing product card or image | Shopify product data + doc `metadata.tags` |
| Link goes to password page | `SHOPIFY_LINK_DOMAIN` must be `www.loadcontrols.com` |
| Need to remove a document | Supabase SQL Editor `delete … where metadata->>'source' = …` |
| Widget not appearing on site | Vercel deploy + Shopify theme embed |
