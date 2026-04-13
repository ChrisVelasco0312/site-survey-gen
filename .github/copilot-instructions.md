# GitHub Copilot Instructions

## Build, dev, lint, docs

- Dev server: `npm run dev`
- Production build: `npm run build`
- Preview built app: `npm run preview`
- Lint all files: `npm run lint`
- Serve Docsify docs: `npm run docs:serve` (serves `/docs`)

## Architecture overview

- SPA built with Preact + Vite + Mantine; entrypoint `src/index.tsx` renders `<App />` into `#app`.
- Routing via `preact-iso` `Router` inside `LocationProvider`. There must be a single top‑level `<Router>` (see comment in `index.tsx`); add new pages as `Route` children there.
- Authentication via `features/auth/AuthContext` and `withProtectedLayout` HOC. Public route: `/login`. All other routes are wrapped in `withProtectedLayout`. When adding protected pages, follow this pattern.
- Domain pages under `src/pages` use `Report` and other domain types from `src/types`. Business logic is shared with modules in `features/`, `services/`, and `utils/`.
- Offline‑first persistence: `src/utils/indexedDB.ts` defines IndexedDB DB `site_survey_db` with stores for users, reports, sync queue, sites, and `distrito_municipio`. All local persistence should go through helpers (e.g. `saveReportToDB`, `getSyncQueue`) instead of using `indexedDB` directly.
- Sync with Firestore: `src/services/SyncService.ts` exports singleton `syncService` that listens to `online` events and a 5‑minute interval, drains the sync queue (`getSyncQueue` + `clearSyncQueueItem`) and writes to Firestore `reports` documents via `reportWithStorageUrls`. When adding offline operations, enqueue `SyncItem`s rather than writing to Firestore directly.
- Firebase config lives in `src/firebase-config.ts`. Firestore collections/fields are documented in `docs/technical/firestore_structure.md`; keep schema changes and code in sync with that doc.
- PDF generation: `src/utils/pdfGenerator.ts` uses pdfme (`@pdfme/generator`, `@pdfme/schemas`) with runtime‑loaded Roboto fonts and `/template_v2.json`. `buildPdfInputs(report: Report)` maps the `Report` model into template fields. When changing either the template or the `Report` shape, update this mapping and keep UI labels and `docs/technical/template_migration.md` aligned.
- Docs site: `/docs` is a Docsify portal (`docs/README.md`, `docs/_sidebar.md`). `.github/workflows/docs.yml` deploys the `docs/` directory to GitHub Pages using `peaceiris/actions-gh-pages`.

## Key domain conventions

- `Report` is the central aggregate; nested structures like `pole_infrastructure`, `infrastructure_details`, and `ptz_survey` are updated immutably. In form steps, prefer helper setters such as `setPoleInfra`, `setInfrastructureDetails`, and `setPtzSurvey` (see `ReportEditStep5.tsx`) that spread the previous report and set `updated_at: Date.now()`.
- Route length calculations in `ReportEditStep5` derive `baseDistance` as the sum of surface segments (`pole_infrastructure.*_meters`) plus `service_entrance.height` and `camera_point.height`. UI fields for “DISTANCIA DE ACOMETIDA …” display `baseDistance + extra`, where `electrical_distance` and `fiber_distance` store only the additional meters above `baseDistance`. Preserve this contract in any new calculations and keep PDF generation logic consistent.
- PTZ‑specific fields (e.g. `ptz_survey.has_aerial_cables`, `ptz_survey.distance_from_pole`) are only relevant when `report.address.site_type === 'ptz'`; conditionally render and persist them based on that flag, both in UI and PDFs.
- Camera mounting options (`camera_mounting`) use fixed string enums like `soporte_t`, `soporte_c`, and `soporte_l`. Keep any new options coordinated between UI radio groups, the `Report` type, and PDF mappings.

## Linting and style

- ESLint extends `eslint-config-preact` (`eslint.config.js`) and adds:
  - `semi: ['error', 'always']`
  - `no-unused-vars` with `^_`‑prefixed ignore patterns for intentionally unused variables/args.
- Use semicolons, avoid unused variables, and prefix intentionally unused params with `_` to satisfy lint.

## Preact/React interop

- TypeScript is configured with `jsx: "react-jsx"` and `jsxImportSource: "preact"`, and `tsconfig.json` path aliases map `react` / `react-dom` to `preact/compat`. When adding libraries that expect React, import from `react`/`react-dom` and rely on this compat mapping instead of adding React as a separate dependency.

## Working with docs

- For deeper understanding of flows, state machines, and data model, prefer the Docsify pages:
  - `/technical/architecture`
  - `/technical/workflow`
  - `/technical/firestore_structure`
  - `/technical/template_migration`
- Keep code changes aligned with these docs; update both code and docs together when altering flows, data shapes, or PDF templates.
