# RAG Versions — v1 vs v2 (and how they differ)

Miss MoMo runs as **two parallel pipelines** behind the same Worker. This document explains what each
version is, why v2 was built, and every concrete difference. It's the reference for anyone deciding
which endpoint to use or planning the next version.

> **TL;DR:** **v2 is the current production experience.** v1 is the original, simpler pipeline kept
> intact as a baseline/fallback. They use **separate Supabase projects**, so changing one never
> affects the other. The Worker serves both: `/chat` = v1, `/chat/v2` = v2.

---

## 1. At a glance

| | **v1** (`/chat`) | **v2** (`/chat/v2`) — production |
|---|---|---|
| **Code** | `worker/src/index.ts` (`handleChat`) | `worker/src/chat_v2.ts` (`handleChatV2`) |
| **Database** | Supabase `crnwhlnaiozvqlwavycm` | Supabase `bwsqmhtacmdmzscvjcqa` (separate project) |
| **Retrieval** | Pure vector search (`match_documents_gemini`) | **Hybrid** vector + keyword, fused with RRF (`hybrid_match_documents_gemini`) |
| **Candidate pool** | Top 5 | Wide **25**, reranked to **6** |
| **Reranking** | None | **Cohere `rerank-v3.5`** (ordering) |
| **Relevance gate** | None (answers from whatever it finds) | **Embedding-similarity gate** (`SIM_GATE=0.35`) — declines when off-topic |
| **Query rewriting** | None | **Yes** — history-aware standalone query |
| **Conversation memory** | None (single-shot) | **Last 10 turns** carried into generation |
| **Streaming** | No (one JSON blob) | **Yes** — SSE token streaming |
| **Product links** | LLM guesses handle from name (prompt rule) | **Live Shopify catalog**, reconciled handles, real image + `onlineStoreUrl` → **product cards** |
| **Website content** | Not ingested | Ingested with `source_url` → **deep links** (`#:~:text=`) |
| **Tables** | Flattened into text | **Structured**, with whole-table injection when a row matches |
| **Diagrams** | Base64 marker, LLM decides to show | Captured with `image_url`; safety/wiring **force-include** |
| **Fast-path intents** | Casual chat via prompt only | **Greeting / catalog / contact** short-circuits (no model call) |
| **Max output tokens** | 1024 | **4096** (+ truncation logging) |
| **Persona** | Witty/sassy | Professional senior-support-engineer tone |
| **Generation model** | `google/gemma-4-26b-a4b-it` | `google/gemma-4-26b-a4b-it` (same) |
| **Embedding model** | `google/gemini-embedding-2` (3072d) | same |

---

## 2. What v1 is

v1 is the **baseline RAG**: embed the question → pure vector search for the top 5 chunks → send them to
Gemma with a system prompt → return one JSON answer.

**Strengths:** simple, cheap, few moving parts, easy to reason about.

**Limitations that motivated v2:**
- **No exact-term matching** — pure vector search can miss precise part numbers (e.g. "PMP-25-CT200").
- **No relevance gate** — it answers from whatever the top-5 returns, even when nothing is truly
  relevant, so it can produce weak or off-base answers instead of declining.
- **No memory** — each question is single-shot; follow-ups ("the 3-phase one?") don't resolve.
- **No streaming** — the user waits for the whole answer.
- **Guessed product links** — the model builds a handle from the product name (`Load Sentinel Pro` →
  `/products/load-sentinel-pro`), which breaks when the real Shopify slug differs.
- **No website knowledge, no deep links, no product cards.**

v1 is intentionally **left untouched** as a fallback and A/B baseline. Every v2 change is isolated
(separate file, separate DB), so v1 keeps working no matter what happens to v2.

---

## 3. What v2 is (and why each piece exists)

v2 layers a set of retrieval-quality and UX improvements on top of v1. Each was a deliberate fix for a
v1 limitation (the `§` tags map to the original change list and to comments in `chat_v2.ts`):

