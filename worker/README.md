# CalAI Worker

Optional Cloudflare Worker for CalAI. The PWA remains fully local-first; this Worker only
handles online food search, barcode lookup, KV caching, USDA results, and Web Push.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness check |
| GET | `/v1/foods/search?q=oat+milk&limit=20` | Open Food Facts + optional USDA, cached 7 days |
| GET | `/v1/foods/barcode/:code` | Open Food Facts barcode lookup, cached |
| POST | `/v1/push/subscribe` | Store/update a push subscription and reminder times |
| POST | `/v1/push/unsubscribe` | Remove a push subscription |

Search responses are `{ foods, sources, cached }`. Foods are normalised to 100 g with
`source: "off" | "usda"` and no API keys are returned to the client.

## Setup

```powershell
cd worker
npm install
npx wrangler kv namespace create CALAI_CACHE
# Paste the returned id into wrangler.toml, replacing REPLACE_WITH_KV_NAMESPACE_ID.
npx wrangler secret put USDA_API_KEY       # optional
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT      # e.g. mailto:you@example.com
npm run typecheck
npx wrangler deploy
```

Then build the PWA with:

```powershell
$env:VITE_API_BASE="https://calai-api.<account>.workers.dev"
$env:VITE_VAPID_PUBLIC_KEY="<public key>"
npm run build
```

`VITE_*` values are build-time values for the static app. Do not commit them if they contain
secrets; the VAPID public key is not secret, but keep environment files out of git.

## Configuration

- `CALAI_CACHE` — KV namespace. Strongly recommended; if omitted, search still works but is
  not cached and rate limiting is skipped.
- `USDA_API_KEY` — optional. Without it, search returns Open Food Facts only.
- `VAPID_*` — required for push. Generate a key pair with `npx web-push generate-vapid-keys`
  (or use another VAPID tool).
- `ALLOWED_ORIGINS` — comma-separated CORS allowlist. Defaults to the GitHub Pages origin
  plus localhost dev ports.
- `DAILY_SEARCH_LIMIT` — default `300` requests per IP per UTC day when KV is bound.

Cron runs every five minutes. Push payloads are generic (`"Time to log lunch"`) and contain
no food or calorie data. Dead subscriptions (404/410) are deleted. Quiet hours are stored
per subscription.

## Local development

```powershell
npx wrangler dev
# then build/run the PWA with VITE_API_BASE=http://localhost:8787
```

KV is optional in local dev. The Worker returns 503 for push endpoints when KV or VAPID keys
are missing.

## Testing

Pure normalization tests run from the repository root as part of `npm test`:

```powershell
cd ..
npx vitest run worker/src/normalize.test.ts
```

Live provider calls are intentionally not part of CI. Smoke-test Open Food Facts and USDA
after deploying with `curl` or the app itself. Open Food Facts may return generic or
irrelevant products for broad queries; the Worker filters results that do not mention every
query token and the client applies the same filter.

## Privacy

Queries are sent to Open Food Facts (and USDA when configured) only when the user searches.
The Worker logs status/latency only, not query contents, and never receives the diary.
