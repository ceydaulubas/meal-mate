# MealMate

MealMate is a recipe discovery and collaborative meal-planning app. The MVP starts with
individual discovery: one recipe at a time, swipe right to save a recipe to your personal saved
recipes, and swipe left to skip it for the current session.

Shared spaces and collaborative meal planning are part of the MVP. Collaborative discovery,
group voting, and recipe matching are explicitly out of scope.

## Status

This repository currently contains **Project Foundation** and **Authentication & Personal
Space**. Sign up, email confirmation, sign in, profile creation, personal space creation, a
protected dashboard, and sign out are implemented.

Recipes, discovery, Shared Space invitations, and meal planning are not implemented yet.

## Stack

- pnpm workspaces + Turborepo
- React + TypeScript + Vite
- React Router
- TanStack Query
- Zustand
- Tailwind CSS
- React Hook Form + Zod
- Supabase (browser client + Postgres with RLS)
- Vitest + Testing Library
- pgTAP (database integration tests)
- ESLint + Prettier

## Prerequisites

- Node.js `>=22.22.0`
- pnpm `>=10`
- Docker (for the local Supabase stack)

## Getting started

```bash
pnpm install
cp .env.example .env
```

For a local-first setup, start the isolated Supabase stack and copy its URL and publishable key
into `.env`:

```bash
pnpm supabase start
pnpm supabase status
pnpm dev
```

The web app runs at `http://localhost:5173`.

> This repository uses `project_id = "meal-mate"` and non-default ports (`54331` API, `54332`
> database, `54333` Studio, `54334` Mailpit) so it does not collide with other local Supabase
> projects on the same machine. Never point one project's CLI commands at another project's
> stack.

## Authentication

The auth flow covers:

1. **Sign up** at `/signup` with display name, email, and password.
2. **Email confirmation** at `/auth/callback`. Locally, confirmation emails are captured by
   Mailpit at `http://127.0.0.1:54334`.
3. **Sign in** at `/login`.
4. **Dashboard** at `/dashboard`, which is protected and shows the signed-in user's profile and
   personal space.
5. **Sign out** from the header.

Protected routes redirect unauthenticated visitors to `/login`, preserving the intended path.
Signed-in users are redirected away from `/login` and `/signup`.

The browser only ever uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. A
service-role key must never be placed in the web app.

## Scripts

Run from the repository root:

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Start workspace development tasks               |
| `pnpm build`        | Type-check and build the web app                |
| `pnpm lint`         | Lint every workspace package                    |
| `pnpm typecheck`    | Strict TypeScript checks for every package      |
| `pnpm test`         | Run unit and UI tests                           |
| `pnpm test:db`      | Run pgTAP database tests against local Supabase |
| `pnpm format`       | Format the repository with Prettier             |
| `pnpm format:check` | Check formatting without writing                |
| `pnpm check`        | Run lint, typecheck, and tests in sequence      |

## Database

Migrations live in `supabase/migrations` and are applied in filename order.

| Table           | Purpose                                                          |
| --------------- | ---------------------------------------------------------------- |
| `profiles`      | One row per auth user. `display_name`, optional `avatar_url`.    |
| `spaces`        | `PERSONAL` or `SHARED`. `created_by` references `profiles`.      |
| `space_members` | `OWNER`, `ADMIN`, or `MEMBER`. Unique per `(space_id, user_id)`. |

### Automatic initialization

An `after insert` trigger on `auth.users` calls `private.initialize_new_user()`, which
atomically creates:

- the user's `profiles` row,
- exactly one `PERSONAL` space,
- an `OWNER` membership for that space.

The user id always comes from `auth.users.id`, never from client-supplied metadata. A missing or
blank `display_name` falls back to the email prefix, then to `MealMate User`.

### Enforced invariants

- One `PERSONAL` space per user (partial unique index on `spaces.created_by`).
- One `OWNER` per space (partial unique index on `space_members.space_id`).
- Every space must have an `OWNER` before the transaction commits (deferred constraint triggers).
- Personal spaces reject additional members and cannot be demoted or transferred.
- Space `type` and `created_by` are immutable.
- Membership identity fields (`space_id`, `user_id`) are immutable.

### Row Level Security

RLS is enabled on all three tables. Browser roles have no direct `INSERT` or `DELETE` grants;
profile and personal-space creation happens only through the auth trigger.

| Role            | Access                                                                   |
| --------------- | ------------------------------------------------------------------------ |
| `authenticated` | Read own profile; read spaces and memberships for spaces they belong to. |
| `authenticated` | Update only their own `display_name` and `avatar_url`.                   |
| `anon`          | No table access.                                                         |

A `private.is_space_member(uuid)` helper keeps space and membership policies non-recursive. It is
`SECURITY DEFINER` with `set search_path = ''`, `EXECUTE` revoked from `PUBLIC`, and granted only
to `authenticated`.

### Local database tests

```bash
pnpm supabase start
pnpm test:db
```

`supabase/tests/database/authentication_and_spaces.test.sql` runs pgTAP tests inside a rolled-back
transaction. It covers trigger behavior, safe display-name fallbacks, duplicate personal spaces,
duplicate owners, personal-space member rejection, missing owners, RLS visibility, cross-user
profile updates, unauthorized membership writes, and role escalation.

### Deploying migrations to Supabase Cloud

Migrations are **not** deployed automatically. After review and approval:

```bash
pnpm supabase login
pnpm supabase link --project-ref hhuxyrauhnxvncjyzzer
pnpm supabase db push
```

Also configure the Cloud project's Auth settings:

- **Site URL:** `https://<your-production-domain>`
- **Additional redirect URL:** `https://<your-production-domain>/auth/callback`

## Structure

```text
meal-mate/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   │   ├── layouts/       # Application shell and navigation
│       │   │   ├── providers/     # Query client and auth providers
│       │   │   └── router/        # Route configuration
│       │   ├── components/        # Small shared UI components
│       │   ├── features/
│       │   │   ├── auth/          # Auth API, provider, guards, pages, tests
│       │   │   ├── dashboard/     # Protected profile/personal-space view
│       │   │   └── home/          # Public landing page
│       │   ├── lib/
│       │   │   └── supabase/      # Reusable Supabase browser client
│       │   ├── stores/            # Zustand client/UI state
│       │   ├── styles/            # Tailwind entry point
│       │   ├── test/              # Vitest setup and render helpers
│       │   └── main.tsx
│       ├── index.html
│       ├── package.json
│       └── vite.config.ts
├── packages/
│   └── contracts/
│       ├── src/index.ts           # Shared types and Zod schemas
│       └── package.json
├── supabase/
│   ├── config.toml                # Isolated local Supabase configuration
│   ├── migrations/                # Versioned SQL migrations
│   └── tests/database/            # pgTAP integration tests
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example
├── .gitignore
└── README.md
```

## Architecture notes

- **Feature-based frontend.** Business features belong in `apps/web/src/features`. App-wide
  routing, providers, and layouts stay in `src/app`.
- **Shared contracts.** `@meal-mate/contracts` exports TypeScript source directly. This is the Vite
  internal-package pattern: no separate build or watch process is needed for local development.
- **Supabase.** `lib/supabase/client.ts` exposes a lazy singleton via `getSupabaseClient()`. It fails
  with a clear message when environment variables are missing, without breaking routes that do not
  use it.
- **Auth state.** `AuthProvider` loads the current session and subscribes to auth changes. Route
  guards consume the same context, so protected and guest-only routes stay in sync with sign in and
  sign out.
- **Environment variables.** Only public browser values are exposed through Vite:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`

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
pnpm test:db   # requires the local Supabase stack
```
