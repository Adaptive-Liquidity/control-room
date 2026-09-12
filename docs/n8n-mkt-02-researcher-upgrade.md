# MKT-02 Researcher upgrade (design only)

**Status:** design only. Do **not** import n8n template [#2354](https://n8n.io/workflows/2354) as a new workflow. Do **not** edit live canvas `Mr2NsTTTVKvuGZKa` until this design is approved.

**Goal:** replace the current single-shot MKT-02 LLM (which is allowed to emit hypothetical sources) with a small search + synthesis stage that still feeds **existing** MKT-03 Creator → Wait → mock publisher.

**Out of scope:** Studio Generate (`58oYBY2ODlpRYhcc`), MKT-05 publisher, live social, Notion/Sheets/Gmail, POST `/drafts` from the researcher.

---

## What we have today

In [`n8n/workflows/mkt-03-04-05.json`](../n8n/workflows/mkt-03-04-05.json):

```text
Manual Trigger → Config Base URL
→ HMAC + POST policy-check → Assert allowed
→ MKT-02 Researcher LLM (gpt-4o-mini, no tools)
→ Parse Research JSON   // on parse failure, invents empty summary/angles
→ MKT-03 Creator (uses $json.researchBrief string)
→ drafts + Wait → mock publish
```

Gaps:

- Researcher never reads `contextPack` from policy-check (pack is fetched, then ignored).
- Prompt explicitly allows “hypothetical public themes” as `sources`.
- Parse does not fail closed on non-JSON.
- No web search; one model call is the whole “research” stage.

---

## Template #2354 vs our canvas

[#2354](https://n8n.io/workflows/2354) (Jimleuk): user names a company → Exa finds competitors → **three parallel agents** (overview / product / reviews) using Exa + SerpAPI + Firecrawl → compile report → **Notion**.

| Template piece | Action |
|---|---|
| Chat / form trigger | **Delete.** Keep Manual Trigger (and later the existing pipeline trigger). |
| Exa “find competitors” | **Keep idea.** Hardcode / config the source company as Adaptive Liquidity / AEON (from `contextPack` identity, not a chat box). |
| 3 parallel datapoint agents | **Defer.** Smallest-viable is one search + one synthesizer. Parallel agents are v2. |
| Firecrawl scrape | **Drop** for v1 (cost + another credential). |
| SerpAPI | **Drop** for v1 if Exa is attached; otherwise Exa **or** SerpAPI, not both. |
| Notion insert | **Delete.** Never write a datastore from this stage. |
| Compiled report | **Rewrite** to JSON `researchBrief` (below), then existing Creator node. |

Credentials for **v1 (smallest):** OpenAI (already on the workflow) + **one** search tool (**Exa** preferred). No Firecrawl, SerpAPI, or Notion.

---

## Target graph (v1)

Replace only the two MKT-02 nodes. Leave policy-check, Creator, drafts, Wait, mock publisher untouched.

```text
… → Assert Policy Allowed
→ MKT-02 ▪ Build research task
     (contextPack + projectId + sourceCompany from pack identity)
→ MKT-02 ▪ Exa search (HTTP Request tool or HTTP node)
→ MKT-02 ▪ Researcher LLM (OpenAI)
     system: contextPack JSON; user: search hits + “return schema”
→ MKT-02 ▪ Parse Research JSON  (throw on non-JSON / missing question+summary)
→ MKT-03 ▪ Creator LLM   // unchanged consumer: $json.researchBrief
```

Optional later: MKT-09 AgentRun `RUNNING` with `agentName: researcher` around the LLM (today only Creator/Publisher emit AgentRuns).

---

## `researchBrief` JSON (Creator-compatible)

Creator today concatenates `$json.researchBrief`. Keep **legacy keys** so Creator does not break, and add structured fields.

```json
{
  "schemaVersion": "1",
  "question": "Which treasury-ops / on-chain cash-management products should AEON position against this week?",
  "summary": "2–4 sentences. No yield promises.",
  "angles": ["…", "…", "…"],
  "risks": ["compliance / claims to avoid"],
  "sources": ["Exa: …", "label + URL or locator"],
  "evidence": [
    {
      "finding": "observable claim",
      "sourceIds": ["exa-1"],
      "confidence": "LOW"
    }
  ],
  "openQuestions": ["…"]
}
```

Rules:

- Every `sources[]` item must come from search hits (URL or Exa id). **No hypothetical sources.**
- If search returns nothing useful: `summary` may describe the gap; `evidence` empty; `openQuestions` must say so. Do not invent competitors.
- Parse node **throws** (fail the execution) on non-JSON. Do not manufacture `{ summary: rawText }`.
- Still set `researchBrief: JSON.stringify(parsed)` for Creator.

---

## Risks

| Risk | Mitigation |
|---|---|
| Extra LLM + search spend | Policy-check still fails closed before this stage. One search + one synthesis in v1. |
| Hallucinated citations | Ban hypothetical sources; parse rejects empty `sources` unless `openQuestions` explains no hits. |
| Exa / Firecrawl cost | v1 = Exa only. No Firecrawl. |
| Duplicate webhooks | Edit `Mr2NsTTTVKvuGZKa` in place. No new workflow id. |
| Researcher posting drafts | Forbidden. Only Creator POSTs `/drafts`. |

---

## Build sequence (after this design is approved)

1. In n8n, open **existing** [AEON staged marketing](https://agentsea.app.n8n.cloud/workflow/Mr2NsTTTVKvuGZKa) — do not duplicate.
2. Attach Exa credential; do not attach Notion.
3. Insert Build task + Exa HTTP + tighten Parse; pass `policy.contextPack` into the Researcher system message.
4. Re-export over `n8n/workflows/mkt-03-04-05.json`.
5. Manual run: policy-check allowed → research JSON with real URLs → Creator still emits title/body → Wait. No Notion row, no publish.

**v2 (optional):** restore #2354’s three parallel agents (overview / product / reviews) **after** v1 is proven, still no Notion.
