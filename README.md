# CalAI

A mobile-first calorie tracker that installs from the web and works offline.

**v0.3.1 alpha (live)** — <https://braillegov.github.io/CalAI/> · API:
<https://calai-api.braille.workers.dev>

## What works

- First-run onboarding with goal, pace slider, optional target weight, optional muscle-group
  priority sliders, body stats (metric or imperial), activity, and calculated calorie/macro
  targets with manual override.
- Personalization for logging style, food preference, cuisines, ingredients to avoid, and
  which shortcuts (photo, text, coach, recipe ideas) appear. Everything is editable later in
  Settings.
- Daily diary by meal, date navigation, portions, quick add, edit and delete.
- Food library of ≈220 curated common foods across browseable categories, plus custom foods,
  search, favorites, and recents. Seed values are rounded public nutrition references.
- Online food search (Open Food Facts) with source labels, brand/category queries, ranking,
  and a local cache of foods you log. Works without a Worker when `VITE_API_BASE` is unset.
- Barcode lookup: `BarcodeDetector` with a lazy-loaded ZXing fallback, plus manual entry.
- AI photo logging is the default add flow: downscale on-device, identify multiple visible
  foods, show confidence, match against the local library, edit portions and macros, then
  confirm before logging. Branded, packaged, or restaurant items are cross-checked against
  current web results before review. Manual search and barcode stay one tap away.
- AI food discovery: searches check a shared library, then ask DeepSeek for several matching
  foods and store them for every device, with a live “finding items” indicator. Branded
  searches can be grounded with Brave Search results. New custom foods and quick adds can
  also be filled from a photo or a short description.
- Natural-language logging: AI parsing when configured, with a conservative offline matcher
  for phrases like “2 eggs and banana”. Nothing is logged without confirmation.
- AI coach: questions answered from locally computed 7/14/30-day aggregates, with a visible
  data window, proposed entries that require confirmation, and a local-only transcript.
- Recipe book: 11 curated recipes built from seed foods, tag/diet filtering, personalized
  ordering, AI recipe generation, AI “picks for you”, and saving to the personal recipe list.
  Existing user recipes support ingredients, servings, and step-by-step method.
- Weight log and water quick add. Reminders are SMS only: opt-in schedule, quiet hours,
  consent, test text, and outbound Textbelt delivery. There are no in-app or calendar
  reminders.
- Optional encrypted cloud backup using a per-device random key, D1 storage, and AES-GCM
  encryption at rest. No account is created.
- Calorie ring, macros, 7-day chart, 30-day history, light/dark/system themes, JSON export
  and validated import, installable offline PWA.

**Defaults:** dark theme, imperial body units (lb/ft) with metric stored internally, and
`en-CA` date/time formatting. Onboarding and Settings keep both theme and units editable.

