# CalAI

A mobile-first calorie tracker that installs from the web and works offline.

**v0.2.0 alpha** — live at <https://braillegov.github.io/CalAI/>

## What works

- First-run onboarding: goal, pace, body stats (metric or imperial), activity, calculated
  calorie and macro targets with manual override.
- Daily diary by meal, date navigation, portions, quick add, edit and delete.
- Food library: ~100 common foods, custom foods, search, favorites, recents.
- Online food search (Open Food Facts) with source labels, relevance filtering, and a local
  cache of foods you log. Works without a Worker when `VITE_API_BASE` is unset.
- Barcode lookup: `BarcodeDetector` with a lazy-loaded ZXing fallback, plus a manual
  barcode-entry path for browsers without a camera.
- Recipes: build a batch from foods, set servings, log a portion; past entries keep their
  nutrition snapshot.
- Weight log with latest value, 7-day average, and a compact SVG trend line.
- Water quick add with a configurable daily goal and undo.
- Reminders: off by default; in-app banner during a 90-minute window, quiet hours, and a
  daily `.ics` calendar download. Web Push client and Worker code are included behind
  `VITE_API_BASE` + VAPID configuration.
- Calorie ring, macro progress, 7-day chart, 30-day history.
- Dark, light, and system themes; metric/imperial display.
- Full JSON export and validated import, including automatic migration of v0.1 backups.
- Installable PWA with a fully offline diary; data lives in local storage.
- Accessible dialogs, keyboard support, reduced-motion support, mobile safe areas.

Not in v0.2: accounts, sync, photo or text logging, AI chat, social features. The Cloudflare
Worker for cached search, USDA results, and Web Push is implemented but not deployed from
this repository's Pages workflow. See [docs/architecture.md](docs/architecture.md) for the
deployment steps and [PLAN.md](PLAN.md) for scope.

## Stack

Vite 6, React 18, TypeScript, Zustand with synchronous localStorage persistence (schema v2),
HashRouter, plain CSS with design tokens, and a hand-written service worker via
`vite-plugin-pwa` injectManifest. No accounts and no analytics.

The optional backend is a Cloudflare Worker in `worker/` (TypeScript, KV cache, Open Food
Facts + USDA providers, Web Push with VAPID). `@zxing/browser` is loaded only when a browser
lacks `BarcodeDetector`.

## Structure

```
.
├── index.html                  # Vite entry
├── public/                     # icons, 404, robots, .nojekyll
├── src/
│   ├── app shell + routing     # App.tsx
│   ├── components/             # Sheet, Toast, ring, nav, icons
│   ├── features/
│   │   ├── onboarding/
│   │   ├── today/              # diary, add/edit sheets, barcode scanner
│   │   ├── foods/
│   │   ├── recipes/
│   │   ├── history/            # trends and weight
│   │   └── settings/           # targets, water goal, reminders, data
│   ├── data/seedFoods.ts
│   ├── lib/                    # dates, nutrition, search, backup, remote, recipes, push
│   ├── store/useAppStore.ts
│   ├── styles/global.css
│   ├── sw.ts                   # precache, offline shell, push handlers
│   └── types.ts
├── worker/                     # optional Cloudflare Worker
├── e2e/                        # committed Playwright regression suite
├── docs/architecture.md
├── NOTES.md                    # handoff notes and next-session prompt
├── PLAN.md
└── .github/workflows/deploy.yml
```

## Local development

Node 20.12 or newer (developed on 20.12).

```powershell
npm ci
npm run dev        # http://localhost:5173/CalAI/
```

Checks:

```powershell
npm test           # unit tests (nutrition, dates, search, backup, migration, recipes, reminders, Worker normalization)
npm run typecheck
npm run build      # production build in dist/
npm run test:e2e   # builds, then runs Playwright at 390 × 844
npm run preview    # serve dist at http://localhost:4173/CalAI/
```

The app is served under `/CalAI/` in dev and production. Do not change `base` without also
changing the manifest scope/start URL and the Pages path.

On Windows, if esbuild reports `Access is denied` while cleaning a file in `%TEMP%`, point
`TEMP` and `TMP` at a local ignored folder before building:

