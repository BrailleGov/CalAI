# CalAI — handoff notes

Last updated: 2026-10-24
Release: **v0.2.0 alpha**
Live: <https://braillegov.github.io/CalAI/>
Repo: <https://github.com/BrailleGov/CalAI>
Local project: `D:\Projects\CalAI`

Read [PLAN.md](PLAN.md) for the product roadmap and [docs/architecture.md](docs/architecture.md)
for the technical design before starting work.

## Snapshot

- Mobile-first calorie tracker PWA, public repo, deployed from `main` by GitHub Actions.
- No accounts and no analytics. The diary is local; online food search is the only runtime
  read, and it falls back to local foods when the network is unavailable.
- `noindex` and `robots.txt` keep the alpha out of search results on purpose.
- Pages is configured with `build_type: workflow`; do not commit `dist/` or change the source
  back to a branch.
- Node 20.12 is what this machine runs; Vite is pinned to the 6 line because newer releases
  require a newer Node.
- Optional Cloudflare Worker code lives in `worker/`. It is **not deployed** yet, so the live
  static app queries Open Food Facts directly and push is inactive.

## What shipped

v0.1.0 built the core tracker:

- Onboarding with pace, body stats (metric/imperial), activity, calculated targets and manual
  override.
- Diary by meal, date navigation, portions, quick add, edit/delete.
- About 100 seed foods, custom foods, search, favorites, recents.
- Calorie ring, macros, 7-day chart, 30-day history.
- Dark/light/system themes, JSON export/import, installable offline PWA.

v0.1.1 was a storage hotfix:

- v0.1.0 hydrated asynchronously from IndexedDB. If IndexedDB was blocked (privacy settings,
  private windows, in-app browsers) or an open request never settled, the app stayed on
  "Opening your diary..." forever.
- The diary now persists synchronously in localStorage, so there is no boot gate and no splash.
- A bounded background read (1.2 s) of the old `calai:v1` IndexedDB key imports a v0.1.0 diary
  when the current state is empty/default. The old copy is left in place for now.
- If localStorage is blocked too, the app runs in memory and shows a persistent warning.
  Corrupt local JSON is discarded and the app returns to onboarding.

v0.2.0 adds the "faster logging" release:

- **Remote food search** (Open Food Facts direct; Worker proxy with KV cache + optional USDA).
  Results show their source, filter out names that do not match the query, and foods you log
  are cached locally (100-item cap) for offline reuse.
- **Barcode lookup**: `BarcodeDetector`, lazy `@zxing/browser` fallback, and manual 8–14 digit
  entry. Camera frames stay on-device.
- **Recipes**: build from foods, set servings, edit/delete, log a portion to any meal.
- **Weight**: latest, 7-day average, SVG trend, upsert per day, delete with confirmation.
- **Water**: quick add, configurable goal, progress bar, undo.
- **Reminders**: off by default; per-meal times, quiet hours, in-app banner, daily `.ics`
  download. Web Push client + Worker subscribe/cron code are present but require configuration.
- **Playwright regression suite** committed under `e2e/` and run in CI before deploy.
- **Storage schema v2** on the same synchronous localStorage document. v1 state/backups and
  v0.1.0 IndexedDB diaries migrate automatically.

## Storage details

| Key | Where | Purpose |
| --- | --- | --- |
| `calai:v1` | localStorage | Zustand persist document (schema v2) |
| `calai:legacy-checked` | localStorage | One-time IndexedDB recovery attempted |
| `calai-theme` | localStorage | Resolved theme for the pre-hydration script |
| `calai:device` | localStorage | Random device token for optional Worker push/search |
| `calai:reminder-dismissed:YYYY-MM-DD:meal` | localStorage | Per-day banner dismissal |

Schema v2 adds `remoteFoods` (cap 100), `recipes`, `weights`, `water`, `reminders`, and
`settings.waterGoalMl`. All other v1 fields are unchanged. `validatePersistedData` accepts v1
and migrates it in memory; the storage adapter returns version 2 so Zustand does not need an
async migration gate.

- The recovery check runs once per browser, even when Zustand has already written a default
  state. The import is guarded: it only replaces state that has no onboarding, no entries,
  and no custom foods.
- The legacy marker is written even if the IndexedDB read times out, so a permanently blocked
  IDB does not retry on every load.
- The old IndexedDB copy is still retained after migration. Decide on cleanup in v0.2.x.
- localStorage is small but the payload is still modest (seed foods are static; remote cache is
  capped). No quota UI; a failed write is caught but not surfaced after the initial probe.

Support notes:

