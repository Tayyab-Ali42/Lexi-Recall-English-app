# Vocab Atelier

A personal English vocabulary studio for saving words, phrases, idioms, and phrasal verbs, enriching them with AI explanations, and reviewing them with spaced repetition.

## Run & Operate

- `pnpm --filter @workspace/vocab-atelier run dev` — run the Vocab Atelier web app
- `pnpm --filter @workspace/api-server run dev` — run the API server
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- Web app: `artifacts/vocab-atelier`
- API routes: `artifacts/api-server/src/routes`
- Database schema: `lib/db/src/schema`
- API contract and generated clients: `lib/api-spec`, `lib/api-client-react`, and `lib/api-zod`
- Print/PDF export: Library page in `artifacts/vocab-atelier/src/App.tsx`, styled in `artifacts/vocab-atelier/src/index.css`

## Architecture decisions

- The web app uses the existing API and PostgreSQL schema; it does not keep vocabulary in browser-only state.
- Vocabulary export uses the browser print dialog, so users can choose “Save as PDF” without a new PDF runtime dependency.

## Product
- Save, edit, enrich, search, filter, review, and inspect vocabulary progress.
- From Library, `Export PDF` prints the complete unfiltered collection. In the print dialog, choose “Save as PDF”.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
