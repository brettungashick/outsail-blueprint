import { Resend } from 'resend'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

// Build the email element using React.createElement so this file doesn't need JSX
function createNotificationEmail(params: {
  heading: string
  body: string
  ctaText: string
  ctaUrl: string
}): React.ReactElement {
  const { heading, body: bodyText, ctaText, ctaUrl } = params

  return React.createElement(
    Html,
    null,
    React.createElement(Head, null),
    React.createElement(Preview, null, heading),
    React.createElement(
      Body,
      { style: main },
      React.createElement(
        Container,
        { style: container },
        React.createElement(
          Section,
          { style: logoSection },
          React.createElement(Text, { style: logoText }, 'OutSail Blueprint')
        ),
        React.createElement(
          Section,
          { style: contentSection },
          React.createElement(Heading, { style: headingStyle }, heading),
          React.createElement(Text, { style: paragraph }, bodyText),
          React.createElement(
            Section,
            { style: buttonContainer },
            React.createElement(Button, { href: ctaUrl, style: button }, ctaText)
          ),
          React.createElement(Hr, { style: hr }),
          React.createElement(
            Text,
            { style: footer },
            `© ${new Date().getFullYear()} OutSail. All rights reserved.`
          )
        )
      )
    )
  )
}

export async function sendNotification({
  to,
  subject,
  heading,
  body,
  ctaText,
  ctaUrl,
}: {
  to: string
  subject: string
  heading: string
  body: string
  ctaText: string
  ctaUrl: string
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'OutSail Blueprint <noreply@hrisblueprint.com>',
    to,
    subject,
    react: createNotificationEmail({ heading, body, ctaText, ctaUrl }),
  })
}

// ── Styles ───────────────────────────────────────────────────────────────────

const main: React.CSSProperties = {
  backgroundColor: '#F8F7F4',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif',
}

const container: React.CSSProperties = {
  margin: '0 auto',
  padding: '24px',
  maxWidth: '560px',
}

const logoSection: React.CSSProperties = {
  padding: '24px 0 16px',
  textAlign: 'center',
}

const logoText: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '700',
  color: '#1D9E75',
  margin: '0',
  letterSpacing: '-0.5px',
}

const contentSection: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  padding: '40px',
  border: '1px solid #D3D1C7',
}

const headingStyle: React.CSSProperties = {
  fontSize: '22px',
  fontWeight: '600',
  color: '#1B3A5C',
  margin: '0 0 16px',
  lineHeight: '1.3',
}

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#3D3D3A',
  margin: '0 0 20px',
}

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '24px 0',
}

const button: React.CSSProperties = {
  backgroundColor: '#1D9E75',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600',
  padding: '12px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr: React.CSSProperties = {
  borderColor: '#D3D1C7',
  margin: '24px 0',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#6B6B65',
  margin: '0',
  textAlign: 'center',
}
