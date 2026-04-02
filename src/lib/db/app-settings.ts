import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'

/** Returns the stored logo (base64 data URL) or null. Never throws. */
export async function getLogoUrl(): Promise<string | null> {
  try {
    const row = await db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'logo'))
      .get()
    return row?.value ?? null
  } catch {
    return null
  }
}
