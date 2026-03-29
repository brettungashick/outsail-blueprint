import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { NewProjectForm } from '@/components/dashboard/new-project-form'

export const metadata = {
  title: 'New Project',
}

export default async function NewProjectPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-outsail-gray-600">
        <Link href="/dashboard" className="hover:text-outsail-navy transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <Link
          href="/dashboard/projects"
          className="hover:text-outsail-navy transition-colors"
        >
          Projects
        </Link>
        <ChevronRight className="w-4 h-4 text-outsail-gray-200" />
        <span className="text-outsail-navy font-medium">New Project</span>
      </nav>

      {/* Page header */}
      <div>
        <h1 className="text-header-lg text-outsail-navy">Create New Project</h1>
        <p className="text-body text-outsail-gray-600 mt-1">
          Set up a Blueprint discovery project and invite your client.
        </p>
      </div>

      {/* Form */}
      <NewProjectForm />
    </div>
  )
}
