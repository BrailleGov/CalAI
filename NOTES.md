# CalAI — handoff notes

Last updated: 2026-10-24
Release: **v0.1.1 alpha**
Live: <https://braillegov.github.io/CalAI/>
Repo: <https://github.com/BrailleGov/CalAI>
Local project: `D:\Projects\CalAI`

Read [PLAN.md](PLAN.md) for the product roadmap and [docs/architecture.md](docs/architecture.md)
for the technical design before starting work.

## Snapshot

- Mobile-first calorie tracker PWA, public repo, deployed from `main` by GitHub Actions.
- No backend, no accounts, no runtime API calls. All diary data is local.
- `noindex` and `robots.txt` keep the alpha out of search results on purpose.
- Pages is configured with `build_type: workflow`; do not commit `dist/` or change the source
  back to a branch.
- Node 20.12 is what this machine runs; Vite is pinned to the 6 line because newer releases
  require a newer Node.

## What shipped

v0.1.0 built the core tracker:

- Onboarding with pace, body stats (metric/imperial), activity, calculated targets and manual
  override.
- Diary by meal, date navigation, portions, quick add, edit/delete.
- About 100 seed foods, custom foods, search, favorites, recents.
- Calorie ring, macros, 7-day chart, 30-day history.
- Dark/light/system themes, JSON export/import, installable offline PWA.

v0.1.1 is a storage hotfix:

- v0.1.0 hydrated asynchronously from IndexedDB. If IndexedDB was blocked (privacy settings,
  private windows, in-app browsers) or an open request never settled, the app stayed on
  "Opening your diary..." forever.
- The diary now persists synchronously in localStorage, so there is no boot gate and no splash.
- A bounded background read (1.2 s) of the old `calai:v1` IndexedDB key imports a v0.1.0 diary
  when the current state is empty/default. The old copy is left in place for now.
- If localStorage is blocked too, the app runs in memory and shows a persistent warning.
  Corrupt local JSON is discarded and the app returns to onboarding.
- No data was deleted by the migration.

## Storage details

| Key | Where | Purpose |
| --- | --- | --- |
| `calai:v1` | localStorage | Zustand persist document (diary, foods, settings) |
| `calai:legacy-checked` | localStorage | One-time IndexedDB recovery attempted |
| `calai-theme` | localStorage | Resolved theme for the pre-hydration script |

- The recovery check runs once per browser, even when Zustand has already written a default
  state. The import itself is guarded: it only replaces state that has no onboarding, no
  entries, and no custom foods.
- The legacy marker is written even if the IndexedDB read times out, so a permanently blocked
  IDB does not retry on every load.
- localStorage is small but the v0.1 payload is tiny (seed foods are static). v0.2 should move
  the growing diary to granular IndexedDB stores behind a migration.
- A failed localStorage write is caught; the UI cannot currently detect quota failures after
  the initial probe.

Support notes:

- Clearing localStorage also removes the legacy marker. If the old IndexedDB copy is still
  present, a later load can re-import that diary. This is intentional recovery behavior for
  now, not a bug to fix blindly; decide on cleanup in v0.2.
- If someone reports missing data from v0.1.0 and their localStorage has no real entries:
  export anything current first, then in devtools remove `calai:v1`, `calai:legacy-checked`,
  and reload while IndexedDB is available.
- Clearing site data removes both localStorage and the legacy IndexedDB copy.
- Export is the reliable backup; there is no server copy.

## Commands

```powershell
cd D:\Projects\CalAI
npm ci
npm run dev        # http://localhost:5173/CalAI/
npm test           # 27 unit tests
npm run typecheck
npm run build      # dist/, deployed by CI
npm run preview    # http://localhost:4173/CalAI/
```

Deployment: push to `main`; `.github/workflows/deploy.yml` runs tests, builds, and deploys.
A push takes about 45–60 seconds end to end.

## Verification status

- 27 unit tests: nutrition/target math, dates, search, backup validation, legacy state parsing.
- Ad-hoc Playwright smoke tests on Edge mobile emulation (390 × 844) and desktop:
  onboarding, logging, quick add, custom foods, editing, deletion, export/import, offline
  reload, reset, validation, imperial units, theme persistence, scroll reset, Escape handling.
- Storage failure tests: blocked IndexedDB, blocked localStorage, corrupt localStorage, seeded
  v0.1.0 IndexedDB migration, migration precedence over default state.
- axe-core: 0 WCAG 2.1 A/AA violations across onboarding, diary, sheets, foods, history, and
  settings in both themes.
- Live Lighthouse: Performance 100, Accessibility 100, Best Practices 100; SEO 60 because of
  the intentional `noindex`.
