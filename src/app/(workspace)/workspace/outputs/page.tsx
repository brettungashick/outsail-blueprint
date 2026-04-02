import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { db } from '@/lib/db'
import { projects, projectMembers, generatedOutputs } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { Download, FileText, Map, MessageSquare, Calendar, BarChart2, BookOpen, CheckCircle2, Lock } from 'lucide-react'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Outputs',
}

type OutputType =
  | 'project_summary'
  | 'tech_stack_viz'
  | 'discovery_summary'
  | 'meeting_agenda'
  | 'scorecard_settings'
  | 'implementation_blueprint'

const OUTPUT_META: Record<OutputType, { label: string; description: string; icon: React.FC<{ className?: string }> }> = {
  project_summary: {
    label: 'Project Summary',
    description: 'Executive overview of your HR technology project.',
    icon: FileText,
  },
  tech_stack_viz: {
    label: 'Tech Stack Visualization',
    description: 'Visual map of your current systems and integrations.',
    icon: Map,
  },
  discovery_summary: {
    label: 'Discovery Summary',
    description: 'Detailed requirements document for vendor evaluation.',
    icon: MessageSquare,
  },
  meeting_agenda: {
    label: 'Meeting Agenda',
    description: 'Time-boxed vendor demo agenda with targeted questions.',
    icon: Calendar,
  },
  scorecard_settings: {
    label: 'Scorecard Settings',
    description: 'Evaluation criteria and weighted scoring guide.',
    icon: BarChart2,
  },
  implementation_blueprint: {
    label: 'Implementation Blueprint',
    description: 'Comprehensive implementation plan and requirements.',
    icon: BookOpen,
  },
}

const FORMAT_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'Word',
  json: 'JSON',
}

export default async function WorkspaceOutputsPage() {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) redirect('/login')

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) redirect('/login')

  // Get project
  const memberships = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(eq(projectMembers.user_id, session.userId))
    .all()

  const projectIds = memberships.map(m => m.project_id)
  if (projectIds.length === 0) redirect('/workspace')

  const rows = await db
    .select()
    .from(projects)
    .orderBy(desc(projects.updated_at))
    .all()

  const project = rows.find(r => projectIds.includes(r.id)) ?? null
  if (!project) redirect('/workspace')

  // Only accessible when approved or outputs
  const isAccessible = ['approved', 'outputs'].includes(project.status)

  // Load ready outputs
  const outputs = isAccessible
    ? await db
        .select()
        .from(generatedOutputs)
        .where(eq(generatedOutputs.project_id, project.id))
        .all()
    : []

  const readyOutputs = outputs.filter(o => o.status === 'ready')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-header-lg text-outsail-navy">Outputs</h1>
        <p className="text-sm text-outsail-gray-600 mt-1">
          Download your project deliverables and evaluation materials.
        </p>
      </div>

      {!isAccessible ? (
        <div className="outsail-card text-center py-12">
          <div className="w-12 h-12 rounded-full bg-outsail-gray-50 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-outsail-gray-600" />
          </div>
          <h3 className="font-semibold text-outsail-navy mb-1">Outputs Not Yet Available</h3>
          <p className="text-sm text-outsail-gray-600 max-w-sm mx-auto">
            Outputs will be available once your Blueprint has been fully reviewed and approved.
          </p>
        </div>
      ) : readyOutputs.length === 0 ? (
        <div className="outsail-card text-center py-12">
          <div className="w-12 h-12 rounded-full bg-outsail-gray-50 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-outsail-gray-600" />
          </div>
          <h3 className="font-semibold text-outsail-navy mb-1">No Outputs Yet</h3>
          <p className="text-sm text-outsail-gray-600 max-w-sm mx-auto">
            Your advisor is preparing your outputs. You&apos;ll be notified when they&apos;re ready.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {readyOutputs.map(output => {
            const meta = OUTPUT_META[output.output_type as OutputType]
            if (!meta) return null
            const Icon = meta.icon

            // Determine available formats
            const formats: string[] = []
            if (output.output_type === 'scorecard_settings') {
              formats.push('json')
            } else if (output.output_type === 'tech_stack_viz') {
              formats.push('pdf')
            } else {
              formats.push('pdf', 'docx')
            }

            return (
              <div key={output.id} className="outsail-card">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-outsail-teal-light flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-outsail-teal" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-outsail-navy text-sm">{meta.label}</h3>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Ready · v{output.version}
                      </span>
                    </div>
                    <p className="text-xs text-outsail-gray-600 mt-0.5">{meta.description}</p>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {formats.map(fmt => (
                      <a
                        key={fmt}
                        href={`/api/projects/${project.id}/outputs/export?output_id=${output.id}&format=${fmt}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-outsail-teal/30 bg-outsail-teal-light rounded-lg text-outsail-teal hover:bg-outsail-teal hover:text-white transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        {FORMAT_LABELS[fmt] ?? fmt.toUpperCase()}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
