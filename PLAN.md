# CalAI — product plan

Status: **v0.2.0 is shipped (alpha).** v0.3 is planned and awaits a separate go.

Last updated: 2026-10-24
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
| Photo food recognition | Common in AI apps | Camera/upload → candidates → confirm | v0.3 |
| Natural-language logging | Emerging | "Two eggs and toast" → draft entries → confirm | v0.3 |
| LLM chat about your data | Emerging | Read-only Q&A over aggregates; write actions confirm | v0.3 |
| Voice logging | Some | Web Speech dictation into text logging | v0.3 |
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

### v0.3 — AI logging and chat (planned)

- Photo recognition: capture/upload → food candidates with portions → correction sheet → log.
- Natural-language logging and optional voice dictation using the same confirmation sheet.
- Chat: questions answered from locally computed aggregates; optional read-only tools.
- Weekly recap generated from the user's data, with the data window shown.
- Consent, quotas, provider fallback, and an evaluation set before release.
- Write actions (log via chat) land only after confirmation UX is proven.

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
| M8 | v0.3 AI input | Worker AI proxy, photo + text logging, eval | 7 |
| M9 | v0.3 chat | Context builder, chat UI, guardrails, recap | 5 |
| M10 | v1.0 launch | Accounts/sync, legal, audits, migration | 8+ |

v0.1 shipped as M1–M5. v0.2 shipped as M6–M7 with Worker deployment and push credentials still
pending. Next up is v0.3 (M8–M9), pending a go-ahead.

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
| AI nutrition errors | Wrong totals, trust loss | Confirmation, confidence, editable portions, eval set |
| AI cost/abuse | Runaway bill | Worker quotas, device tokens, global budget cap |
| Food DB quality/licensing | Bad data, legal | Show source, cache, ODbL/USDA attribution, seed verified foods |
| Open Food Facts availability/relevance | Search feels empty or wrong or 503s | Graceful local fallback, brand/category queries, Worker cache, optional USDA |
| Worker/VAPID not configured | No cached search, USDA, or push | Direct OFF fallback; `.ics` reminders; documented one-command deploy path |
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

Pending before their releases:

1. AI provider and monthly budget cap (v0.3).
2. Deploy the Cloudflare Worker with KV and set `VITE_API_BASE` (v0.2.x).
3. USDA FoodData Central API key and data-source attribution page (v0.2.x/v1.0).
4. Generate VAPID keys and test push on installed iOS/Android PWAs (v0.2.x).
5. Accounts and encrypted sync design (v1.0).
6. Monetisation, if any (post-alpha).
7. Legal review and public contact address (v1.0).
8. Design refinement beyond the current utilitarian direction (v0.2.x).

Storage decision: synchronous localStorage remains in v0.2, now schema v2 (remote-food
cache capped at 100, recipes, weights, water, reminders). A bounded one-time IndexedDB read
still recovers v0.1.0 diaries. Revisit granular IndexedDB in v0.3 only if payload size or
write latency justifies the migration; do not reintroduce an async boot gate.
