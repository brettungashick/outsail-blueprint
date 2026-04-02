import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Sidebar } from '@/components/layout/sidebar'
import { getLogoUrl } from '@/lib/db/app-settings'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

  if (!sessionCookie?.value) {
    redirect('/login')
  }

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) {
    redirect('/login')
  }

  // Fetch user details for the sidebar
  let userEmail = session.email
  let userName: string | undefined

  try {
    const user = await db
      .select({ email: users.email, name: users.name })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()

    if (user) {
      userEmail = user.email
      userName = user.name ?? undefined
    }
  } catch {
    // Non-fatal: sidebar will fall back to session email
  }

  const logoUrl = await getLogoUrl()

  return (
    <div className="flex h-screen overflow-hidden bg-outsail-gray-50">
      <Sidebar userEmail={userEmail} userName={userName} logoUrl={logoUrl ?? undefined} />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-content mx-auto px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
