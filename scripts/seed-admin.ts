/**
 * scripts/seed-admin.ts — one-time admin bootstrap.
 *
 * This is a MANUALLY RUN script, not an API route. It is not imported by the
 * app and is not reachable over HTTP. It replaces the deleted
 * /api/setup-admin-password route (which was gated only by a hardcoded secret).
 *
 * It creates the FIRST admin and refuses to run if any admin already exists,
 * so it cannot be used to silently mint extra admins on a live system.
 *
 * Run it (Node 22.6+ can execute TypeScript directly):
 *
 *   node --experimental-strip-types scripts/seed-admin.ts <email> <password> [name]
 *
 * or with env vars:
 *
 *   SEED_ADMIN_EMAIL=you@co.com SEED_ADMIN_PASSWORD='a-strong-password' \
 *     node --experimental-strip-types scripts/seed-admin.ts
 *
 * Requires the same database credentials the app uses, in the environment:
 *   (blueprint_)TURSO_DATABASE_URL and (blueprint_)TURSO_AUTH_TOKEN
 *
 * (If you prefer, `npx tsx scripts/seed-admin.ts ...` works too.)
 */
import { createClient } from '@libsql/client'
import bcrypt from 'bcryptjs'
import { createId } from '@paralleldrive/cuid2'

function usage(message?: string): never {
  if (message) console.error(`\nError: ${message}\n`)
  console.error(
    [
      'Usage — create the first admin (refuses if one already exists):',
      '',
      '  node --experimental-strip-types scripts/seed-admin.ts <email> <password> [name]',
      '',
      'or via environment variables:',
      '',
      '  SEED_ADMIN_EMAIL=you@co.com SEED_ADMIN_PASSWORD=strong-pass \\',
      '    node --experimental-strip-types scripts/seed-admin.ts',
      '',
      'Requires database credentials in the environment:',
      '  (blueprint_)TURSO_DATABASE_URL and (blueprint_)TURSO_AUTH_TOKEN',
      '',
      'Password must be at least 8 characters.',
      '',
    ].join('\n')
  )
  process.exit(1)
}

async function main() {
  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken =
    process.env.blueprint_TURSO_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!dbUrl) {
    usage(
      'Database URL not found. Set blueprint_TURSO_DATABASE_URL or TURSO_DATABASE_URL.'
    )
  }

  const email = (process.argv[2] || process.env.SEED_ADMIN_EMAIL || '')
    .trim()
    .toLowerCase()
  const password = process.argv[3] || process.env.SEED_ADMIN_PASSWORD || ''
  const name = process.argv[4] || process.env.SEED_ADMIN_NAME || null

  if (!email) usage('Missing email.')
  if (!password) usage('Missing password.')
  if (password.length < 8) usage('Password must be at least 8 characters.')

  const client = createClient({ url: dbUrl, authToken })

  // Guard: never run if an admin already exists.
  const existingAdmins = await client.execute({
    sql: "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'",
    args: [],
  })
  const adminCount = Number(existingAdmins.rows[0]?.n ?? 0)
  if (adminCount > 0) {
    console.error(
      `\nRefusing to run: ${adminCount} admin user(s) already exist. ` +
        `This script only bootstraps the FIRST admin.\n`
    )
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const nowSeconds = Math.floor(Date.now() / 1000) // drizzle timestamp mode = seconds

  // If the email already exists (as a non-admin, since no admin exists),
  // promote it in place; otherwise insert a fresh admin.
  const existing = await client.execute({
    sql: 'SELECT id FROM users WHERE email = ? LIMIT 1',
    args: [email],
  })

  if (existing.rows.length > 0) {
    const id = String(existing.rows[0].id)
    await client.execute({
      sql:
        'UPDATE users SET role = ?, password_hash = ?, must_change_password = 0, ' +
        'is_active = 1, updated_at = ? WHERE id = ?',
      args: ['admin', passwordHash, nowSeconds, id],
    })
    console.log(`\nPromoted existing user ${email} to admin (id ${id}).\n`)
  } else {
    const id = createId()
    await client.execute({
      sql:
        'INSERT INTO users (id, email, name, role, password_hash, ' +
        'must_change_password, is_active, created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)',
      args: [id, email, name, 'admin', passwordHash, nowSeconds, nowSeconds],
    })
    console.log(`\nCreated admin ${email} (id ${id}).\n`)
  }

  console.log('You can now sign in with this email and password.')
  process.exit(0)
}

main().catch((err) => {
  console.error('\nseed-admin failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
