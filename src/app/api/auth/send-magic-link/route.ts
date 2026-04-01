import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createMagicToken } from '@/lib/auth'
import { MagicLinkEmail } from '@/lib/email/magic-link'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body as { email?: string }

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email address' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Create magic link JWT
    const token = await createMagicToken(normalizedEmail)

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const magicLinkUrl = `${appUrl}/api/auth/verify?token=${encodeURIComponent(token)}`

    // Send email via Resend
    const { error } = await resend.emails.send({
      from: 'OutSail Blueprint <noreply@hrisblueprint.com>',
      to: normalizedEmail,
      subject: 'Sign in to OutSail Blueprint',
      react: MagicLinkEmail({ magicLinkUrl, userEmail: normalizedEmail }),
    })

    if (error) {
      console.error('[send-magic-link] Resend error:', error)
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error('[send-magic-link] Unexpected error:', err)
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
