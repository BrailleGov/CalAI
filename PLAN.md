# CalAI — product plan

Status: **v0.3.0 is live (alpha).** The Cloudflare Worker is deployed with KV, D1, all runtime
secrets, and VAPID keys, and the Pages build injects `VITE_API_BASE`. Remaining release work is
physical-device verification, an end-to-end SMS delivery check, and the formal AI eval.

Last updated: 2026-10-25
Live: <https://braillegov.github.io/CalAI/>
Handoff notes and resume prompt: [NOTES.md](NOTES.md)

## 1. Thesis

CalAI is a calorie tracker that feels native on a phone but installs from the web. The core
loop is: open → log what you ate → see where you stand → close. The differentiators are
speed, honesty about data, and AI that removes typing instead of adding a chatbot gimmick.

Principles:

- **Fast before clever.** Manual logging must be under 15 seconds before AI is added.
- **Local-first.** The diary lives on the device. No account is required to start.
- **Confirmation over automation.** AI proposes; the user confirms. Nothing is logged silently.
- **No shame mechanics.** Progress, not pass/fail. No red "failure" states or streak guilt.
- **Data is the user's.** Full JSON export, clear import, and a delete-everything action.

## 2. Typical tracker baseline

What people expect from MyFitnessPal, Lose It!, Cronometer, MacroFactor, Yazio, and Lifesum,
and how CalAI covers it.

| Capability | Typical in trackers | CalAI plan | Release |
| --- | --- | --- | --- |
| Daily diary by meal | Yes | Core screen, date navigation | **v0.1** |
| Calorie + macro targets | Yes | Onboarding calculator + manual edit | **v0.1** |
| Food search | Yes, large DB | Seeded common foods + custom, offline | **v0.1** |
| Quick add | Yes | Calories/macros without a food record | **v0.1** |
| Custom foods | Yes | Create, edit, delete; entries snapshot nutrition | **v0.1** |
| History and trends | Yes | 7 / 30-day log with daily totals | **v0.1** |
| Offline / installable | Partial | Full offline diary + PWA install | **v0.1** |
| Export / import | Paid often | JSON export, validated import | **v0.1** |
| Favorites and recents | Yes | One-tap re-log, sorted by use | **v0.2** |
| Remote food database | Yes | Open Food Facts live; USDA + KV caching via Worker | **v0.2** |
| Barcode scanning | Yes | BarcodeDetector + lazy ZXing + manual entry | **v0.2** |
| Recipes and multi-ingredient meals | Yes | Recipe builder with servings | **v0.2** |
| Weight logging | Yes | Weight + trend line, 7-day average | **v0.2** |
| Reminders | Yes (push) | In-app + `.ics` live; Web Push code ready behind config | **v0.2** |
| Water and exercise | Yes | Water quick add live; exercise still out of the budget | **v0.2** |
| Photo food recognition | Common in AI apps | Camera/upload → candidates → confirm | **v0.3** |
| Natural-language logging | Emerging | "Two eggs and toast" → draft entries → confirm | **v0.3** |
| LLM chat about your data | Emerging | Read-only Q&A over aggregates; write actions confirm | **v0.3** |
| Voice logging | Some | Web Speech dictation into text logging | Deferred (browser support) |
| Accounts and sync | Yes | Optional, encrypted; not required | v1.0+ |
| Wearables / Health apps | Yes | Limited on web; import/export first | Later |
| Social / challenges | Common | Explicitly out of scope | — |
| Subscription | Yes | No monetisation during alpha | — |

## 3. Releases

### v0.1 — Foundation alpha (shipped)

Goal: a genuinely usable local diary that can be installed and used on a phone with no
network. Shipped as **v0.1.0** on 2026-10-24; **v0.1.1** hardens storage after a boot-hang
report.

In scope:

- First-run onboarding: goal, body stats, activity, calculated targets, manual override.
- Today screen: calorie budget, macro progress, meals, entries, edit/delete, date navigation.
- Food library: seeded common foods, custom foods, search, recent foods.
- Logging: portion multiplier, quick add, custom food creation.
- History: 7-day chart and 30-day list with averages.
- Settings: targets, units, theme (dark/light/system), export, import, reset.
- PWA: manifest, icons, offline app shell, installable; data in localStorage.
- Accessible dialogs, keyboard support, reduced-motion support, mobile safe areas.

