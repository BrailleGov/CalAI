# CalAI Worker

Optional Cloudflare Worker for CalAI. The PWA remains local-first and fully usable without
it. The Worker adds cached food search, USDA results, DeepSeek AI, encrypted cloud backup,
outbound Textbelt SMS reminders, and Web Push.

Deployed: <https://calai-api.braille.workers.dev> (account `6e8aa19c29eece010d2447b7f666632b`).
KV `CALAI_CACHE` and D1 `calai` ids are committed in `wrangler.toml`; runtime secrets live in
Cloudflare. `GET /health` reports `search/ai/sync/sms/push` all true. Local `wrangler dev`
still fails to start workerd on this Windows/Node 20 machine; live HTTP behavior is verified
with the deployed Worker instead.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + configured capability flags |
| GET | `/v1/foods/search?q=oat+milk&limit=20` | Open Food Facts + optional USDA, KV-cached 7 days |
| GET | `/v1/foods/barcode/:code` | Open Food Facts barcode lookup, cached |
| POST | `/v1/push/subscribe` | Store/update a push subscription and reminder times |
| POST | `/v1/push/unsubscribe` | Remove a push subscription |
| POST | `/v1/auth/register` | Issue a device token; stores only its SHA-256 hash |
| PUT | `/v1/sync` | Encrypt and store a device-scoped snapshot |
| GET | `/v1/sync` | Decrypt and return this device's snapshot |
| DELETE | `/v1/sync` | Delete the snapshot |
| POST | `/v1/ai/recognize` | Meal photo → structured food candidates (DeepSeek vision) |
| POST | `/v1/ai/parse` | Meal text → structured items |
| POST | `/v1/ai/chat` | Grounded coach answer + optional log proposal |
| POST | `/v1/ai/recipes` | Generate a recipe or rank curated candidates |
| POST | `/v1/sms/prefs` | Save consent, encrypted phone, reminders, timezone |
| POST | `/v1/sms/test` | Send one test text (1/day per device) |
| DELETE | `/v1/sms/prefs` | Delete SMS preferences |

Search responses are `{ foods, sources, cached }`. AI responses are JSON and every number is
clamped server-side. No provider key is ever returned to the client.

## Setup

```powershell
cd worker
npm install

npx wrangler kv namespace create CALAI_CACHE
npx wrangler d1 create calai
# Paste the KV id and D1 database_id into wrangler.toml.

npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put TEXTBELT_API_KEY
npx wrangler secret put DATA_ENC_KEY          # 32 random bytes, base64
npx wrangler secret put USDA_API_KEY          # optional
npx wrangler secret put VAPID_PUBLIC_KEY      # optional push
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT

npx wrangler d1 migrations apply calai --remote
npx wrangler deploy
```

Generate `DATA_ENC_KEY` with a cryptographically secure source, for example:

```powershell
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Then build the PWA with:

```powershell
$env:VITE_API_BASE="https://calai-api.<account>.workers.dev"
$env:VITE_VAPID_PUBLIC_KEY="<public key>"   # only for push
npm run build
```

`VITE_*` values are build-time values for the static app. The VAPID public key is not secret;
the DeepSeek, Textbelt, and encryption keys must never be committed or placed in a `VITE_*`
variable.

## Configuration

- `CALAI_CACHE` — KV namespace. Recommended for search caching, AI/SMS quotas, and push.
- `DB` — D1 database. Required for device auth, cloud backup, and SMS.
- `DEEPSEEK_API_KEY` — required for AI. Model defaults to `deepseek-flash`
  (DeepSeek-V4.1-Flash-1017); override with `DEEPSEEK_MODEL`. Base URL defaults to
  `https://api.deepseek.com`.
- `TEXTBELT_API_KEY` — required for SMS. Base URL defaults to `https://textbelt.com`.
- `DATA_ENC_KEY` — required for encrypted cloud snapshots and encrypted SMS phone numbers.
- `USDA_API_KEY` — optional. Without it, search returns Open Food Facts only.
- `VAPID_*` — required for Web Push. Generate a pair with
  `npx web-push generate-vapid-keys`.
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist. Defaults to the GitHub Pages origin
  plus localhost dev ports.
- `DAILY_SEARCH_LIMIT` — default `300` requests per IP per UTC day when KV is bound.
- `AI_DAILY_RECOGNIZE` / `AI_DAILY_PARSE` / `AI_DAILY_CHAT` / `AI_DAILY_RECIPE` — defaults
  `10` / `40` / `60` / `20` per device+IP per UTC day.
