import { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { generatedOutputs, projectMembers, projects } from '@/lib/db/schema'
import { verifySessionToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)
  if (!sessionCookie?.value) return new Response('Unauthorized', { status: 401 })

  const session = await verifySessionToken(sessionCookie.value)
  if (!session) return new Response('Unauthorized', { status: 401 })

  const { id: projectId } = params
  const { searchParams } = new URL(req.url)
  const outputId = searchParams.get('output_id')
  const format = searchParams.get('format') as 'pdf' | 'docx' | 'json' | null

  if (!outputId || !format) {
    return new Response('Missing output_id or format', { status: 400 })
  }

  // Verify access
  const membership = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .get()

  if (!membership && session.role !== 'advisor' && session.role !== 'admin') {
    return new Response('Forbidden', { status: 403 })
  }

  const output = await db
    .select()
    .from(generatedOutputs)
    .where(eq(generatedOutputs.id, outputId))
    .get()

  if (!output || output.project_id !== projectId) {
    return new Response('Not found', { status: 404 })
  }

  const project = await db
    .select({ client_company_name: projects.client_company_name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get()

  const companyName = project?.client_company_name ?? 'Company'
  const content = output.content ?? ''

  const outputTypeLabels: Record<string, string> = {
    project_summary: 'Project Summary',
    tech_stack_viz: 'Tech Stack Visualization',
    discovery_summary: 'Discovery Summary',
    meeting_agenda: 'Meeting Agenda',
    scorecard_settings: 'Scorecard Settings',
    implementation_blueprint: 'Implementation Blueprint',
  }
  const label = outputTypeLabels[output.output_type ?? ''] ?? 'Output'
  const filename = `${companyName.replace(/\s+/g, '_')}_${(output.output_type ?? 'output').replace(/_/g, '-')}`

  if (format === 'json') {
    const bytes = Buffer.from(content, 'utf-8')
    return new Response(bytes, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      },
    })
  }

  if (format === 'docx') {
    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')

    const lines = content.split('\n')
    const docChildren: InstanceType<typeof Paragraph>[] = []

    for (const line of lines) {
      if (line.startsWith('# ')) {
        docChildren.push(new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.HEADING_1,
        }))
      } else if (line.startsWith('## ')) {
        docChildren.push(new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
        }))
      } else if (line.startsWith('### ')) {
        docChildren.push(new Paragraph({
          text: line.slice(4),
          heading: HeadingLevel.HEADING_3,
        }))
      } else if (line.startsWith('#### ')) {
        docChildren.push(new Paragraph({
          text: line.slice(5),
          heading: HeadingLevel.HEADING_4,
        }))
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        docChildren.push(new Paragraph({
          text: line.slice(2),
          bullet: { level: 0 },
        }))
      } else if (line.match(/^\d+\. /)) {
        docChildren.push(new Paragraph({
          text: line.replace(/^\d+\. /, ''),
          numbering: { reference: 'default-numbering', level: 0 },
        }))
      } else if (line.startsWith('**') && line.endsWith('**')) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: line.slice(2, -2), bold: true })],
        }))
      } else if (line.trim() === '' || line.startsWith('---')) {
        docChildren.push(new Paragraph({ text: '' }))
      } else if (line.startsWith('|')) {
        // Table row — render as plain text for simplicity
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: line, font: 'Courier New', size: 18 })],
        }))
      } else {
        // Parse inline bold/italic
        const parts: InstanceType<typeof TextRun>[] = []
        let remaining = line
        const boldRegex = /\*\*(.+?)\*\*/g
        let lastIndex = 0
        let match

        while ((match = boldRegex.exec(remaining)) !== null) {
          if (match.index > lastIndex) {
            parts.push(new TextRun({ text: remaining.slice(lastIndex, match.index) }))
          }
          parts.push(new TextRun({ text: match[1], bold: true }))
          lastIndex = match.index + match[0].length
        }

        if (lastIndex < remaining.length) {
          parts.push(new TextRun({ text: remaining.slice(lastIndex) }))
        }

        if (parts.length > 0) {
          docChildren.push(new Paragraph({ children: parts }))
        } else {
          docChildren.push(new Paragraph({ text: line }))
        }
      }
    }

    const doc = new Document({
      title: `${companyName} - ${label}`,
      description: `Generated by OutSail Blueprint`,
      styles: {
        default: {
          document: {
            run: { font: 'Calibri', size: 22 },
          },
        },
      },
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: `${companyName}`,
              heading: HeadingLevel.TITLE,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: label,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
              alignment: AlignmentType.CENTER,
              spacing: { after: 800 },
            }),
            ...docChildren,
          ],
        },
      ],
    })

    const buffer = await Packer.toBuffer(doc)

    return new Response(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}.docx"`,
      },
    })
  }

  if (format === 'pdf') {
    const PDFDocument = (await import('pdfkit')).default

    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 72, size: 'LETTER' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(24).font('Helvetica-Bold').text(companyName, { align: 'center' })
      doc.fontSize(16).font('Helvetica').text(label, { align: 'center' })
      doc.fontSize(10).fillColor('#666666').text(
        `Generated ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        { align: 'center' }
      )
      doc.fillColor('#000000')
      doc.moveDown(2)

      // Content
      const lines = content.split('\n')
      for (const line of lines) {
        if (line.startsWith('# ')) {
          doc.addPage()
          doc.fontSize(20).font('Helvetica-Bold').fillColor('#1B3A5C').text(line.slice(2))
          doc.fillColor('#000000')
          doc.moveDown(0.5)
        } else if (line.startsWith('## ')) {
          doc.moveDown(0.5)
          doc.fontSize(15).font('Helvetica-Bold').fillColor('#1D9E75').text(line.slice(3))
          doc.fillColor('#000000')
          doc.moveDown(0.3)
        } else if (line.startsWith('### ')) {
          doc.moveDown(0.3)
          doc.fontSize(12).font('Helvetica-Bold').fillColor('#1B3A5C').text(line.slice(4))
          doc.fillColor('#000000')
          doc.moveDown(0.2)
        } else if (line.startsWith('#### ')) {
          doc.fontSize(11).font('Helvetica-Bold').text(line.slice(5))
          doc.moveDown(0.2)
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          doc.fontSize(10).font('Helvetica').text(`  • ${line.slice(2)}`, {
            continued: false,
            indent: 10,
          })
        } else if (line.trim() === '' || line === '---') {
          doc.moveDown(0.5)
        } else if (line.startsWith('|')) {
          doc.fontSize(9).font('Courier').text(line)
        } else {
          // Strip markdown bold/italic for PDF
          const clean = line
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
          doc.fontSize(10).font('Helvetica').text(clean)
        }
      }

      // Footer
      const range = doc.bufferedPageRange()
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i)
        doc.fontSize(8).fillColor('#999999').text(
          `${companyName} — ${label} — Page ${i + 1} of ${range.count}`,
          72, doc.page.height - 40,
          { align: 'center', width: doc.page.width - 144 }
        )
      }

      doc.end()
    })

    return new Response(pdfBuffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}.pdf"`,
      },
    })
  }

  return new Response('Unsupported format', { status: 400 })
}
