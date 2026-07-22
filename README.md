# OutSail Blueprint

AI-powered workspace for capturing, structuring, and activating HR technology
requirements. Full product specification: [`docs/SPEC.md`](docs/SPEC.md).

## Prerequisites

- Node.js 20+ (Node 22.6+ recommended — the admin seed script runs TypeScript
  directly via `--experimental-strip-types`)
- npm
- A Turso (libSQL) database

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   The app **fails closed**: it refuses to start unless the variables marked
   `REQUIRED AT BOOT` in `.env.example` are set. Those are:

   - `TURSO_DATABASE_URL` — the database URL (the DB client throws on import if missing)
   - `NEXTAUTH_SECRET` — signs the 30-day session cookie
   - `MAGIC_LINK_SECRET` — signs the 15-minute magic-link tokens (must be a
     *different* value from `NEXTAUTH_SECRET`)

   Generate each secret with `openssl rand -base64 32`.

3. Run the dev server:

   ```bash
   npm run dev
   ```

## Creating the first admin

There is no HTTP endpoint for creating admins. Bootstrap the first one with the
manually-run script `scripts/seed-admin.ts`. It **refuses to run if any admin
already exists**, so it can only ever create the initial administrator.

With the database credentials set in your environment (the same ones the app
uses — `(blueprint_)TURSO_DATABASE_URL` and `(blueprint_)TURSO_AUTH_TOKEN`):

```bash
node --experimental-strip-types scripts/seed-admin.ts you@company.com 'a-strong-password' "Your Name"
```

Or via environment variables:

```bash
SEED_ADMIN_EMAIL=you@company.com SEED_ADMIN_PASSWORD='a-strong-password' \
  node --experimental-strip-types scripts/seed-admin.ts
```

(`npx tsx scripts/seed-admin.ts ...` works too.) Run the script with no
arguments to print full usage. After it succeeds, sign in with that email and
password. Additional advisors/admins are managed from the in-app admin UI.

## Tests

```bash
npm test
```

## Database migrations

Schema migrations run automatically on server startup
(`src/instrumentation.ts`). They can also be applied manually with
drizzle-kit (`npm run db:migrate` / `npm run db:push`) or via the
`.github/workflows/migrate.yml` GitHub Action.
