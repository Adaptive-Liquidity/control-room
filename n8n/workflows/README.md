# n8n workflow exports

Importable snapshots of the AEON Control Room execution plane (n8n Cloud).

| File | Workflow | Live URL |
|---|---|---|
| `mkt-03-04-05.json` | Staged Agentic Marketing (policy → research → creator → Wait → mock publish → AgentRuns) | https://agentsea.app.n8n.cloud/workflow/Mr2NsTTTVKvuGZKa |
| `mkt-06-metrics.json` | Metrics/Attribution stub (HMAC → HQ ingresses) | https://agentsea.app.n8n.cloud/workflow/2lYDNN28W8gMrGtC |

Contracts, HMAC, and node map: [docs/n8n-bridge.md](../../docs/n8n-bridge.md).

After import, re-attach credentials (Ingress HMAC crypto + OpenAI). Do not commit secret values. Re-export from n8n when the live canvas changes meaningfully.