- Clearing localStorage removes the legacy marker. If the old IndexedDB copy is still
  present, a later load can re-import that diary. This is intentional recovery behavior for
  now; test carefully before changing it.
- If someone reports missing data from v0.1.0 and their localStorage has no real entries:
  export anything current first, then in devtools remove `calai:v1`, `calai:legacy-checked`,
  and reload while IndexedDB is available.
- Clearing site data removes both localStorage and the legacy IndexedDB copy.
- Export is the reliable backup; there is no server copy of the diary.

## Commands

```powershell
cd D:\Projects\CalAI
npm ci
npm run dev        # http://localhost:5173/CalAI/
npm test           # 46 unit tests
npm run typecheck
npm run build      # dist/, deployed by CI
npm run test:e2e   # build + 30 Playwright tests
npm run preview    # http://localhost:4173/CalAI/
```

Windows build workaround: if esbuild reports `Access is denied` deleting a file in `%TEMP%`,
point `TEMP`/`TMP` at the ignored local `.tmp` folder before `npm run build`:

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
$env:TEMP="$PWD\.tmp"; $env:TMP="$PWD\.tmp"
npm run build
```

Worker:

```powershell
cd worker
npm install
npm run typecheck
npx wrangler dev
# deploy after creating KV + secrets; see worker/README.md
```

Deployment: push to `main`; `.github/workflows/deploy.yml` runs unit tests, typecheck, build,
installs Chromium, runs Playwright, then deploys. A failed E2E run blocks the upload. A normal
push takes about 60–90 seconds.

## Verification status

- 46 unit tests: nutrition/target math, dates, search, backup validation and v1→v2 migration,
  legacy state parsing, recipes, reminders and `.ics`, remote OFF parsing, Worker
  normalization/relevance.
- 30 Playwright tests on Chromium at 390 × 844 (Pixel 7 descriptor):
  onboarding in metric and imperial, logging, quick add, custom foods, favorites, entry
  edit/delete, export/import, malformed imports, reset, theme persistence, scroll reset,
  Escape/dialog behavior, offline reload, blocked localStorage, blocked IndexedDB, corrupt
  state, legacy IDB recovery and precedence, online search success/failure, manual barcode
  lookup, recipe create/log, water add/undo/reload, weight log/reload, reminder banner + `.ics`,
  horizontal overflow at 360/390 px, and axe scans.
- axe-core: 0 WCAG 2.1/2.2 A/AA violations across onboarding, Today, add/edit sheets, foods,
  recipes, recipe form, history, settings, expanded reminders, and barcode in both themes.
- Layout: no horizontal overflow at 360 and 390 px on Today, Foods, Recipes, History, Settings;
  five-item bottom navigation fits.
- Live Open Food Facts search smoke test returned results in the preview app. E2E uses mocked
  OFF responses so it does not depend on the public API.
- Bundle: initial JS 87.0 KB gzip + 2.4 KB workbox window; CSS 6.9 KB gzip; lazy ZXing chunk
  108.7 KB gzip. PWA precache 17 entries (751.0 KiB).
- Not re-run in this session: Lighthouse on the v0.2 bundle, physical iOS/Android devices,
  installed-PWA push, USDA live calls, Worker deployment.

## Known issues and gaps

1. **Worker is not deployed.** Live search uses direct Open Food Facts (no KV cache, no USDA,
   no server-side rate cap) and push is inactive. Create a KV namespace, set secrets, deploy,
   then rebuild with `VITE_API_BASE` and `VITE_VAPID_PUBLIC_KEY`. See `worker/README.md`.
2. **Web Push is untested end-to-end.** Client subscribe, Worker storage/cron, and service
   worker handlers are code-complete, but no VAPID keys or installed PWA were available.
   Verify on Android Chrome and iOS 16.4+ installed PWA before claiming support.
3. **Physical camera scanning is untested.** Manual barcode entry is covered; the
   `BarcodeDetector` and ZXing paths need a real device camera and permission-denied cases.
4. **USDA provider is untested against the live API.** No USDA key was available. Normalization
   and relevance are unit-tested with fixture data.
5. **Open Food Facts relevance is uneven.** Generic queries sometimes return unrelated
   products; both client and Worker now drop results whose name/brand lacks every query token.
   Seed foods remain the primary offline path. Consider a small curated remote cache for
   common foods later.
6. Only Chromium was tested. No physical iOS Safari, installed iOS PWA, Android Chrome,
   Firefox, or real update test.
7. Service worker updates use `skipWaiting`; there is still no "update available" prompt, and
   an update can reload mid-entry. Keep this on the v0.2.x list.
8. The old IndexedDB key is retained after migration. Decide whether to delete it after
   confirming the localStorage write, or expose a cleanup.
9. localStorage capacity and eviction remain real constraints; no quota UI. Recipes, weight,
   water, and the capped remote cache increase payload but remain small in normal use.
10. No accounts/sync; data is per browser profile. Private mode and blocked storage degrade to
    in-memory with a warning.
11. No error monitoring or analytics. Adding either needs a privacy decision.
12. `noindex`, `robots.txt`, privacy policy, terms, and an AI/health disclaimer still need
    launch work. Data-source attribution exists in the UI copy but not a dedicated legal page.
13. Day keys are local calendar dates. Travel across time zones and DST is handled by the
    date helpers but not tested on a real device.
14. Target math is a generic estimate with a 1,200 kcal floor, not medical advice.
15. A few labels are visually tiny (8–9 px mono). axe passes; a typography pass is still
    worthwhile.
16. `npm audit` reports dev-only vulnerabilities in Vitest/tinypool (critical fix requires a
    Vitest major) and moderate React Router advisories (fix requires v7). Runtime production
    dependencies are limited to React, Zustand, idb-keyval, react-router-dom, and @zxing;
    assess the Router advisory before any user-controlled navigation is added.

## Next session priorities

P0 — before v0.3:

1. Deploy the Worker with KV, configure USDA + VAPID secrets, rebuild the PWA with
   `VITE_API_BASE`/`VITE_VAPID_PUBLIC_KEY`, and smoke-test cached search + push.
2. Test the installed PWA on a real iPhone and Android device: offline reload, camera barcode,
   reminders, push permission/denial, and service worker update.
3. Add a non-blocking "update available" prompt and test an upgrade from v0.2.0.
4. Decide on legacy IDB cleanup and add a safe migration completion check.
5. Run Lighthouse and a device performance pass; compare against the v0.1 numbers (initial JS
   is now 87.0 KB gzip, still under the 200 KB budget).

P1 — v0.2.x polish:

- Remote search quality: consider a small curated remote cache, image thumbnails, and
  copy-yesterday/copy-meal.
- Exercise logging displayed separately from the calorie budget (explicitly deferred).
- Remote-food cache management/clear action; localStorage quota indicator.
- Recipe editing refinements (ingredient quantity input handling on mobile).
- Data-source attribution/legal page before public launch.

P2 — v0.3 AI:

- Photo recognition and natural-language logging with confirmation sheets.
- Chat grounded in locally computed aggregates; quotas, consent, provider fallback.
- Evaluation set before release.

Open decisions:

- Worker deployment owner and Cloudflare account/KV namespace.
- USDA key ownership; whether to ship branded USDA results.
- Accounts/sync: defer to v1.0 or earlier?
- Monetisation: none during alpha.
- Visual direction beyond the current lime-on-black utility look.
- Legal/privacy owner and contact address before public launch.

## Resume prompt

Paste this into the next session:

```text
Resume the CalAI project at D:\Projects\CalAI (live: https://braillegov.github.io/CalAI/,
repo: https://github.com/BrailleGov/CalAI). It is a mobile-first calorie tracker PWA at
v0.2.0 alpha. First read PLAN.md, docs/architecture.md, and NOTES.md, then inspect the repo
and live site.

Context: v0.1.1 fixed a boot hang caused by blocked IndexedDB by moving the diary to
synchronous localStorage. v0.2.0 added schema v2 (saved online foods, recipes, weight, water,
reminders), direct Open Food Facts search, barcode lookup, recipes, weight/water, local/.ics
reminders, a committed Playwright + axe suite in CI, and an optional Cloudflare Worker for KV
caching, USDA, and Web Push. Do not rebuild v0.1 or reintroduce an async storage boot gate.
All diary data is local; there is no backend for the diary, no accounts, and index.html still
has noindex intentionally. Deployment is via GitHub Actions from main (Pages build_type:
workflow); do not commit dist/.

Start by running npm ci, npm test, npm run typecheck, npm run test:e2e, and npm run build.
Verify the live app briefly. Then deploy/configure the Worker (KV, USDA key, VAPID), smoke-test
cached search and Web Push, test the installed PWA on physical iOS/Android, and add a
service-worker update prompt. Keep the bundle lean and axe at 0 violations.

Guardrails: preserve local-first behavior and offline support; confirmation before destructive
or AI-driven writes; keep accessibility clean; keep the app usable when storage or network is
blocked. Ask for approval only for decisions that change product scope, provider spend,
accounts/sync, or monetisation. Update README, PLAN, docs/architecture.md, and these notes with
what shipped, verification results, and remaining risks at the end of the session.
```
