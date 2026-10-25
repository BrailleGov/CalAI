# CalAI — handoff notes

Last updated: 2026-10-25
Release: **v0.3.0 alpha (live)**
Live: <https://braillegov.github.io/CalAI/>
API: <https://calai-api.braille.workers.dev> (account `6e8aa19c29eece010d2447b7f666632b`)
Repo: <https://github.com/BrailleGov/CalAI>
Local project: `D:\Projects\CalAI`

Read [PLAN.md](PLAN.md) for the product roadmap and [docs/architecture.md](docs/architecture.md)
for the technical design before starting work.

## Snapshot

- Mobile-first calorie tracker PWA, local-first, public repo, deployed from `main` by GitHub
  Actions.
- v0.3 adds expanded onboarding/personalization, ≈220 seed foods with categories, AI photo and
  text logging, an AI coach, a curated/AI recipe book, encrypted D1 cloud backup, and
  outbound-only Textbelt SMS.
- The Cloudflare Worker is **deployed** with KV + D1, D1 migrations applied, and all runtime
  secrets set (DeepSeek, Textbelt, `DATA_ENC_KEY`, VAPID). `/health` reports
  `search/ai/sync/sms/push` all true.
- The Pages workflow runs the local-first suite, then rebuilds with `VITE_API_BASE` and the
  public VAPID key, runs the configured-AI suite, and deploys that bundle. AI, cloud backup,
  SMS, push, and server-cached search are active in production; the diary stays local-first and
  offline-capable.
- DeepSeek and Textbelt keys were provided during this session and pasted into chat. They are
  in the gitignored `worker/.dev.vars` locally and set as Wrangler secrets for production.
  Rotate both, then update `.dev.vars` and run `wrangler secret put` again.
- `noindex` and `robots.txt` still keep the alpha out of search results.
- Pages is configured with `build_type: workflow`; do not commit `dist/` or change the source
  back to a branch.
- Node 20.12 is what this machine runs. Wrangler 4.42 is pinned in `worker/` because newer
  Wrangler requires Node 22; local `wrangler dev` still fails to start workerd here, but
  production routing is verified.

## What shipped

v0.3.0 (live):

- **Onboarding.** Goal and pace sliders, optional target weight, optional muscle-group priority
  sliders (chest/back/shoulders/arms/core/glutes/legs), tracking style, feature shortcuts,
  diet pattern, cuisines, avoid list, and explicit AI consent. Four steps; optional sections
  can be skipped.
- **Settings.** Personalization summary plus an edit sheet for goals, body stats, target
  weight, muscle focus, logging style, AI shortcuts, diet, cuisines, and avoid list. Daily
  targets remain separately editable. AI consent can be withdrawn.
- **AI photo logging.** DeepSeek vision, on-device downscale/EXIF strip, multiple items,
  confidence labels, editable grams/macros, local-library matching, optional save-to-library,
  and a final confirmation before writing.
- **AI text logging.** DeepSeek parse when configured/consented; conservative offline matcher
  for simple library phrases. Unmatched text is reported, not invented.
- **AI coach.** `/assistant` route, local aggregate context (7/14/30 days, macro averages,
  weights, water, preferences, training focus), window chip, suggested follow-ups, proposal
  card with a confirm step, local transcript (cap 60), clear chat.
- **Recipe book.** 11 curated recipes built from seed foods, tags, method steps, diet/avoid
  filtering, personalized ordering, AI “picks for you”, AI generation with review, and saving
  to the personal recipe list. User recipes gained method instructions.
- **Food library.** Expanded to ≈220 foods with categories and browse chips. AI matches
  recognised foods to this library.
- **Cloud backup.** Optional device-scoped encrypted snapshots in D1 (AES-GCM, 1 MB cap), auto
  upload after changes while enabled, manual restore/delete, no account.
- **SMS.** Textbelt outbound reminders with consent, encrypted phone, quiet hours, per-day cap,
  dedupe, test text, and easy off. Messages never include calories or foods.
- **Worker security.** Device token hashes, bearer auth for sync/SMS, D1 schema, AES-GCM helper,
  AI quotas, monthly cap, image magic-byte validation, output clamping, no content logging.
- **Schema v3.** Adds `preferences`, `sms`, `cloudSync`, `chatMessages`; recipes gain
  description/instructions/tags/source; foods gain optional category; profile gains optional
  target weight and muscle focus. v1/v2 documents and backups migrate automatically.
- **Tests.** 88 unit tests and 34 Playwright tests pass; axe 0 A/AA violations on new screens.

## Storage details

| Key | Where | Purpose |
| --- | --- | --- |
| `calai:v1` | localStorage | Zustand persist document (schema v3) |
| `calai:legacy-checked` | localStorage | One-time IndexedDB recovery attempted |
| `calai-theme` | localStorage | Resolved theme for the pre-hydration script |
| `calai:device` | localStorage | Random device ID for push/search/auth |
| `calai:sync-token` | localStorage | Server-issued bearer token for sync/SMS; never exported |
| `calai:reminder-dismissed:YYYY-MM-DD:meal` | localStorage | Per-day banner dismissal |

