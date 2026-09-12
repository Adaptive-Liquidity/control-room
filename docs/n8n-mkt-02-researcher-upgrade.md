# MKT-02 Researcher upgrade

**Status:** v1 implemented in [`n8n/workflows/mkt-03-04-05.json`](../n8n/workflows/mkt-03-04-05.json) (same live id `Mr2NsTTTVKvuGZKa`).

**Not live until you re-import** that export **over** the existing n8n canvas and attach **Exa API** Header Auth. Do **not** import template [#2354](https://n8n.io/workflows/2354) as a new workflow. Do **not** duplicate `Mr2NsTTTVKvuGZKa`. Do **not** edit Studio Generate `58oYBY2ODlpRYhcc`.

**Out of scope:** MKT-05 publisher, live social, Notion/Sheets/Gmail, POST `/drafts` from the researcher.

---

## What changed vs the old MKT-02

Old path: one `gpt-4o-mini` call, no search, prompt allowed hypothetical sources, parse invented `{ summary, angles: [], risks: [], sources: [] }` on bad JSON, `contextPack` from policy-check was ignored.

v1 path (inside the **same** workflow):

```text
… → Assert Policy Allowed
→ MKT-02 ▪ Build research task
     (contextPack + projectId + source company from pack identity)
→ MKT-02 ▪ Exa search   (POST https://api.exa.ai/search)
→ MKT-02 ▪ Prepare researcher messages
→ MKT-02 ▪ Researcher LLM (OpenAI)
     system: contextPack JSON; user: search hits + schema
→ MKT-02 ▪ Parse Research JSON  (throw on non-JSON / missing question+summary)
→ MKT-03 ▪ Creator LLM   // unchanged consumer: $json.researchBrief
```

Template [#2354](https://n8n.io/workflows/2354) ideas kept: Exa competitor search, JSON synthesis. Dropped: chat trigger, three parallel agents, Firecrawl, SerpAPI, Notion.

---

## After import (you must do this in n8n)

1. Open existing [AEON staged marketing](https://agentsea.app.n8n.cloud/workflow/Mr2NsTTTVKvuGZKa) — **Import from File** over this workflow. Do not create a second copy.
2. Create a **Header Auth** credential named **Exa API**:
   - Header name: `x-api-key`
   - Value: Exa API key (n8n only — never Vercel / Control Room `.env`)
3. Attach that credential on **MKT-02 ▪ Exa search**. Re-attach **OpenAI account** on Researcher + Creator if import dropped it.
4. Do **not** attach Notion. Do **not** change Wait / mock publisher / Studio Generate.
5. Manual run: policy-check `allowed` → research JSON with **real Exa URLs** (or empty evidence + `openQuestions` if no hits) → Creator still emits title/body → Wait. No Notion row, no publish.

---

## `researchBrief` JSON (Creator-compatible)

Creator still concatenates `$json.researchBrief` (a **string**). Parse emits:

```json
{
  "schemaVersion": "1",
  "question": "Which treasury-ops / on-chain cash-management products should AEON position against this week?",
  "summary": "2–4 sentences. No yield promises.",
  "angles": ["…"],
  "risks": ["compliance / claims to avoid"],
  "sources": ["Title — https://…"],
  "evidence": [
    {
      "finding": "observable claim",
      "sourceIds": ["https://…"],
      "confidence": "LOW"
    }
  ],
  "openQuestions": ["…"]
}
```

Rules (enforced in Parse, not just the prompt):

- Every kept `sources[]` item must match an Exa URL or id. Invented citations are dropped.
- If search returns nothing: `sources` and `evidence` are empty; `openQuestions` must explain the gap or the node **throws**.
- Parse **throws** on non-JSON. It does not manufacture a fake brief.
- `promptVersionResearch` is `mkt-02-v2`.

---

## Risks

| Risk | Mitigation |
|---|---|
| Extra LLM + search spend | Policy-check still fails closed before this stage. One search + one synthesis in v1. |
| Hallucinated citations | Ban hypothetical sources; parse keeps only Exa locators. |
| Exa cost | v1 = Exa only. No Firecrawl / SerpAPI. |
| Duplicate webhooks | Edit `Mr2NsTTTVKvuGZKa` in place. No new workflow id. |
| Researcher posting drafts | Forbidden. Only Creator POSTs `/drafts`. |

**v2 (optional):** restore #2354’s three parallel agents (overview / product / reviews) **after** v1 is proven, still no Notion.