Explicitly out of v0.1: accounts, remote food DB, barcode, AI, reminders, weight, water,
exercise, recipes, social. The UI may mention what is coming, but no dead buttons.

v0.1 acceptance:

- Onboarding completes in under 90 seconds and produces sane targets.
- Logging a seeded food takes under 15 seconds on a 390 px viewport.
- Totals update immediately and survive a reload and an offline reload.
- Entries can be edited and deleted without corrupting history.
- Export produces a valid JSON backup; import restores it.
- 360 px layout has no horizontal scroll; dialogs trap focus; Escape closes.
- Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, PWA installable.
- Deployed to <https://braillegov.github.io/CalAI/> via GitHub Actions.

Verified on the live deployment: 27 unit tests, browser smoke tests for onboarding, logging,
editing, deleting, export/import, offline reload, reset, and validation; no horizontal
overflow at 360 or 390 px; axe-core reports 0 WCAG A/AA violations across screens in both
themes; Lighthouse mobile 100 performance / 100 accessibility / 100 best practices (SEO is
intentionally 60 while the alpha carries `noindex`). v0.1.1 adds storage recovery tests:
blocked IndexedDB, blocked localStorage, corrupt state, and migration of a seeded v0.1.0
IndexedDB diary. Unit tests: 27.

### v0.2 — Faster logging (shipped as v0.2.0)

Goal: remove typing and make repeated meals one tap, without giving up local-first storage.

Shipped:

- **Remote food search.** Open Food Facts works from the static app through its CORS API.
  `worker/` adds a Cloudflare Worker proxy with a 7-day KV cache, per-IP daily caps, and
  optional USDA FoodData Central results when `USDA_API_KEY` is configured. Results are
  normalised to 100 g, deduped by barcode/name, filtered to query-matching names, and shown
  with source attribution. Logged remote foods are cached locally (100-item cap) so they
  work offline afterwards.
- **Barcode scanning.** `BarcodeDetector` when available; `@zxing/browser` loaded as a
  separate chunk only as a fallback; manual 8–14 digit entry always available. Camera
  frames stay on the device.
- **Recipes.** Build from seed/custom/remote foods, set batch servings, edit/delete, log a
  portion to any meal; entries snapshot per-serving nutrition.
- **Weight and water.** Weight upsert per day, latest value, 7-day average, SVG trend line,
  and delete-with-confirmation. Water quick add (+250/+500 ml or +8/+16 oz), adjustable goal,
  progress bar, and undo. Exercise remains out of the calorie budget.
- **Reminders.** Off by default. Per-meal times, quiet hours, an in-app banner during a
  90-minute window, and a daily `.ics` download. Web Push client + Worker subscribe/cron
  handlers are implemented but inactive until `VITE_API_BASE` and VAPID keys are configured.
- **Storage.** Schema v2 on the same synchronous localStorage document. v0.1/v0.1.1 state and
  backups migrate automatically; no IndexedDB boot gate was reintroduced.
- **Testing.** The ad-hoc Playwright scripts are now a committed suite (30 tests) and run in
  CI before deployment, alongside 46 unit tests.

Not shipped / deliberately deferred:

- Worker deployment, USDA key, and VAPID keys were not configured in this session. The live
  static app therefore uses direct Open Food Facts and local reminders.
- Copy yesterday/copy meal, favorites/recents polish beyond the existing behavior, and manual
  exercise are deferred to v0.2.x or v0.3.
- Accounts, sync, analytics, and monetisation remain out of scope.

v0.2 acceptance check:

- Logging from online search or barcode works on a 390 px viewport and the food is reusable
  offline after logging.
- Recipes produce per-serving values and do not rewrite past entries.
- Weight/water persist across reloads; reminder banner and `.ics` work with no network.
- A blocked network, blocked storage, or blocked IndexedDB never prevents the local diary
  from opening.
