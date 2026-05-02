# Commands
- Dev server: \`npm run dev\`
- Production build: \`npm run build\`
- Preview: \`npm run preview\`
- Lint: \`npm run lint\`
- Docs (local): \`npm run docs:serve\`

No test suite. Verify manually via \`npm run build\` after changes.

# Architecture
- SPA: Preact + Vite + Mantine UI. Entrypoint \`src/index.tsx\` → \`<App />\`.
- Single top-level \`<Router>\` (preact-iso). All routes except \`/login\` wrapped in \`withProtectedLayout\`. Add pages as \`<Route>\` children inside \`App\`.
- Central aggregate: \`Report\` type in \`src/types\`. Domain logic in \`features/\`, \`services/\`, \`utils/\`.
- Offline-first: IndexedDB (\`src/utils/indexedDB.ts\`) with sync queue. Write locally, sync via \`SyncService\` singleton (\`src/services/SyncService.ts\`). Never write to Firestore directly for local ops.
- PDF: \`@pdfme/generator\` + \`@pdfme/schemas\` with runtime Roboto fonts and \`public/template_v2.json\`. Template↔Report mapping in \`src/utils/pdfGenerator.ts\`.
- Firebase config: \`src/firebase-config.ts\`. Firestore schema in \`docs/technical/firestore_structure.md\`; keep both in sync.

# Key domain rules
- \`Report\` nested structures (\`pole_infrastructure\`, \`infrastructure_details\`, \`ptz_survey\`) updated immutably via helpers like \`setPoleInfra\`, \`setInfrastructureDetails\`, \`setPtzSurvey\`.
- Route distance: \`baseDistance\` = surface segments + service/camera heights. UI fields display \`baseDistance + extra\`; \`electrical_distance\`/\`fiber_distance\` store only addtl meters.
- PTZ fields relevant only when \`report.address.site_type === 'ptz'\`.
- Camera mounting: fixed string enums (\`soporte_t\`, \`soporte_c\`, \`soporte_l\`). Sync UI, type, and PDF.

# Preact/React interop
TypeScript maps \`react\`/\`react-dom\` to \`preact/compat\` via \`tsconfig.json\` paths. Import from \`react\` for compat libs (Mantine, etc.).

# Lint style
ESLint (\`eslint-config-preact\` + custom rules). Semicolons required. Prefix intentionally unused vars with \`_\`.

# Service scripts
\`service/package.json\` (separate package): user deploy, site seeding via Firebase Admin. Run from \`service/\` dir with own deps.

# Docs
\`docs/\` is Docsify. Deploys to GitHub Pages on push to main/master (\`.github/workflows/docs.yml\`). Keep tech docs aligned with code changes.