```powershell
New-Item -ItemType Directory -Force .tmp | Out-Null
$env:TEMP="$PWD\.tmp"; $env:TMP="$PWD\.tmp"
npm run build
```

This is a local tooling workaround, not an app issue; CI on Linux is unaffected.

## Data and privacy

- Everything is stored locally in localStorage under `calai:v1`; there is no account.
- Schema v2 adds saved online foods, recipes, weights, water, and reminder settings.
  Existing v0.1/v0.1.1 documents and backups migrate automatically on load/import.
- v0.1.1 moved the diary to synchronous localStorage because blocked/async IndexedDB could
  leave the app on its opening screen forever. A bounded background read still imports any
  diary written by the earlier v0.1.0 build.
- If storage is blocked entirely, CalAI still opens and shows an in-app warning; changes are
  not saved. Allow site data to keep the diary.
- Online search is opt-in per query. With no Worker configured, the query goes directly to
  Open Food Facts; with a Worker, it goes to your own endpoint. Foods you log are cached
  locally under a 100-item cap. The diary itself is never uploaded.
- Export a JSON backup from Settings before clearing browser data or switching devices.
- Import replaces local data after confirmation and validates every field.
- Web Push is opt-in and stores only a device token, push subscription, timezone, reminder
  times, and quiet hours on the Worker. Payloads contain no food or calorie data.
- `noindex` and `robots.txt` keep the alpha out of search results. Remove both before a
  public launch.
- Nutrition values are estimates, not medical advice. The onboarding target calculator
  enforces a 1,200 kcal floor.

## Worker

The PWA works fully without it. Deploy the Worker to add server-side KV caching, USDA
results, and Web Push:

```powershell
cd worker
npm install
npx wrangler kv namespace create CALAI_CACHE   # paste the id into wrangler.toml
npx wrangler secret put USDA_API_KEY           # optional; free key from USDA
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler deploy
```

Then build the PWA with `VITE_API_BASE=https://<worker-subdomain>.workers.dev` and
`VITE_VAPID_PUBLIC_KEY=<public key>`. Without these, search uses the direct Open Food Facts
fallback and push settings show a configuration note. CORS is allowlisted to the Pages origin
and localhost; secrets never reach the client. See [worker/README.md](worker/README.md).

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. `npm ci`, unit tests, typecheck, production build.
2. Install Playwright Chromium and run the committed E2E suite.
3. Upload `dist/` and deploy through GitHub Actions Pages.

Pages is configured with **build_type: workflow**; do not commit `dist/` or switch the
source back to a branch. A failed E2E run blocks deployment and uploads the Playwright report.

## Quality bar

- Unit tests: 46 across nutrition/target math, date keys, search, backup validation and
  migration, legacy IndexedDB recovery, recipes, reminders, remote parsing, and Worker
  normalization.
- Playwright: 30 committed tests covering onboarding, logging, editing, deletion,
  export/import, validation, offline reload, storage failure modes, online search, barcode
  entry, recipes, water, weight, reminders/.ics, layout, and axe scans.
- axe-core: 0 WCAG 2.1/2.2 A/AA violations across onboarding, diary, foods, recipes, history,
  settings, reminders, barcode, and open sheets in dark and light themes.
- Layout: no horizontal overflow at 360 px or 390 px on every main screen; five-item bottom
  navigation fits at 360 px.
- Bundle: initial JS 87.0 KB gzip + 2.4 KB workbox window; CSS 6.9 KB gzip. The ZXing
  fallback is a separate 108.7 KB gzip chunk loaded only when needed.
- PWA precache: 17 entries, 751.0 KiB (includes the lazy ZXing chunk for offline barcode
  lookup). Service worker: injectManifest with navigation fallback and push handlers.
- Lighthouse was 100/100/100 in v0.1.1. Re-run it on the v0.2 deployment before treating the
  score as current.

## Next

v0.3 adds photo recognition, natural-language logging, and a data-grounded chat, all behind
confirmation sheets. Before that: deploy and smoke-test the Worker, configure VAPID/USDA
keys, and test the installed PWA on physical iOS and Android devices. See [PLAN.md](PLAN.md)
and [NOTES.md](NOTES.md).
