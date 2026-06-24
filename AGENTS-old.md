# Repository Guidelines

## Project Structure & Module Organization
AT-ERP is a React + TypeScript Vite app for educational ERP workflows: finance, AR/AP, inventory, student/trainer operations, payroll, subscriptions, and admin/RBAC. The active entry path is `index.tsx` -> `App.tsx`; `App.tsx` owns tab navigation, lifted state, tenant selection, and view orchestration. Feature screens live in `views/`, shared UI in `components/`, cross-cutting settings in `config/`, and domain/data logic in `services/`.

`services/DataServiceFactory.ts` always returns `SupabaseDataService`; `config/app.ts` keeps Supabase credentials and sets `useMockData: false`. Keep data contracts in `services/IDataService.ts` aligned with `SupabaseDataService.ts` when adding entities. `types.ts` is the central model file. Accounting calculations belong in `accountingService.ts`, especially balance and report summary logic. Supabase database changes live under `supabase/migrations/`, and edge functions are under `supabase/functions/`.

There is also a `src/` tree containing duplicated inventory/backup files plus `src/index.css`. Note that `tsconfig.json` excludes `src` except where files are imported directly, while Tailwind scans it.

## Build, Test, and Development Commands
- `npm run dev` starts the Vite dev server.
- `npm run build` creates the production build in `dist/`.
- `npm run preview` serves the built app locally.
- `npm test` runs Vitest.
- `npm test -- tests/InvoicesView.test.tsx --run` runs a single test file once.
- `npm run test:watch` runs Vitest explicitly in watch mode.

## Coding Style & Naming Conventions
Use React function components with TypeScript and the `react-jsx` transform. View files follow the existing `[Feature]View.tsx` naming pattern and are routed from `App.tsx`. Prefer typed entities from `types.ts`; existing tests use `any` for wide view props, but app code should stay typed where practical. Use the `@/*` path alias only when it improves clarity. Tailwind uses Open Sans and scans `index.html`, root app files, `components/`, `views/`, and `src/`. No ESLint or Prettier config is present.

## Testing Guidelines
Vitest settings are declared in `package.json` with `globals: true`, `jsdom`, and `tests/setupTests.ts`, but current CLI runs through `vite.config.ts` did not apply those settings. Move the test config into `vite.config.ts` or import Vitest APIs explicitly before relying on globals or DOM setup. Current tests cover `StudentDocumentService`, `ARView`, and `InvoicesView`; use React Testing Library for view behavior and mock Supabase calls with `vi.spyOn` as existing tests do.

## Commit & Pull Request Guidelines
Recent commit messages are informal, short summaries such as `update todo`, `updated learner upload logic`, and merge commits from feature branches. Keep new commits concise and descriptive. No PR template was found under `.github/`.
