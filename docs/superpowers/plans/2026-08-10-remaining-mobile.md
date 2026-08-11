# Remaining Pages + Type Floors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the mobile retrofit — Agents, Library, Audit, Settings, and Team invite controls usable on phones; enforce ≥12px caption / ≥14px body floors on phone via `sm:`-scoped microtype.

**Architecture:** Pure Tailwind breakpoint changes. No new components. Type floors are applied centrally on `Badge` plus page-local captions touched in this plan; desktop (`≥sm`) keeps existing 9.5–11px density.

**Tech Stack:** Next.js 14, TypeScript, Tailwind 3.4, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-10-mobile-responsive-design.md` (sections 3 item 6, 4). Plans 1–4 are on this branch.

## Global Constraints

- Desktop (`≥sm` / `≥md` as noted) must remain visually equivalent to today.
- Phone tap targets ≥44px; caption text ≥12px (`text-xs`); body/input ≥14px (`text-sm`).
- Commit steps: `git add` **only the exact files listed** — working tree has unrelated in-flight work. **Never** `git add -A` (`.cursor/rules/staging-prod.mdc` has a real password).
- **Dirty-file warning (PROCESS FIX from Plan 4):** These targets already contain uncommitted Phase-2 expansions:
  - `src/app/(main)/agents/page.tsx` (modified — live agent telemetry)
  - `src/app/(main)/library/page.tsx` (modified — asset upload)
  - `src/app/(main)/settings/page.tsx` (modified — integration health)
  - `src/app/(main)/audit/page.tsx` (**untracked** — new audit console)
  Apply mobile edits on top of the current working-tree content. Commits will include those Phase-2 expansions (declare in commit body; do not revert).
- E2E gated on `E2E_WITH_AUTH=1` + seeded users. Prefer a fresh `npm run dev` + warm routes before Playwright.
- Gates: `npm test` (62/62), `npm run typecheck`, `npm run lint`, Playwright mobile suite.

---

### Task 1: Remaining pages mobile pass

**Files:**
- Modify: `src/app/(main)/agents/page.tsx`
- Modify: `src/app/(main)/library/page.tsx`
- Modify: `src/app/(main)/audit/page.tsx` (currently untracked — add when committing)
- Modify: `src/app/(main)/settings/page.tsx`
- Modify: `src/app/(main)/team/page.tsx`
- Test: `e2e/mobile.spec.ts` (append)

**Interfaces:** no new exports. E2E uses role/text selectors.

- [ ] **Step 1: Agents**

In `src/app/(main)/agents/page.tsx`:

1. Loading skeleton — collapse on phone:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

2. Metric labels (inside the metrics map) — type floor:

```tsx
<div className="text-xs uppercase tracking-[0.06em] text-muted-foreground sm:text-[10px]">
```

3. Type/meta line and recent-runs mono block — type floor:

```tsx
<div className="mb-2 text-xs text-muted-foreground sm:text-[11px]">
```

```tsx
<div className="space-y-1 rounded-md border border-border bg-secondary/50 p-3 font-mono text-xs text-muted-foreground sm:text-[11px]">
```

4. MCP endpoint mono — type floor:

```tsx
<div className="truncate font-mono text-xs text-muted-foreground sm:text-[10px]">
```

- [ ] **Step 2: Library**

In `src/app/(main)/library/page.tsx`:

1. Loading skeleton:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
```

2. Mime chip — type floor:

```tsx
<div className="mb-3 inline-flex rounded-md border border-border bg-secondary px-2 py-0.5 text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[10px]">
```

3. Upload row — stack on phone:

```tsx
<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
```

Upload `Button` already uses `size="sm"` (phone `h-11` from Plan 1). Keep it.

- [ ] **Step 3: Audit**

In `src/app/(main)/audit/page.tsx` (working-tree file):

1. Row layout — stack timestamp above content on phone; side-by-side from `sm`:

```tsx
<div key={item.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:gap-4">
  <div className="shrink-0 font-mono text-xs text-muted-foreground sm:w-40 sm:text-[11px]">
    {new Date(item.createdAt).toLocaleString()}
  </div>
  ...
```

2. Meta line — type floor + allow wrap on phone:

```tsx
<div className="mt-1 break-all font-mono text-xs text-muted-foreground sm:truncate sm:text-[10px]">
```

- [ ] **Step 4: Settings**

In `src/app/(main)/settings/page.tsx`:

1. `inputClass` — touch height on phone:

```tsx
const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring sm:h-9";
```

2. Tabs — horizontal scroll on phone (no wrap crush), min touch height:

```tsx
<div className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 scrollbar-hide sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
```

Each tab button:

```tsx
className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors sm:px-5 ${
  activeTab === tab.id
    ? "border-primary text-primary"
    : "border-transparent text-muted-foreground hover:text-foreground"
}`}
```

3. Guardian rules grid — stack on phone:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
```

4. Approval step desc — type floor:

```tsx
<div className="text-xs text-muted-foreground sm:text-[11px]">{step.desc}</div>
```

- [ ] **Step 5: Team invite inputs**