**Deployment note:** the static app is deployed by GitHub Pages and the Cloudflare Worker is
live. The Pages build injects `VITE_API_BASE`, so AI, the shared food library, encrypted cloud
backup, SMS, and server-cached search are active. The diary is still local-first and fully
usable offline with no account. See [Worker setup](#worker-setup) for the deployed bindings.

## Stack

Vite 6, React 18, TypeScript, Zustand with synchronous localStorage persistence (schema v3),
HashRouter, plain CSS with design tokens, and a hand-written service worker via
`vite-plugin-pwa` injectManifest. No accounts and no analytics.

The optional backend is a Cloudflare Worker in `worker/`: KV cache for food search, D1 for
device auth, encrypted snapshots, SMS preferences, and the shared AI food library, DeepSeek
`deepseek-flash` (DeepSeek-V4.1-Flash-1017) for vision/text/chat/recipes/food discovery,
Brave Search for current branded nutrition and ingredient evidence, and Textbelt for
outbound SMS. Web Push endpoints remain but are dormant and now require device auth.
`@zxing/browser` is loaded only when a browser lacks `BarcodeDetector`.

## Structure

```
.
├── index.html                  # Vite entry
├── public/                     # icons, 404, robots, .nojekyll
├── src/
│   ├── App.tsx                 # routes, theme, legacy recovery, auto-sync
│   ├── components/             # Sheet, Toast, Slider, ToggleRow, nav, icons
│   ├── features/
│   │   ├── onboarding/         # goal, goals sliders, preferences, targets
│   │   ├── today/              # diary, add/edit sheets, barcode, AI shortcuts
│   │   ├── ai/                 # AiLogSheet, AssistantPage
│   │   ├── foods/              # search and category browsing
│   │   ├── recipes/            # personal recipes, curated book, AI recipes
│   │   ├── history/
│   │   └── settings/           # personalization, reminders, SMS, cloud, data
│   ├── data/
│   │   ├── seedFoods.ts        # ≈220 foods with categories
│   │   └── curatedRecipes.ts   # recipe book built from seed foods
│   ├── lib/                    # AI, sync, SMS, context, image, NL, backup, etc.
│   ├── store/useAppStore.ts
│   ├── styles/global.css
│   └── sw.ts                   # precache, offline shell, push handlers
├── worker/
│   ├── src/                    # router, AI, Brave web search, auth, D1 sync, SMS, push
│   ├── migrations/0001_init.sql
│   └── .
├── e2e/                        # committed Playwright + axe suite
├── docs/architecture.md
├── NOTES.md
├── PLAN.md
└── .github/workflows/deploy.yml
```

## Local development

Node 20.12 or newer (developed on 20.12).

```powershell
cd D:\Projects\CalAI
npm ci
npm run dev        # http://localhost:5173/CalAI/
```

Checks:

```powershell
npm test           # 97 unit tests, including Worker AI/web/SMS/shared food/crypto
npm run typecheck
npm run build
npm run test:e2e   # builds, then 34 Playwright tests at 390 × 844
npm run preview    # http://localhost:4173/CalAI/
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

## Worker setup

The PWA works fully without it. The Worker adds cached food search, USDA results, AI, the shared
AI food library, encrypted cloud backup, and SMS. Web Push endpoints are dormant.

Deployed bindings: account `6e8aa19c29eece010d2447b7f666632b`, KV `CALAI_CACHE`
(`4720c88208744717a583112e89def60f`), D1 `calai` (`8d689615-14b6-4951-84d4-651d92eb0970`),
Worker `https://calai-api.braille.workers.dev`. The ids are committed in
`worker/wrangler.toml`; secrets are not. `/health` reports `search`, `ai`, `webSearch`,
`sharedFoods`, `sync`, `sms`, and `push` as true.

To provision an equivalent Worker from scratch:

```powershell
cd worker
npm install
npx wrangler kv namespace create CALAI_CACHE
npx wrangler d1 create calai
# Paste the returned KV id and D1 database_id into wrangler.toml.

# Server-side secrets (never commit these):
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put TEXTBELT_API_KEY
npx wrangler secret put BRAVE_SEARCH_API_KEY  # web grounding for branded foods
npx wrangler secret put DATA_ENC_KEY          # 32 random bytes, base64
npx wrangler secret put USDA_API_KEY          # optional
npx wrangler secret put VAPID_PUBLIC_KEY      # optional push
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

npx wrangler d1 migrations apply calai --remote
npx wrangler deploy
```

Generate the encryption key with something like:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

The Pages workflow builds the local-first bundle, runs the default E2E suite, then rebuilds
with `VITE_API_BASE` and the public VAPID key and runs the configured-AI suite before uploading
`dist`. To reproduce a Worker-enabled build locally:

```powershell
$env:VITE_API_BASE="https://calai-api.braille.workers.dev"
$env:VITE_VAPID_PUBLIC_KEY="<public key>"
npm run build
```

Neither value is secret. Without them, the app stays local-first and explains which features
need the service.

For local Worker development, `worker/.dev.vars` is gitignored. Wrangler loads it with
`npx wrangler dev`; local KV/D1 state lives in `worker/.wrangler/`. Do not put real secrets in
`wrangler.toml` or any `VITE_*` variable.

## Data and privacy

- The diary is stored locally in localStorage under `calai:v1`; there is no required account.
- Schema v3 adds personalization, SMS settings, cloud-sync state, and the local chat transcript.
  v0.1/v0.2 documents and backups migrate automatically on load/import.
- v0.1.1 moved the diary to synchronous localStorage because blocked/async IndexedDB could
  leave the app on its opening screen forever. A bounded background read still imports an
  earlier v0.1.0 diary.
- If storage is blocked entirely, CalAI still opens and shows an in-app warning; changes are
  not saved.
- Online search is opt-in per query. With no Worker configured, the query goes directly to
  Open Food Facts. Foods you log are cached locally under a 100-item cap.
- AI is opt-in. Photo and text shortcuts are visible by default in v0.3.1, but no AI request
  is sent until you explicitly consent; coach and recipe ideas default off. Requests carry a
  random device token, not an account. The Worker does not log photo, text, or diary content.
- Photos are downscaled and re-encoded on-device, which strips EXIF (including location).
  Only the chosen photo is sent, only when you press an AI button.
- For branded, packaged, or restaurant items, the Worker may send the model-chosen brand and
  product name to Brave Search and use public result snippets to improve nutrition and
  ingredient notes. The image itself, diary rows, and health values are not sent to the search
  provider. Web results are cached for 24 hours and are labelled “Web + AI” in the library.
- The coach computes 7/14/30-day totals, averages, weights, water, preferences, and recent
  food names on-device. It does not ship raw diary rows.
- Cloud backup is optional and encrypted with AES-GCM before it reaches D1. The server stores
  only a hash of the device key and the encrypted snapshot. The device key is separate from
  the diary export and never included in backups.
- SMS is outbound only, opt-in, and consent-gated. Messages contain only a meal name and
  “replies are not monitored”; they never include calories or health values. The server copy
  of the phone number is encrypted at rest; it is excluded from exported backups and cloud
  snapshots. Like the diary, the number is also held in this device's local app storage until
  you turn SMS off or clear site data.
- AI food searches send only the typed search words and receive shared, AI-generated food
  names and nutrition; branded searches may also query Brave Search. No diary rows or health
  values are included.
- Dormant Web Push endpoints now require device auth and store only a device token,
  subscription keys, timezone, reminder times, and quiet hours; no client subscribes today.
- `noindex` and `robots.txt` keep the alpha out of search results. Remove both before a public
  launch.
- Nutrition and AI values are estimates, not medical advice. Onboarding and target editing
  enforce a 1,200 kcal floor.

## Known limitations

- SMS delivery was last verified only as a provider-accepted test (Textbelt quota moved
  193 → 192). The deployed cron, quiet hours, caps, and opt-out still need a consented
  end-to-end run; no test text was sent during the deployment session.
- Physical iOS/Android camera and USDA live calls remain untested. Web Push endpoints still
  exist in the Worker but no reminder UI subscribes to them.
- The AI eval set and cost measurement are still missing; abuse protection is quota-only.
  AI-discovered foods are shared estimates and are not reviewed by a human.
- Cloud sync is whole-document, last-write-wins; there is no conflict merge or multi-device
  account. Restoring replaces the local diary after confirmation.
- Only Chromium is covered by the committed E2E suite.
- Production dependency audit is clean (`npm audit --omit=dev`). Three dev-only Vitest 3
  advisories remain until the test runner is upgraded to the next major version.
- Brave results can be stale, promotional, or about a different package size. The refinement
  prompt requires a clear product/serving match and falls back to the AI estimate otherwise,
  but web-grounded values are still estimates.

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. `npm ci`, unit tests, client typecheck, `worker` install + typecheck, local-first build.
2. Install Playwright Chromium and run the committed E2E suite (34 tests).
3. Rebuild with `VITE_API_BASE` and `VITE_VAPID_PUBLIC_KEY`, run the configured-AI suite.
4. Upload `dist/` and deploy through GitHub Actions Pages.

Pages is configured with **build_type: workflow**; do not commit `dist/` or switch the source
back to a branch. A failed E2E run blocks deployment and uploads the Playwright report.

The Worker deploys separately from `worker/` with `npx wrangler deploy`. See
[worker/README.md](worker/README.md) for endpoints, secrets, and smoke tests.

## Quality bar

- Unit tests: 97 across nutrition/target math, dates, search, backup validation and
  v1/v2→v3 migration, legacy IndexedDB recovery, recipes, curated recipe integrity,
  remote parsing, preferences, local text parsing, image sizing, assistant context, SMS
  helpers, shared AI food normalization, Brave search sanitization/caching, web refinement,
  and Worker AI/SMS handling.
- Playwright: 35 tests. The default local-first run has 34 passing (the configured-AI test is
  skipped); the Worker-enabled build runs that 35th test against a mocked Worker. Coverage
  includes onboarding (including goal/preferences steps), logging, edit/delete, quick add,
  custom foods, favorites, export/import, malformed imports, blocked storage/IndexedDB, corrupt
  state, legacy recovery, offline reload, online search failure/success, AI shared food
  discovery, barcode, recipes, curated recipe save/detail, offline text logging, water, weight,
  SMS-only settings, AI setup and configured states, cloud/SMS setup states, layout, and axe.
- Configured-AI suite: `e2e/ai-configured.spec.ts` is skipped in the default local-first build.
  Built with `VITE_API_BASE` and a mocked Worker, it covers photo → review → log with a
  “Web-checked” source link, the coach proposal → confirm flow, AI recipe picks, and recipe
  generation/save.
- axe-core: 0 WCAG 2.0/2.1/2.2 A/AA violations across onboarding, today, add/edit sheets,
  foods, recipes, curated detail, history, settings (including SMS), barcode, AI result sheet,
  assistant, and both themes.
- Layout: no horizontal overflow at 360/390 px on Today, Foods, Recipes, History, Settings,
  Discover, and Assistant.
- Bundle: initial JS 125.6 KB gzip + 2.4 KB workbox window; CSS 9.6 KB gzip; lazy ZXing
  chunk 108.7 KB gzip. Under the 200 KB initial-JS budget.
- PWA precache: 17 entries, 898.2 KiB. Service worker: injectManifest with navigation fallback
  and dormant, authenticated push handlers.
- Live deployment verification (2026-10-25): `/health` reports
  search/AI/webSearch/sharedFoods/sync/SMS/push true; a live branded parse returned
  `webSources`; “coca cola zero” discovery returned web-grounded foods; “paneer” discovery
  returned and stored six AI foods and the shared-library lookup returned them without another
  model call;
  Open Food Facts search through KV returns results with CORS for the Pages origin; device
  registration, encrypted snapshot PUT/GET/DELETE round-tripped and returned 404 afterwards;
  DeepSeek text parse, coach answer with a 7-day window, recipe generation, and vision on a
  banana photo all returned valid structured output through the deployed Worker. A browser run
  against the production bundle logged AI-parsed items, enabled and deleted cloud backup, and
  received a grounded coach reply. The live Pages build was also checked in a fresh browser:
  `/health` passed CORS from the Pages origin, and the AI consent gate, cloud-backup controls,
  and SMS phone field appeared with no “not configured” notices. Test rows were deleted from
  D1 afterwards.

## Next

Rotate the DeepSeek, Textbelt, and Brave Search keys that were shared in chat, run an
end-to-end SMS consent / delivery / opt-out test, test the installed PWA on physical iOS and
Android, add the formal AI eval set, and run Lighthouse on the v0.3 bundle. The shared AI food library is new and should be
sampled for accuracy before public launch. See [PLAN.md](PLAN.md),
[docs/architecture.md](docs/architecture.md), and [NOTES.md](NOTES.md).
