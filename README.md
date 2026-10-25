# CalAI

A fast, mobile-first calorie tracker for the web.

**Status:** foundation and hosting are ready; the tracker itself is not built yet.

- Live (placeholder): <https://braillegov.github.io/CalAI/>
- Repository: <https://github.com/BrailleGov/CalAI>

## Current state

| Piece | State |
| --- | --- |
| Repository | Ready |
| GitHub Pages hosting | Ready (branch deploy) |
| HTTPS + mobile viewport | Ready |
| Calorie tracker app | Next |

The site currently serves a single holding page (`index.html`). No framework, build step,
or dependencies have been chosen yet — see [PLAN.md](PLAN.md) for the working plan.

## Structure

```
.
├── index.html      # temporary holding page
├── 404.html        # GitHub Pages not-found page
├── favicon.svg
├── PLAN.md         # product + technical plan (draft)
├── .nojekyll       # serve files as-is, skip Jekyll
└── README.md
```

## Local preview

From this folder:

```powershell
python -m http.server 8080
# or
npx serve .
```

Open <http://localhost:8080>. The holding page uses relative paths so it works from any
subpath; `404.html` uses `/CalAI/` absolute paths because GitHub Pages serves it from the
project root.

## Deployment

Pages is configured to deploy from **`main` → `/` (root)**. Every push publishes in about
a minute; no workflow is required at this stage.

```powershell
git add .
git commit -m "Describe the change"
git push
```

If Pages ever needs re-configuring: repository → **Settings → Pages** → Source:
*Deploy from a branch* → `main` / `(root)`.

### When the app gains a build step

CalAI is a **project site**, so it lives under `/CalAI/`, not at the domain root. Before
adding a bundler:

1. Set the bundler base path to `/CalAI/` (for Vite: `base: '/CalAI/'`).
2. Switch Pages source to **GitHub Actions** and add a build + deploy workflow.
3. Emit a `404.html` copy of the built `index.html` if client-side routing is used.
4. Keep `.nojekyll` in the published output.

These steps are listed in [PLAN.md](PLAN.md) under deployment.