- `AI_MONTHLY_REQUEST_CAP` — default `5000` across the whole Worker.

## Device auth and cloud backup

1. The client sends its random `X-CalAI-Device` ID to `/v1/auth/register`.
2. The Worker generates a 256-bit token, returns it once, and stores only its SHA-256 hash.
3. The client stores the token in localStorage and sends
   `Authorization: Bearer <token>` + `X-CalAI-Device` for sync and SMS.
4. Snapshots are serialized, size-capped (1 MB), encrypted with AES-GCM, and stored in D1
   against the device. The client validates the snapshot after decrypting it.
5. DELETE removes the snapshot; turning off SMS deletes the SMS row. There is no account
   recovery if the browser token is lost.

The snapshot intentionally excludes the SMS phone number. SMS preferences live in a separate
encrypted table.

## AI

- Vision accepts JPEG, PNG, WebP, or GIF data URLs. The client downscales to ≤ 1024 px and
  strips EXIF; the Worker checks MIME, size (≤ 5 MB), and magic bytes before calling DeepSeek.
- Prompts require JSON-only output. The Worker parses and clamps items, drops nameless
  entries, caps counts, and reports low confidence to the client.
- Chat context is built on the client from aggregates only (no raw diary rows). The model may
  return a proposal, but the client must show it and require a confirmation click before
  writing entries.
- Thinking is disabled for latency. Requests have explicit timeouts and no automatic retries
  to avoid duplicate spend.
- AI output is an estimate, not medical advice. A formal eval set and stronger abuse control
  (Turnstile/accounts) are still needed before public scale.

## SMS

- Outbound only. No inbound webhook or reply processing is implemented.
- The client requires a phone number with a country code, an explicit consent checkbox, at
  least one enabled reminder, and a timezone. The Worker encrypts the phone with
  `DATA_ENC_KEY`.
- The cron runs every 5 minutes, resolves local time with `Intl.DateTimeFormat`, honors quiet
  hours, sends at most four texts per device per local day, and dedupes with a unique
  `(device_id, reminder_id, day)` row in `sms_log`.
- Messages omit food/calorie data and end with `Replies are not monitored.`
- Textbelt failures are recorded as `failed`; quota errors stop that cron pass early.
- Turning SMS off deletes the server row. If the delete request fails, the client reports that
  delivery may continue and keeps the controls available for a retry.

## Local development

```powershell
cd worker
# .dev.vars is gitignored; put local-only values there:
# DEEPSEEK_API_KEY=...
# TEXTBELT_API_KEY=...
# DATA_ENC_KEY=...
npx wrangler dev
# then build/run the PWA with VITE_API_BASE=http://localhost:8787
```

Wrangler loads `.dev.vars` automatically. Local KV/D1 state is under `worker/.wrangler/`.

On this Windows machine, Wrangler 4.42 cannot start the local workerd runtime
(`std::terminate()` from Miniflare); Wrangler 4.152 requires Node 22 and this machine runs
Node 20.12. Production routing is verified: `/health`, CORS, KV-cached search, auth/register,
encrypted sync PUT/GET/DELETE, DeepSeek text/chat/recipe/vision, and a browser run against the
production bundle all passed on 2026-10-25. Use Node 22 for local `wrangler dev`.

Router handlers are awaited inside the top-level `try`. Without the `await`, rejected
`AiError`/`SyncError`/`SmsServiceError` promises bypass the catch and Cloudflare returns error
1101 instead of the intended status.

## Testing

Pure tests run from the repository root:

```powershell
cd ..
npx vitest run worker/src
```

Live provider calls are not part of CI. Text/search smoke tests can be done with `curl` or the
app after deployment. The D1 schema is in `migrations/0001_init.sql`; `ensureSchema` creates
the same tables at runtime so a missed migration does not break local development. Deployment
smoke rows were deleted from D1 after verification, so `devices`, `sync_snapshots`, and
`sms_prefs` are empty.

## Privacy

Queries go to Open Food Facts (and USDA when configured) only when the user searches. AI
requests happen only after explicit consent and contain the chosen photo/text or locally
computed aggregates. The Worker does not log prompts, photos, food names, calorie values,
phone numbers, or keys. It stores device hashes, encrypted snapshots, encrypted SMS
preferences, SMS delivery status, quotas, and push subscriptions.
