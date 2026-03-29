import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from './schema'

// Vercel's Turso integration injects vars with a "blueprint_" prefix.
// Fall back to the unprefixed names for local dev and other environments.
const dbUrl =
  process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL

const authToken =
  process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

if (!dbUrl) {
  throw new Error(
    'Database URL not found. Set blueprint_TURSO_DATABASE_URL or TURSO_DATABASE_URL.'
  )
}

const client = createClient({ url: dbUrl, authToken })

export const db = drizzle(client, { schema })

export type Database = typeof db
