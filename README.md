# CalAI

A mobile-first calorie tracker that installs from the web and works offline.

**v0.1.1 alpha** — live at <https://braillegov.github.io/CalAI/>

## What works

- First-run onboarding: goal, pace, body stats (metric or imperial), activity, calculated
  calorie and macro targets with manual override.
- Daily diary by meal, date navigation, portions, quick add, edit and delete.
- Food library: ~100 common foods, custom foods, search, favorites, recents.
- Calorie ring, macro progress, 7-day chart, 30-day history.
- Dark, light, and system themes; metric/imperial display.
- Full JSON export and validated import.
- Installable PWA with a fully offline diary; data lives in local storage.
- Accessible dialogs, keyboard support, reduced-motion support, mobile safe areas.

Not in v0.1: accounts, remote food database, barcode scanning, weight/water/exercise,
reminders, photo or text logging, and AI chat. Those are planned in [PLAN.md](PLAN.md) and
[docs/architecture.md](docs/architecture.md).

## Stack

Vite 6, React 18, TypeScript, Zustand with synchronous localStorage persistence, HashRouter,
plain CSS with design tokens, `vite-plugin-pwa` for offline and install support. No backend,
no runtime API calls, no accounts. `idb-keyval` is used only for a one-time recovery read
from the v0.1.0 IndexedDB store.

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
│   │   ├── today/              # diary + add/edit sheets
│   │   ├── foods/              # library and custom foods
│   │   ├── history/
│   │   └── settings/
│   ├── data/seedFoods.ts
│   ├── lib/                    # dates, nutrition, search, backup
│   ├── store/useAppStore.ts
│   ├── styles/global.css
│   └── types.ts
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
npm test           # 27 unit tests (nutrition, dates, search, backup, legacy state)
npm run typecheck
npm run build      # production build in dist/
npm run preview    # serve dist at http://localhost:4173/CalAI/
```

The app is served under `/CalAI/` in dev and production. Do not change `base` without also
changing the manifest scope/start URL and the Pages path.

## Data and privacy

- Everything is stored locally in localStorage under `calai:v1`; there is no server.
- v0.1.1 switches from IndexedDB to localStorage because blocked/async IndexedDB could leave
  the app on its opening screen forever. A bounded background read imports any diary written
  by the earlier v0.1.0 build, so existing data is not lost.
- If storage is blocked entirely, CalAI still opens and shows an in-app warning; changes are
  not saved. Allow site data to keep the diary.
- Export a JSON backup from Settings before clearing browser data or switching devices.
- Import replaces local data after confirmation and validates every field.
- `noindex` and `robots.txt` keep the alpha out of search results. Remove both before a
  public launch.
- Nutrition values are estimates, not medical advice. The onboarding target calculator
  enforces a 1,200 kcal floor.

## Deployment

Every push to `main` triggers `.github/workflows/deploy.yml`:

1. `npm ci`, unit tests, production build.
2. Upload `dist/` and deploy through GitHub Actions Pages.

Pages is configured with **build_type: workflow**; do not commit `dist/` or switch the
source back to a branch. The deployment takes about a minute.

## Quality bar

- Lighthouse mobile (live deployment): Performance 100, Accessibility 100, Best Practices
  100. SEO 60 is expected while `noindex` is set.
- 27 unit tests plus browser smoke coverage for onboarding, logging, editing, deletion,
  export/import, offline reload, reset, validation, imperial units, and theme persistence.
- Storage recovery tests: blocked IndexedDB, blocked localStorage, corrupt local state, and a
  seeded v0.1.0 IndexedDB diary migrating into localStorage.
- axe-core: 0 WCAG 2.1 A/AA violations across onboarding, diary, sheets, foods, history, and
  settings in both themes.
- Verified at 360 px and 390 px widths with no horizontal overflow.
- Initial bundle: 73.3 KB JS and 5.8 KB CSS, gzip.

## Next

v0.2 is the "faster logging" release: remote food search (Open Food Facts + USDA), barcode
scanning, favorites/recents improvements, recipes, weight/water, and reminders including Web
Push. v0.3 adds photo recognition, natural-language logging, and a data-grounded chat.
See [PLAN.md](PLAN.md) for scope, milestones, and open decisions. Current limitations,
QA gaps, and a ready-to-paste next-session prompt live in [NOTES.md](NOTES.md).
