import type { Config } from 'drizzle-kit';

<<<<<<< HEAD
=======
// Vercel's Turso integration injects vars with a "blueprint_" prefix.
// Fall back to the unprefixed names for local dev and other environments.
const dbUrl =
  process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL

const authToken =
  process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

>>>>>>> origin/main
export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'turso',
  dbCredentials: {
<<<<<<< HEAD
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
=======
    url: dbUrl!,
    authToken,
>>>>>>> origin/main
  },
} satisfies Config;