- axe-core reports 0 WCAG 2.1/2.2 A/AA violations on all main screens and open sheets.
- Committed E2E suite passes in CI; initial JS remains < 200 KB gzip.

Verified locally on 2026-10-24: 46 unit tests and 30 Playwright tests pass; axe-core
reports 0 WCAG A/AA violations across onboarding, diary, add/edit sheets, foods, recipes,
history, settings, reminders, and barcode; no horizontal overflow at 360/390 px; initial JS
87.2 KB gzip plus a 108.7 KB gzip lazy ZXing chunk; PWA precache 751.8 KiB. Live Open Food
Facts search returned results for category and brand queries, and the offline reload test
passes with the new injectManifest
service worker. Lighthouse was not re-run after the v0.2 bundle change, and the Worker/push
tiers were not deployed.

### v0.3 — AI logging, coach, and personalization (shipped as v0.3.0)

Goal: remove typing and personalize the app without giving up local-first storage or
confirmation before writes.

Shipped:

- **Onboarding expansion.** Goal and pace sliders, optional target weight, optional
  muscle-group priority sliders, tracking style, feature shortcuts, food preference,
  cuisines, and an avoid list. Everything is editable in Settings.
- **Photo recognition.** DeepSeek vision identifies multiple foods, returns portions,
  confidence, and nutrition estimates; the client downscales/strips EXIF, matches library
  foods, and requires confirmation before logging.
- **Natural-language logging.** DeepSeek parses text into editable items; a conservative
  offline matcher handles simple phrases without a network or AI consent.
- **AI coach.** Grounded in locally computed 7/14/30-day aggregates, preferences, weight, and
  water; answers cite the window, show suggestions, and can propose entries that only log
  after explicit confirmation.
- **Recipe book.** 11 curated recipes built from seed foods with instructions, tags, diet
  filters, personalized ordering, AI generation, and AI “picks for you”. User recipes gained
  method steps.
- **Expanded food library.** ≈220 seed foods with categories and browseable filters.
- **Encrypted cloud backup.** Device-scoped D1 snapshots encrypted with AES-GCM; no account.
- **Outbound SMS reminders.** Textbelt integration with consent, quiet hours, dedupe, caps,
  encrypted phone storage, and “replies are not monitored” copy.
- **Security.** Server-side DeepSeek/Textbelt keys, device token hashes, typed D1 access,
  request caps, image validation, output sanitization, and no content logging.
- **Testing.** 88 unit tests and 34 Playwright tests, plus a configured-AI Playwright suite
  that passed against mocked Worker responses when built with `VITE_API_BASE`. Includes axe
  scans of the new screens.

Deployment completed on 2026-10-25:

- Worker `calai-api` deployed at <https://calai-api.braille.workers.dev> with KV `CALAI_CACHE`,
  D1 `calai`, migrations applied, and secrets for DeepSeek, Textbelt, `DATA_ENC_KEY`, and
  VAPID. `/health` reports search, AI, sync, SMS, and push as available.
- Pages CI now runs the local-first suite, rebuilds with `VITE_API_BASE` and the public VAPID
  key, runs the configured-AI suite, and deploys that bundle.
- Verified through live HTTP: CORS, KV-cached Open Food Facts search, device registration,
  encrypted snapshot PUT/GET/DELETE (404 after delete), DeepSeek text parse, coach answer with
  a stated 7-day window, recipe generation, and vision on a real banana photo. A browser run
  against the production bundle logged AI-parsed items, enabled and deleted cloud backup, and
  received a grounded coach reply. The live Pages build was rechecked in a fresh browser:
  `/health` passed CORS and the AI, cloud, and SMS configured states rendered correctly.
- Fixed a router bug where handler promises were returned without `await`, so typed errors
  escaped the catch and surfaced as Cloudflare 1101 errors. All handlers now await.

Not yet verified / deferred:

- SMS is provider-accepted (quota 193 → 192 on an earlier consented test) but cron delivery,
  quiet hours, cap handling, opt-out, and carrier receipt need a consented end-to-end run.
