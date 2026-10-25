# CalAI — plan (draft)

No app code is being written yet. This is the working plan to approve or amend before the
first real milestone.

## 1. Product brief

A calorie tracker that feels native on a phone but installs from the web. The core loop is:
open → log what you ate → see where you stand → close. Everything else is secondary.

Primary audience: one person tracking their own intake, one-handed, in a kitchen or a queue,
with intermittent connectivity.

Success criteria for v1:

- Log a common food in under 15 seconds, thumb-only.
- Work fully offline after first load; data survives refreshes and updates.
- No account required to start.
- Readable at 360 px wide, usable with large text and reduced motion.

## 2. Scope

### In v1

- Daily diary split into meals, with a running calorie and macro total.
- Targets: calorie goal plus protein / carbs / fat, with a simple maintenance calculator.
- Food library: recent, frequent, custom foods, and saved servings.
- Quick add by calories for unlisted items.
- Day navigation and a short history view (7 / 30 days).
- Units and locale-aware number formatting.
- Local-first storage with JSON export and import.
- Installable PWA with an offline shell.

### Deliberately later

- Accounts, cloud sync, and multi-device merge.
- Barcode scanning and a large verified food database.
- AI-assisted entry (natural language or photo) — the name suggests it, but it lands after
  the manual loop is fast and correct.
- Social features, streaks, gamification.
- Native wrappers.

## 3. UX principles

- Thumb-first: primary actions in the lower third; bottom navigation, not a hamburger.
- One decision per screen; no nested modals.
- Numeric keypad for numbers, steppers for portions, big tap targets (≥ 44 px).
- Show progress, not judgement: no red "failure" states.
- Dark and light themes, both designed — not inverted defaults.
- Motion is short and functional; respects `prefers-reduced-motion`.

## 4. Recommended stack

Recommended: **Vite + React + TypeScript**, plain modern CSS (custom properties, no UI kit),
IndexedDB via `idb`, `vite-plugin-pwa` for the manifest and offline shell.

Why:

- React keeps the diary, food picker, and target editor predictable as state grows.
- Vite gives fast local feedback and a clean static build for Pages.
- IndexedDB handles a growing food library and history without size anxiety.
- No backend means no auth, no hosting cost, and a genuinely local-first v1.

Alternatives if simplicity is preferred: vanilla TypeScript with Web Components (smaller
payload, more hand-written state) or Svelte (less runtime). All three deploy the same way.

## 5. Data model sketch

- `food`: id, name, brand?, serving label, grams?, kcal, protein, carbs, fat, source
  (`custom | builtin | recent`), createdAt, archived.
- `entry`: id, foodId or inline snapshot, date key (`YYYY-MM-DD` local), meal
  (`breakfast | lunch | dinner | snack`), quantity, unit, computed nutrition snapshot.
- `goal`: kcal, protein, carbs, fat, weight?, height?, age?, activity?, formula version.
- `settings`: theme, units (`metric | imperial`), week start, first day, schema version.

Entry nutrition is snapshotted so editing a food never rewrites history. All day keys are
computed in local time near midnight, not UTC.

## 6. Architecture

- Routes: `/` (today), `/history`, `/foods`, `/settings`; add-food and edit-food as sheets.
- Pure calculation module for targets, totals, and date helpers — unit-tested first.
- State: a typed reducer or small store; persistence behind a storage interface so a sync
  backend can be added later without touching screens.
- Schema version in storage with a migration path from day one.
- Accessibility is part of definition-of-done: labels, focus order, live regions for totals.

## 7. Milestones

| # | Milestone | Done when |
| --- | --- | --- |
| M0 | Foundation | Repo, Pages, HTTPS, 404, placeholder live. **Done.** |
| M1 | App shell | Vite app builds, design tokens, bottom nav, empty diary, deployed via Actions. |
| M2 | Logging core | Add/edit/delete entries, food picker, custom foods, totals update, persisted. |
| M3 | Targets and history | Goal calculator, macro rings/bars, day navigation, 7/30-day view. |
| M4 | Offline and data | Installable PWA, offline shell, export/import, migrations. |
| M5 | Polish and launch | Empty states, onboarding, performance pass, a11y audit, remove `noindex`. |

Each milestone ends with a deployment check on a real phone viewport.

## 8. Deployment changes at M1

- Set Vite `base: '/CalAI/'`.
- Add `.github/workflows/deploy.yml` using `actions/configure-pages`, `actions/upload-pages-artifact`,
  and `actions/deploy-pages`.
- Change the Pages source to **GitHub Actions** (`build_type: workflow`) via the API or Settings.
- Publish `dist/` with `.nojekyll`; copy `index.html` to `404.html` if routing needs it.

## 9. Open decisions

1. Approve the stack (React vs vanilla TS vs Svelte).
2. Targets: simple TDEE estimate, manual entry, or both? (Recommend both, calculator first.)
3. Is a verified food database in scope, or is "recent + custom" enough for v1?
4. Does "AI" mean natural-language logging in v1.1, or is the name just branding for now?
5. Visual direction: keep the current lime-on-black utilitarian look, or explore a warmer,
   food-friendly palette?
