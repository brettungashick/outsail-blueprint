/**
 * Next.js instrumentation hook — runs once on server startup.
 * Automatically applies all DB migrations on every deploy.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Module-level flag so migrations only run once per cold start
// (protects against multiple calls in dev hot-reload scenarios)
let migrationsDone = false

export async function register() {
  // Only run in the Node.js runtime, not the Edge runtime
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  // Skip if already ran this process lifecycle
  if (migrationsDone) return
  migrationsDone = true

  // Skip if no DB URL is configured (e.g. during build)
  const dbUrl =
    process.env.blueprint_TURSO_DATABASE_URL || process.env.TURSO_DATABASE_URL
  if (!dbUrl) {
    console.log('[migrations] No TURSO_DATABASE_URL — skipping auto-migration')
    return
  }

  try {
    // Dynamic import keeps this out of the Edge bundle
    const { runMigrations } = await import('./lib/db/migrations')
    const report = await runMigrations()

    const added = Object.values(report.columns).filter((v) => v === 'added').length
    const tablesOk = Object.values(report.tables).filter((v) => v === 'ok').length

    if (report.errors.length > 0) {
      console.error('[migrations] Completed with errors:', report.errors)
    } else {
      console.log(
        `[migrations] OK — ${tablesOk} tables ensured, ${added} columns added, ` +
          `${report.vendors.inserted} vendors seeded`
      )
    }
  } catch (err) {
    // Log but do not crash the app — a migration failure should not prevent startup
    console.error('[migrations] Auto-migration failed:', err)
  }
}