Schema v3 defaults AI photo/coach/recipe shortcuts to off and offline text matching to on.
AI consent is null until the user opts in. Text logging uses the offline matcher without
consent; AI parsing still requires it.

Cloud snapshots are encrypted before storage and strip the SMS phone. Phone numbers are also
stripped from JSON exports. Import preserves local SMS settings and disables cloud auto-sync
until re-enabled. While SMS is configured, the phone remains in local app storage (the same
trust boundary as the diary); the server copy is AES-GCM encrypted.

## Commands

```powershell
cd D:\Projects\CalAI
npm ci
npm run dev        # http://localhost:5173/CalAI/
npm test           # 88 unit tests
npm run typecheck
npm run build      # dist/, deployed by CI
npm run test:e2e   # build + 34 Playwright tests
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
# deploy after creating KV + D1 and secrets; see worker/README.md
```

## Verification status

- 88 unit tests: nutrition/target math, dates, search, backup validation and v1/v2→v3
  migration, legacy state parsing, recipes, curated recipe integrity, reminders and `.ics`,
  remote OFF parsing, preferences, local text parsing, image sizing, assistant context, SMS
  helpers, and Worker normalization/AI/SMS.
- 35 Playwright tests on Chromium at 390 × 844. The default local-first build ran 34 passing
  (configured-AI test skipped); the Worker-enabled build ran the remaining
  `e2e/ai-configured.spec.ts` test against a mocked Worker. Coverage includes onboarding (all
  four steps, imperial/metric), logging, quick add, custom foods, favorites, edit/delete,
  export/import, malformed imports, reset, theme persistence, scroll reset, Escape/dialog
  behavior, offline reload, blocked localStorage, blocked IndexedDB, corrupt state, legacy IDB
  recovery, online search success/failure, barcode, recipe creation/logging, curated recipe
  detail/save, offline text logging, water, weight, reminders + `.ics`, AI/assistant setup and
  configured states, cloud/SMS setup states, horizontal overflow at 360/390 px, and axe scans.
- axe-core: 0 WCAG 2.0/2.1/2.2 A/AA violations across onboarding (including personalization),
  Today, add/edit sheets, foods, recipes, curated detail, history, settings, reminders,
  barcode, AI result sheet, and assistant.
- Layout: no horizontal overflow at 360/390 px on Today, Foods, Recipes, Discover, History,
  Settings, and Assistant.
- Bundle: initial JS 117.1 KB gzip + 2.4 KB workbox window; CSS 8.9 KB gzip; lazy ZXing chunk
  108.7 KB gzip. PWA precache 17 entries (867.4 KiB).
- Deployed Worker verification (2026-10-25, HTTP through
  `https://calai-api.braille.workers.dev`):
  - `/health` returned `search/ai/sync/sms/push` all true; CORS returned the Pages origin.
  - `/v1/foods/search?q=oat milk` returned four Open Food Facts foods via the KV path.
  - `/v1/auth/register` issued a 43-character token; encrypted `/v1/sync` PUT → GET round-tripped
    the marker; DELETE succeeded; GET then returned 404.
  - DeepSeek `deepseek-flash` text parse returned `Eggs` and `Toast`; the coach answered with a
    stated “last 7 days” window and four suggestions; recipe generation returned nine
    ingredients and eight instructions; vision identified a real banana photo (118 g, 105 kcal,
    confidence 0.9).
  - A browser run against the production bundle completed onboarding, parsed and logged
    “one banana and two eggs” via AI, enabled and deleted encrypted cloud backup, and received
    a grounded coach reply (“0 diary entries … last 7 days”).
  - The live Pages build loaded the v0.3 onboarding in a fresh browser; from the Pages origin
    `/health` returned all capabilities true (CORS OK), settings showed active cloud-backup
    controls and the SMS phone field with no “not configured” notices, and the AI sheet showed
    the consent gate.
  - Found and fixed a routing bug: handlers were returned without `await`, so thrown
    `AiError`/`SyncError`/`SmsServiceError` values escaped the router catch and became Cloudflare
    error 1101. All route handlers now `await` and error statuses map correctly (verified with a
    non-food image returning 422 and its message).
- Test rows created during smoke tests were deleted from D1; `devices`, `sync_snapshots`, and
  `sms_prefs` are empty.
- Textbelt quota remains 192 from the earlier consented test; no new SMS was sent during the
  deployment session.
- Not run: installed-PWA push/notifications, physical camera, SMS cron/quiet-hours/opt-out
  delivery, USDA live calls, iOS/Android device pass, Lighthouse on v0.3, and local `wrangler
  dev` (workerd still fails on this Windows/Node 20 machine).

## Known issues and gaps

