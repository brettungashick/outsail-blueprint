import { NextRequest, NextResponse } from 'next/server'
import { runMigrations } from '@/lib/db/migrations'

export const dynamic = 'force-dynamic'

const SETUP_SECRET = 'outsail-init-2026'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  if (searchParams.get('secret') !== SETUP_SECRET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const report = await runMigrations()
    const hasErrors = report.errors.length > 0
    return NextResponse.json({ ok: !hasErrors, ...report }, { status: hasErrors ? 207 : 200 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
