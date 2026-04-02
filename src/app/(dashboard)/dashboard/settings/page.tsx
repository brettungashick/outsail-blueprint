import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { SettingsClient } from './_settings-client'

export const metadata = {
  title: 'Settings',
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'U'
}

export default async function SettingsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  let currentUser: { email: string; name: string | null; role: string } | undefined

  try {
    const dbUser = await db
      .select({ email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()
    currentUser = dbUser ?? undefined
  } catch {
    // Non-fatal
  }

  const displayEmail = currentUser?.email ?? session.email
  const displayName = currentUser?.name ?? displayEmail.split('@')[0]
  const displayRole = currentUser?.role ?? session.role
  const initials = getInitials(currentUser?.name, displayEmail)

  // Fetch all users for admin
  let allUsers: Array<{
    id: string
    email: string
    name: string | null
    role: string
    must_change_password: boolean | null
    created_at: string | null
  }> = []

  if (displayRole === 'admin') {
    try {
      allUsers = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role,
          must_change_password: users.must_change_password,
          created_at: users.created_at,
        })
        .from(users)
        .orderBy(desc(users.created_at))
        .all() as typeof allUsers
    } catch {
      // Non-fatal
    }
  }

  return (
    <SettingsClient
      currentUserId={session.userId}
      currentRole={displayRole}
      displayEmail={displayEmail}
      displayName={displayName}
      displayRole={displayRole}
      initials={initials}
      users={allUsers}
    />
  )
}