- Layout: no horizontal overflow at 360 and 390 px; frame caps at 560 px on desktop.
- Bundle: 73.3 KB JS and 5.8 KB CSS gzip.

## Known issues and gaps

1. The Playwright suites used for QA live in a temp folder and are **not committed**. CI runs
   only unit tests. Storage regressions should become committed E2E tests.
2. Only Edge/Chromium emulation was tested. No physical iOS Safari, installed iOS PWA,
   Android Chrome, Firefox, or real offline/update test.
3. Service worker updates may require a reload; there is no "update available" prompt and
   navigation is served from precache first.
4. The old IndexedDB key is retained after migration. Decide whether to delete it after
   confirming the localStorage write, or expose a cleanup.
5. localStorage capacity and eviction are real constraints; the app requests persistent
   storage on first log and asks users to export, but there is no quota UI.
6. No accounts/sync; data is per browser profile. Private mode and blocked storage are
   degraded to in-memory with a warning.
7. No error monitoring or analytics. Adding either needs a privacy decision.
8. `noindex`, `robots.txt`, privacy policy, terms, and an AI/health disclaimer still need
   launch work.
9. No barcode, remote food database, recipes, weight/water/exercise, reminders, photo/text
   logging, or chat yet. These are sequenced in PLAN.md.
10. Day keys are local calendar dates. Travel across time zones and DST is handled by the
    date helpers but not tested on a real device.
11. Target math is a generic estimate with a 1,200 kcal floor, not medical advice.
12. A few labels are visually tiny (8–9 px mono). axe passes; a typography pass is still
    worthwhile.

## Next session priorities

P0 — before new features:

1. Commit a Playwright E2E suite for core flows and storage failure modes; run it in CI.
2. Test the installed PWA on a real iPhone and Android device, including offline reload and
   service worker update.
3. Decide on legacy IDB cleanup and add a safe migration completion check.
4. Add a service-worker update prompt or improve navigation caching, then test an upgrade from
   v0.1.1 to the next build.

P1 — v0.2 "faster logging" (needs approval):

- Remote food search (Open Food Facts + USDA) behind a Cloudflare Worker with KV caching and
  attribution.
- Barcode scanning with BarcodeDetector and a ZXing fallback.
- Favorites/recents polish, copy day/meal, recipes.
- Weight and water logging.
- Reminders: in-app/`.ics` first, then Web Push via Worker cron and VAPID.

P2 — v0.3 AI:

- Photo recognition and natural-language logging with confirmation sheets.
- Chat grounded in locally computed aggregates; quotas, consent, provider fallback.
- Evaluation set before release.

Open decisions:

- Approve v0.2 scope and the Cloudflare Worker backend.
- Choose the AI provider and a hard monthly budget cap.
- Accounts/sync: defer to v1.0 or earlier?
- Monetisation: none during alpha.
- Visual direction beyond the current lime-on-black utility look.
- Legal/privacy owner and contact address before public launch.

## Resume prompt

Paste this into the next session:

```text
Resume the CalAI project at D:\Projects\CalAI (live: https://braillegov.github.io/CalAI/,
repo: https://github.com/BrailleGov/CalAI). It is a mobile-first calorie tracker PWA at
v0.1.1 alpha. First read PLAN.md, docs/architecture.md, and NOTES.md, then inspect the repo
and live site.

Context: v0.1.1 fixed a boot hang caused by blocked IndexedDB by moving the diary to
synchronous localStorage, with a bounded one-time recovery read from the old IndexedDB data.
Do not rebuild v0.1 or change the storage model again without a clear reason. All data is
local, there is no backend, no accounts, and index.html still has noindex intentionally.
Deployment is via GitHub Actions from main (Pages build_type: workflow); do not commit dist/.

Start by running npm ci, npm test, npm run typecheck, and npm run build. Verify the live app
briefly. Then propose and implement the highest-priority v0.2 work: remote food search
(Open Food Facts + USDA via a Cloudflare Worker with caching), barcode scanning, recipes,
weight/water, and reminders (local/.ics first, then Web Push). Before any new feature work,
commit the Playwright regression suite for core flows and storage failure modes and run it in
CI, since those tests currently exist only as ad-hoc scripts.

Guardrails: preserve local-first behavior and offline support; confirmation before destructive
or AI-driven writes; keep accessibility clean (axe 0 violations); keep the bundle lean; keep
the app usable when storage or network is blocked. Ask for approval only for decisions that
change product scope, provider spend, accounts/sync, or monetisation. Update README, PLAN,
docs/architecture.md, and these notes with what shipped, verification results, and remaining
risks at the end of the session.
```