In `src/app/(main)/team/page.tsx`, update `inputClass` only (table already ResponsiveTable):

```tsx
const inputClass =
  "h-11 w-full rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring sm:h-9";
```

- [ ] **Step 6: E2E (append to `e2e/mobile.spec.ts`)**

```ts
test.describe('phone remaining pages (requires seeded users)', () => {
  test.skip(!process.env.E2E_WITH_AUTH, 'Set E2E_WITH_AUTH=1 and seed users to run');

  test('agents / library / audit / settings fit viewport', async ({ page }) => {
    test.skip(isTablet(), 'phone-only assertions');
    await signIn(page, ADMIN_EMAIL, ADMIN_PASSWORD);

    for (const path of ['/agents', '/library', '/audit', '/settings']) {
      await page.goto(path);
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth
      );
      expect(overflows, `${path} should not overflow horizontally`).toBe(false);
    }

    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Integration Health' })).toBeVisible();
    await page.getByRole('button', { name: 'Guardian Rules' }).click();
    await expect(page.getByText('Sensitivity')).toBeVisible();
  });
});
```

- [ ] **Step 7: Verify + commit**

```bash
npm test
npm run typecheck
# Fresh next if needed, then:
$env:E2E_WITH_AUTH=1; npx playwright test e2e/mobile.spec.ts --project=mobile-chrome
```

```bash
git add src/app/(main)/agents/page.tsx src/app/(main)/library/page.tsx src/app/(main)/audit/page.tsx src/app/(main)/settings/page.tsx src/app/(main)/team/page.tsx e2e/mobile.spec.ts
git commit -m "$(cat <<'EOF'
feat(mobile): remaining pages phone pass (agents, library, audit, settings, team)

Collapses loading skeletons and audit rows on phone, scrollable settings tabs,
touch-height inputs. Includes in-flight Phase-2 page expansions already present
in the working tree (same declare precedent as Plan 4).

EOF
)"
```

On Windows PowerShell, use a here-string for the commit message if bash HEREDOC is unavailable.

---

### Task 2: Type floors (Badge + phone chrome captions)

**Files:**
- Modify: `src/components/ui/badge.tsx`
- Modify: `src/components/layout/more-sheet.tsx`
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/ui/responsive-table.tsx`
- Modify: `src/app/(main)/dashboard/page.tsx` (StatLabel only if present)
- Optional touch-ups if still failing floor on phone-visible surfaces only: queue review labels, campaigns card caption, analytics/attribution card labels — apply same `text-xs sm:text-[Npx]` pattern. **Do not** change sidebar microtype (desktop/tablet only). **Do not** change calendar month-grid captions (already `hidden md:grid`).

- [ ] **Step 1: Badge**

```tsx
"inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide transition-colors sm:text-[10px]",
```

- [ ] **Step 2: More sheet (phone-only chrome)**

Section labels: `text-xs` (drop `text-[10px]`).
User role mono: `text-xs` (drop `text-[11px]`).
Avatar initials: keep `text-[10px]` only if the circle is decorative; prefer `text-xs`.

- [ ] **Step 3: Header subtitle**

```tsx
<p className="truncate text-xs text-muted-foreground sm:text-[11px]">{pageInfo.subtitle}</p>
```

- [ ] **Step 4: ResponsiveTable header row**

```tsx
<tr className="border-b border-border text-left text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground sm:text-[11px]">
```

(Table is `hidden md:…` for the real table path — card path may still show labels; if card labels already use `text-xs`, leave them.)

- [ ] **Step 5: Dashboard StatLabel** (if `text-[10px]`):

```tsx
className="font-mono text-xs uppercase tracking-[0.08em] text-muted-foreground/80 sm:text-[10px]"
```

- [ ] **Step 6: Phone-visible leftovers** — grep for `text-\[(9\.5|10|11)px\]` under `src/app/(main)` and `src/components/layout/more-sheet.tsx` / `header.tsx`. For any that render below `md` without an `sm:`/`md:`/`lg:` prefix on a parent that hides them, apply `text-xs sm:text-[Npx]`. Skip sidebar and calendar month grid.

- [ ] **Step 7: Verify + commit**

```bash
npm test
npm run typecheck
$env:E2E_WITH_AUTH=1; npx playwright test e2e/mobile.spec.ts --project=mobile-chrome
```

```bash
git add src/components/ui/badge.tsx src/components/layout/more-sheet.tsx src/components/layout/header.tsx src/components/ui/responsive-table.tsx src/app/(main)/dashboard/page.tsx
# plus any leftover pages touched in Step 6
git commit -m "$(cat <<'EOF'
fix(mobile): enforce phone type floors on badges and captions

Badge and phone-chrome captions use text-xs below sm; desktop keeps 10–11px
microtype density.

EOF
)"
```

---

## Done when

- Agents / Library / Audit / Settings / Team invite are usable at 390×844 without horizontal overflow.
- Phone captions ≥12px on Badge and surfaces touched above.
- Jest 62/62, typecheck clean, mobile-chrome Playwright green.
- Both commits pushed; PR #3 body can note Plan 5 complete.