- Physical iOS/Android camera, installed-PWA push, and storage-eviction behavior are untested.
- No formal AI eval or cost measurement; abuse protection is quota-only.
- No accounts/sync merge; cloud backup is last-write-wins.
- USDA is unconfigured and untested live; Voice dictation is deferred.
- Local `wrangler dev` still fails to start workerd on this Windows/Node 20 machine.

v0.3 acceptance check:

- Onboarding saves goal, target weight, muscle priorities, and usage preferences and they are
  editable later.
- AI photo/text output is editable, confidence-labelled, and never logged without confirmation.
- The coach uses local aggregates only and proposes writes with a confirm step.
- Recipe book, saved recipes, and AI recipes produce per-serving nutrition and log to a meal.
- SMS is outbound only, consent-gated, deduplicated, and excludes health values.
- Cloud snapshots and phone numbers are encrypted at rest and device-scoped.
- 360/390 px layouts do not overflow; axe reports 0 A/AA violations; initial JS stays under
  200 KB gzip.

Verified on 2026-10-25: 88 unit tests; 35 Playwright tests (34 in the local-first build, the
configured-AI test against a mocked Worker); axe 0 violations on new screens; no horizontal
overflow; initial JS 117.1 KB gzip, CSS 8.9 KB gzip. Live deployment checks listed above
passed, including a real banana photo. Textbelt accepted one consented test text; quota moved
193 → 192. Deployment smoke rows were removed from D1 afterwards.

### v1.0 — Public launch (planned)

- Accounts and encrypted sync are optional; local-only remains first-class.
- Privacy policy, terms, AI disclaimer, food-data attributions.
- Full a11y and performance audits, install/update flows, error monitoring.
- Optional migration tools (CSV import from common trackers).
- Decide on monetisation separately.

## 4. Core journeys

1. **First run:** goal → stats → activity → targets review → diary. Under 90 seconds, skippable.
2. **Log a known food:** meal "+" → search → tap → portion → add. Recent/favorite first.
3. **Log a custom meal:** quick add or custom food, then it joins the library.
4. **Fix a mistake:** tap an entry → change portion or delete; totals and history update.
5. **Review:** today's rings and meals; history for the week; average intake.
6. **Back up:** settings → export JSON; import to restore.
7. **Later, photo:** camera → candidates → correct portions → confirm → logged.
8. **Later, chat:** "How did this week compare to target?" → answer grounded in a stated window.
9. **Later, reminder:** notification at lunch → opens the lunch meal → one-tap log.

## 5. AI plan

### Photo recognition

- Downscale on-device to ≤ 1024 px JPEG, strip metadata, send over HTTPS to the Worker.
- The Worker calls a multimodal model with a strict JSON schema:
  `items[{ name, quantity, unit, grams_estimate, confidence }]`, plus an overall note.
- The client resolves names against the local/remote food DB, shows editable candidates with
  confidence, and requires confirmation. Portion estimates are always editable.
- Images are not persisted or logged. Consent appears on first use. A failed call falls back
  to search without losing the meal context.
- Quality bar: on a 50-photo internal set, the correct food must appear in the top 3 for
  ≥ 70% of single-item plates; portions within ±30% for simple items. Mixed dishes are
  presented as estimates, never as precise facts.

### Natural-language logging

- Text/voice → same structured schema as vision → resolve → confirm.
- Multi-item utterances become multiple draft rows, each editable.
- Unknown foods offer "create custom food" prefilled with the parsed estimate.

### Chat about your data

- The client computes a compact context locally: goal, 7/14/30-day totals and averages,
  macro split, logging consistency, recent foods. Raw diary rows are not shipped wholesale.
- v0.3 is one-shot context plus optional read-only tools (`getDailyTotals`, `getTrends`,
  `searchFoods`). Tool execution stays client-side where possible, so health data does not
  accumulate server-side.
- Answers must cite the window used ("last 14 days") and say when data is missing. No medical
  diagnosis, no extreme-diet encouragement, no shaming language.
- Guardrails: system prompt, schema-validated outputs, daily message cap, local transcript
  with a clear-chat action, thumbs feedback stored locally.