1. **SMS is not end-to-end verified on the deployed Worker.** The provider accepted an earlier
   consented test and quota moved 193 → 192, but cron delivery, quiet hours, the per-day cap,
   provider failure handling, and opt-out still need a consented number. Recipient receipt is
   unconfirmed.
2. **Physical camera and installed PWA** remain untested, including Web Push on iOS/Android.
   Manual barcode and the push subscription endpoint are covered by tests.
3. **AI eval set missing.** Live smoke tests passed, but the planned 50-photo/30-question eval,
   unsafe-output review, and cost-per-accepted-log measurement are still required.
4. **AI abuse protection is quota-only.** Endpoints are public with device/IP quotas and a
   monthly cap. Add Turnstile or accounts before public scale.
5. **Cloud sync is last-write-wins.** No merge, no account recovery. Losing localStorage
   creates a new device identity; the old encrypted snapshot is unreachable.
6. **USDA live API** is untested (no key). Normalization is unit-tested with fixtures.
7. **Open Food Facts relevance/rate limits** are uneven; direct search can 503. The deployed
   Worker + KV cache is the mitigation.
8. **Service worker updates** still use `skipWaiting` with no “update available” prompt.
9. **Legacy IndexedDB copy** is still retained after migration.
10. **Legal/launch work** still needs privacy policy, terms, AI disclaimer, data-source
    attributions, and a contact address.
11. **Only Chromium** is covered by E2E; no Firefox/Safari or physical device pass.
12. **SMS cost/consent compliance** for the user's jurisdiction still needs review before
    public launch.
13. **Secrets were shared in chat.** Rotate the DeepSeek and Textbelt keys, update
    `worker/.dev.vars`, and re-run `wrangler secret put` for both.
14. **Local Worker runtime still fails.** Wrangler 4.42 cannot start workerd on this Windows
    machine and 4.152 requires Node 22. Production routing is verified, but local HTTP dev
    needs a compatible Node/Cloudflare environment.

## Next session priorities

P0 — finish v0.3 verification:

1. Test the installed PWA on physical iPhone and Android: camera, offline logging, push, SMS
   opt-in, and storage eviction behavior.
2. Run a consented SMS end-to-end test on the deployed Worker: consent → save → test text →
   cron delivery → quiet hours → opt-out; confirm receipt and delete the row.
3. Rotate the DeepSeek/Textbelt keys and update the Worker secrets.

P1 — v0.3.x polish:

- Formal AI eval set, cost measurement, and budget alerts.
- Lighthouse/performance pass on the larger v0.3 bundle.
- “Update available” service worker prompt.
- Cloud sync conflict strategy or explicit “replace device” flow.
- Recipe editing for instructions in the card UI (currently via the recipe form).
- Remote-food cache management and localStorage quota UI.
- Verify Web Push on installed PWAs and add an unsubscribe cleanup check.
- Set up a Node 22 environment for `wrangler dev` and Worker HTTP integration tests.

P2 — v1.0:

- Accounts and encrypted multi-device sync.
- Legal pages, AI disclaimer, data-source attribution.
- Error monitoring with health-content scrubbing.
- Monetization decision.

## Resume prompt

```text
Resume CalAI at D:\Projects\CalAI (live: https://braillegov.github.io/CalAI/, repo:
https://github.com/BrailleGov/CalAI). It is a mobile-first local-first calorie tracker PWA.
v0.3.0 is deployed: expanded personalization onboarding, ≈220 seed foods, DeepSeek photo/text
logging, AI coach, curated/AI recipe book, schema v3, encrypted D1 cloud backup, outbound
Textbelt SMS, and Web Push. The Pages build uses VITE_API_BASE=https://calai-api.braille.workers.dev;
the Worker has KV + D1, all secrets, and migrations applied. First read PLAN.md,
docs/architecture.md, and NOTES.md, then inspect the repo and the live site. Run npm ci, npm
test, npm run typecheck, npm run test:e2e, and npm run build.

Next: test the installed PWA on physical iOS/Android (camera, offline logging, push, storage
eviction), run a consented SMS consent → test → cron delivery → quiet hours → opt-out check on
the deployed Worker, confirm receipt, then rotate the DeepSeek and Textbelt keys and update the
Wrangler secrets. Add a formal AI eval, run Lighthouse on the v0.3 bundle, and update docs with
results.

Guardrails: keep the diary local-first and offline; AI and SMS are opt-in; never log health
content or provider keys; preserve user data and schema v1/v2/v3 migrations; require
confirmation before AI writes; keep axe at 0 violations and initial JS under 200 KB gzip. Do not
commit worker/.dev.vars, dist/, API keys, or phone numbers.
```

## Local secrets

`worker/.dev.vars` is gitignored and contains local DeepSeek/Textbelt keys and a generated
`DATA_ENC_KEY`. Do not commit it. Production uses `wrangler secret put` with the same names
plus VAPID keys. The committed `worker/wrangler.toml` contains only the KV namespace id, D1
database id, and non-secret vars.
