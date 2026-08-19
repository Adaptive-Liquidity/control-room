# Figma capture (deferred — optional PR5)

Run **after** D1–D2 are deployed to HQ (`https://hq.adaptiveliquidity.com`).

## Prerequisites

- Figma MCP connected in Cursor (`plugin-figma-figma`)
- Skills: `/figma-generate-design`, `/figma-code-connect`

## Steps

1. `create_new_file` — AEON Control Room — Operator Primitives
2. `generate_figma_design` from live routes:
   - `/dashboard` (EmptyState + IntegrationStrip visible if integrations missing)
   - `/queue` (Tabs filters)
   - `/studio` (plain-text + Generate with AI)
3. `code-connect` map primitives:
   - `Input` → `src/components/ui/input.tsx`
   - `Tabs` → `src/components/ui/tabs.tsx`
   - `EmptyState` → `src/components/ui/empty-state.tsx`
   - `Toast` → `src/components/ui/toast.tsx`

No automated capture in CI — manual operator design library sync only.