- Costs: hard per-device daily quotas and a global monthly budget cap. Provider choice is
  pending; a small multimodal model is the default. Exact pricing is checked at build time.

### Privacy and safety

- AI is opt-in; the diary remains local-only unless a request is made.
- Send the minimum: no name, email, or persistent identifier. A random device token gates
  quotas and is not linked to an account.
- No training on user data: use API terms with training disabled where available.
- Eating-disorder safeguards: enforce a 1200 kcal floor with a plain-language warning, avoid
  praise for under-eating, and offer a "hide numbers" mode in v1.0.
- AI copy is labelled as estimates and not medical advice.

## 6. Reminders

Two tiers, because browsers cannot reliably wake a closed PWA without push:

1. **v0.2 local tier:** in-app reminder banner, notification while the app is open, and
   `.ics` export for meal reminders. Honest about the limitation.
2. **v0.2 push tier:** Web Push with VAPID from a Cloudflare Worker cron (5-minute
   resolution). Works for installed PWAs on Android/Chromium; iOS 16.4+ supports it for
   installed web apps, subject to permission.
   - Store only: random device ID, push subscription, timezone, reminder times, enabled flags.
   - Payloads contain no food or calorie data ("Time to log lunch"), deep-link to the meal.
   - Quiet hours, per-reminder toggles, one-tap unsubscribe, automatic cleanup of dead
     subscriptions.
   - Denied permission falls back to in-app prompts; no nagging.

Defaults: lunch and dinner reminders off until the user opts in after logging a few meals.

## 7. Metrics and quality bars

Instrument only with consent and never send food names or health values.

- Time to log (p50 < 15 s manual, < 25 s photo with correction).
- AI candidate acceptance rate; correction rate; chat answer rated helpful.
- Reminder opt-in and delivery success; disabled rate.
- Logging days per week; 30-day return rate.
- Crash-free sessions; offline log success (target 100%).
- Performance budgets: initial JS < 200 KB gzip, LCP < 2.5 s on mid-tier mobile.
- Accessibility: WCAG 2.2 AA, keyboard-complete, screen-reader smoke tests.

## 8. Milestones and estimates

Estimates are solo build days, not calendar promises.

| # | Milestone | Scope | Days |
| --- | --- | --- | --- |
| M0 | Foundation | Repo, Pages, HTTPS, placeholder, docs | **done** |
| M1 | v0.1 shell and data | Stack, design tokens, routing, store, local persistence | **done** |
| M2 | Diary and onboarding | Targets, meals, entries, quick add | **done** |
| M3 | Food library | Seed data, search, custom foods, recents | **done** |
| M4 | History and settings | Charts, export/import, themes | **done** |
| M5 | v0.1 QA and deploy | PWA, a11y, device pass, Actions deploy | **done** |
| M6 | v0.2 data | Worker, OFF/USDA search, barcode, recipes | **done** |
| M7 | v0.2 retention | Weight, water, reminders, push code | **done** |
| M8 | v0.3 AI input | Worker AI proxy, photo + text logging, eval | **done locally** |
| M9 | v0.3 chat | Context builder, chat UI, guardrails, recipes | **done locally** |
| M10 | v1.0 launch | Accounts/sync, legal, audits, migration | 8+ |

v0.1 shipped as M1–M5. v0.2 shipped as M6–M7. v0.3 shipped as M8–M9 and is deployed: the
Worker, KV, D1, migrations, secrets, VAPID keys, and production `VITE_API_BASE` are live.
Remaining v0.3 verification is physical-device and SMS delivery testing plus the AI eval.

## 9. Non-goals

- Social feed, friends, challenges.
- Medical advice, diagnosis, or treatment claims.
- Native iOS/Android apps in the web-first phase.
- Wearable integrations in v0.1–v0.3.
- Ads.
- Required accounts.

