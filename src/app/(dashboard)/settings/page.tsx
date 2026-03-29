import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Settings, User, Bell, Shield, Palette } from 'lucide-react'

export const metadata = {
  title: 'Settings',
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
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

  let user: { email: string; name: string | null; role: string } | undefined

  try {
    const dbUser = await db
      .select({ email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(eq(users.id, session.userId))
      .get()
    user = dbUser ?? undefined
  } catch {
    // Non-fatal
  }

  const displayEmail = user?.email ?? session.email
  const displayName = user?.name ?? displayEmail.split('@')[0]
  const displayRole = user?.role ?? session.role
  const initials = getInitials(user?.name, displayEmail)

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    advisor: 'Advisor',
    client: 'Client',
    vendor: 'Vendor',
  }

  const sections = [
    {
      icon: User,
      label: 'Profile',
      description: 'Your account information',
    },
    {
      icon: Bell,
      label: 'Notifications',
      description: 'Configure email and in-app alerts',
    },
    {
      icon: Shield,
      label: 'Security',
      description: 'Manage session and access settings',
    },
    {
      icon: Palette,
      label: 'Appearance',
      description: 'Theme and display preferences',
    },
  ]

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Page header */}
      <div>
        <h1 className="text-header-lg text-outsail-navy">Settings</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Profile card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your OutSail Blueprint account information.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="text-lg bg-outsail-teal text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold text-outsail-navy">{displayName}</p>
              <p className="text-sm text-outsail-gray-600">{displayEmail}</p>
              <div className="mt-1.5">
                <Badge variant="outline" className="text-xs capitalize">
                  {roleLabels[displayRole] ?? displayRole}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-label text-outsail-gray-600 mb-1">Email</p>
              <p className="text-outsail-slate font-medium">{displayEmail}</p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-1">Role</p>
              <p className="text-outsail-slate font-medium capitalize">
                {roleLabels[displayRole] ?? displayRole}
              </p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-1">Authentication</p>
              <p className="text-outsail-slate font-medium">Magic Link (passwordless)</p>
            </div>
            <div>
              <p className="text-label text-outsail-gray-600 mb-1">Session</p>
              <p className="text-outsail-slate font-medium">30-day rolling</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other settings sections (placeholders) */}
      <div className="space-y-3">
        {sections.slice(1).map((section) => {
          const Icon = section.icon
          return (
            <Card
              key={section.label}
              className="cursor-pointer hover:shadow-md transition-shadow"
            >
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-outsail-gray-50 border border-outsail-gray-200 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-outsail-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-outsail-navy">
                      {section.label}
                    </p>
                    <p className="text-xs text-outsail-gray-600">
                      {section.description}
                    </p>
                  </div>
                  <div className="text-xs text-outsail-gray-600 bg-outsail-gray-50 px-2 py-1 rounded-md border border-outsail-gray-200">
                    Coming soon
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