| Feature | §  | Problem it solves |
|---|---|---|
| **Query rewriting** | §8 | Resolves pronouns/shorthand using history so retrieval searches for the real intent. |
| **Product-handle resolution + hard filter** | §9 | Detects model numbers and can restrict retrieval to that product; retries unfiltered if the filter dead-ends. |
| **Hybrid retrieval (vector + FTS, RRF)** | §5/§6 | Combines semantic recall with exact-term precision. |
| **Wide pool + Cohere rerank** | §7 | Fetch 25, re-order by true relevance, keep the best 6. |
| **Embedding-similarity relevance gate** | §7 | Decides answer-vs-decline robustly, without letting the literal reranker veto thematic queries. |
| **Full-table injection** | §2 | When a spec row matches, pull the entire table so the model sees the full spec. |
| **Diagram passthrough** | §3 | Carries `image_url` so relevant diagrams render in the widget. |
| **Safety-critical force-include** | §10 | Guarantees wiring/installation queries always see the safety passages. |
| **max_tokens 4096 + finish logging** | §11 | Prevents truncated technical answers and flags when it happens. |
| **Streaming (SSE)** | — | Tokens appear as they're generated — perceived speed. |
| **Conversation memory (10 turns)** | — | Real multi-turn conversations. |
| **Live product cards & page deep links** | — | Correct images/URLs from Shopify; jump-to-section links. |
| **Fast-path intents** | — | Greeting/catalog/contact answered instantly with zero model cost. |

---

## 4. The two pipelines side by side

**v1 — `/chat`:**
```
query → embed → vector top-5 → Gemma (1024 tok) → JSON answer
```

**v2 — `/chat/v2`:**
```
query
 ├─ fast-path? (greeting / catalog / contact) → fixed reply, no model
 └─ real question:
     rewrite (history-aware)
       → resolve product handles (live Shopify catalog)
       → embed rewritten query
       → hybrid retrieve 25 (vector + FTS, RRF; optional product filter; retry unfiltered)
       → rerank → keep 6
       → gate (maxSim ≥ 0.35 OR product resolved, else decline)
       → enrich: full tables + safety force-include + product cards + page deep links
       → Gemma (4096 tok, + last 10 turns), STREAMED over SSE
       → answer + meta (sources, cards, images, deep links, debug)
```

---

## 5. Data model differences

Both versions store chunks in a `documents_gemini` table with a 3072-dim embedding, but **in separate
Supabase projects**. v2's schema and ingestion add richer metadata and indexes:

| Aspect | v1 | v2 |
|---|---|---|
| Vector index | HNSW on `embedding` | HNSW on `embedding::halfvec(3072)` |
| Keyword index | — | GIN on `content_tsv` (full-text) |
| Retrieval RPC | `match_documents_gemini` (vector only) | `hybrid_match_documents_gemini` (vector + FTS + RRF + handle filter) |
| `content_type` | effectively `text` | `text` / `table` / `spec_table_row` / `diagram` / `web` |
| `table_source` | — | links spec rows to their parent table |
| `image_url` | — | diagram image in Supabase Storage |
| `is_safety_critical` | — | flags wiring/install passages |
| `product_handles` | — | product association (cards + filter) |
| `source_url` | — | web page origin (deep links) |

Because the projects are separate, **ingesting or deleting in v2 has zero effect on v1**, and vice
versa. This is what makes v2 safe to iterate on in production.

---

## 6. Which endpoint should I use?

- **Production visitors → v2** (`/chat/v2`). This is what the live widget calls.
- **v1** (`/chat`) is the **fallback / A-B baseline** — keep it working, but don't build new features
  on it.
- **New features go into v2** (`chat_v2.ts`) and, if they need new fields, into the v2 ingestion +
  migrations.

---

## 7. Ideas for a future v3 (not built)

Captured here so the trajectory is clear — none of these are implemented:

- **Source-document download** ("Sources" row): resolve each cited PDF to its Shopify Files URL and
  show download chips. Plan exists; blocked on a Shopify Admin API token. (See the plan file referenced
  in the repo.)
- **Question-level analytics**: log each query/answer/verdict to a table for insight and tuning.
- **Feedback loop**: thumbs up/down on answers to find gaps in the knowledge base.
- **HF Space keep-warm**: add the Space to the keep-warm cron so ingestion never cold-starts (offered,
  unapproved).
- **Self-hosting the models / caching embeddings** to cut OpenRouter cost at higher volume.

---

*Companion docs: `GOD_MOMO.md` (the ultimate FAQ/reference), `RAG-SYSTEM-DOCUMENTATION.md` (deep code
reference), `HANDOVER.md` (access & ops).*