## 10. Risks and mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Browser limits on background reminders | Missed reminders | Push for installed PWAs; set expectations; `.ics` fallback |
| iOS PWA storage eviction | Lost diary | Request persistent storage; export; clear backups |
| AI nutrition errors | Wrong totals, trust loss | Confirmation, confidence, editable portions, live provider smoke tests; formal eval set still pending |
| AI cost/abuse | Runaway bill | Worker daily quotas, monthly request cap, device/IP keys, server-side key; add Turnstile/accounts before public scale |
| SMS abuse/compliance | Unwanted texts, cost | Explicit consent, outbound only, quiet hours, per-day cap, dedupe, encrypted phone, easy off |
| Cloud snapshot leak | Health data exposure | Device-scoped auth, AES-GCM at rest, no phone in snapshots, delete action; no multi-device merge yet |
| Food DB quality/licensing | Bad data, legal | Show source, cache, ODbL/USDA attribution, seed verified foods |
| Open Food Facts availability/relevance | Search feels empty or wrong or 503s | Graceful local fallback, brand/category queries, Worker cache, optional USDA |
| Worker outage or misconfiguration | Search/AI/cloud/SMS unavailable | Local diary and OFF fallback, `/health` capability flags, documented redeploy path |
| GitHub Pages static limits | No headers, no server | Worker for dynamic; meta CSP; hash routing |
| Health-data sensitivity | Privacy harm | Local-first, no raw data to AI by default, consent, export/delete |
| Scope creep | v0.1 stalls | This release gate; everything else is explicitly deferred |

## 11. Decisions

Settled for v0.1:

- Vite + React + TypeScript, hash routing, synchronous local persistence, no backend.
- Dark-first lime-on-black visual language, light theme included.
- Seed food library plus custom foods; remote DB deferred.
- Local-only data, JSON export/import, no accounts.
- Deploy via GitHub Actions to Pages.

Settled for v0.2:

- Schema v2 on localStorage; v0.1 state and backups migrate automatically.
- Remote search works directly against Open Food Facts; the Cloudflare Worker is optional
  and adds KV caching, USDA, rate caps, and push.
- BarcodeDetector first, lazy ZXing fallback, manual entry always available.
- Reminders off by default; in-app + `.ics` are the guaranteed tier; push is opt-in.
- No accounts, no analytics, no server-side diary.

Settled for v0.3:

- DeepSeek `deepseek-flash` (served by DeepSeek-V4.1-Flash-1017) is the AI provider. The key
  is a Worker secret; the client never sees it.
- AI is opt-in and off by default except offline text matching. Consent is explicit and
  revocable in Settings.
- Photo/text results are estimates, editable, confidence-labelled, and never auto-logged.
- Chat context is locally computed aggregates only; write proposals require confirmation.
- Schema v3 on localStorage; Cloudflare D1 is used only for optional encrypted cloud backup,
  SMS preferences, and device auth.
- Cloud snapshots and SMS phone numbers use AES-GCM with a server-side key. SMS is outbound
  only via Textbelt, consent-gated, deduped, and excluded from backups.
- Recipe book stays lightweight and is built from the same seed foods as the diary.

Pending before their releases:

1. ~~Deploy the Cloudflare Worker with KV + D1 and rebuild Pages with `VITE_API_BASE`.~~
   Done 2026-10-25; keys still need rotation because they were shared in chat.
2. Verify SMS cron delivery, quiet hours, test text, and opt-out with a consented number, and
   confirm carrier receipt (v0.3.x).
3. USDA FoodData Central API key and data-source attribution page (v0.3.x/v1.0).
4. Test push on installed iOS/Android PWAs; VAPID keys and the subscription endpoint are live
   (v0.3.x).
5. Accounts and multi-device sync design; current cloud backup is device-scoped and
   last-write-wins (v1.0).
6. Monetisation, if any (post-alpha).
7. Legal review, public contact address, AI disclaimer page (v1.0).
8. Formal AI eval set, cost measurement, and budget alerts (v0.3.x).
9. Design refinement beyond the current utilitarian direction (v0.3.x).

Storage decision: synchronous localStorage remains in v0.3, now schema v3 (personalization,
SMS prefs, cloud-sync state, local chat transcript). Cloud snapshots are optional, encrypted,
and device-scoped. A bounded one-time IndexedDB read still recovers v0.1.0 diaries. Do not
reintroduce an async boot gate.
