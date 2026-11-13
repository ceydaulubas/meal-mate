# MealMate

MealMate is a recipe discovery and collaborative meal-planning app. The MVP starts with
individual discovery: one recipe at a time, swipe right to save a recipe to your personal saved
recipes, and swipe left to skip it for the current session.

Shared spaces and collaborative meal planning are part of the MVP. Collaborative discovery,
group voting, and recipe matching are explicitly out of scope.

## Status

This repository currently contains **Project Foundation** only. Authentication, database
migrations, recipes, discovery, and meal planning are not implemented yet.

## Stack

- pnpm workspaces + Turborepo
- React + TypeScript + Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS
- Supabase (browser client; no backend application)
- Vitest + Testing Library
- ESLint + Prettier
- Zod (shared contracts)

## Prerequisites

- Node.js `>=22.22.0`
- pnpm `>=10`

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Fill in the two Supabase values in `.env` when you start integrating Supabase. The Home page does
not require them because the Supabase client is created lazily.

The web app runs at `http://localhost:5173`.

## Scripts

Run from the repository root:

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `pnpm dev`          | Start workspace development tasks          |
| `pnpm build`        | Type-check and build the web app           |
| `pnpm lint`         | Lint every workspace package               |
| `pnpm typecheck`    | Strict TypeScript checks for every package |
| `pnpm test`         | Run unit tests                             |
| `pnpm format`       | Format the repository with Prettier        |
| `pnpm format:check` | Check formatting without writing           |
| `pnpm check`        | Run lint, typecheck, and tests in sequence |

## Structure

```text
meal-mate/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layouts/       # Application shell
│       │   │   ├── providers/     # Query client and global providers
│       │   │   └── router/        # Route configuration
│       │   ├── features/
│       │   │   └── home/          # Home page (business features land here)
│       │   ├── lib/
│       │   │   └── supabase/      # Reusable Supabase browser client
│       │   ├── stores/            # Zustand client/UI state
│       │   ├── styles/            # Tailwind entry point
│       │   ├── test/              # Vitest setup
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── contracts/
│       ├── src/index.ts           # Shared types and Zod schemas
│       └── package.json
├── supabase/
│   └── migrations/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── README.md
```

Folders such as `components/`, `hooks/`, `features/recipes/`, and `features/spaces/` will be added
when they contain real code rather than empty placeholders.

## Architecture notes

- **Feature-based frontend.** Business features belong in `apps/web/src/features`. App-wide routing,
  providers, and layouts stay in `src/app`.
- **Shared contracts.** `@meal-mate/contracts` exports TypeScript source directly. This is the Vite
  internal-package pattern: no separate build or watch process is needed for local development.
- **Supabase.** `lib/supabase/client.ts` exposes a lazy singleton via `getSupabaseClient()`. It fails
  with a clear message when environment variables are missing, without breaking routes that do not
  use it.
- **Environment variables.** Only public browser values are exposed through Vite:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

  Never put a Supabase service-role key in the web app.

- **Tailwind CSS v4.** Configured through the `@tailwindcss/vite` plugin; there is no
  `tailwind.config.js`.
- **TypeScript.** Pinned to `~6.0.3` because the current `typescript-eslint` release supports
  TypeScript `<6.1.0`. Revisit when typescript-eslint adds TypeScript 7 support.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
