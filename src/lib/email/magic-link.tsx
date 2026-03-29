import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'

interface MagicLinkEmailProps {
  magicLinkUrl: string
  userEmail: string
}

export function MagicLinkEmail({ magicLinkUrl, userEmail }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your OutSail Blueprint sign-in link</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Logo / Brand */}
          <Section style={logoSection}>
            <Text style={logoText}>OutSail Blueprint</Text>
          </Section>

          {/* Main content */}
          <Section style={contentSection}>
            <Heading style={heading}>Sign in to OutSail Blueprint</Heading>
            <Text style={paragraph}>
              Click the button below to sign in to your account. This link is
              valid for <strong>15 minutes</strong> and can only be used once.
            </Text>

            <Section style={buttonContainer}>
              <Button href={magicLinkUrl} style={button}>
                Sign In to OutSail Blueprint
              </Button>
            </Section>

            <Text style={paragraph}>
              If the button doesn&apos;t work, copy and paste this URL into your
              browser:
            </Text>
            <Text style={linkText}>{magicLinkUrl}</Text>

            <Hr style={hr} />

            <Text style={footer}>
              This link was requested for <strong>{userEmail}</strong>. If you
              didn&apos;t request this, you can safely ignore this email.
            </Text>

            <Text style={footer}>
              &copy; {new Date().getFullYear()} OutSail. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default MagicLinkEmail

// ----------------------------------------------------------------
// Styles
// ----------------------------------------------------------------
const main: React.CSSProperties = {
  backgroundColor: '#F8F7F4',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Roboto, Helvetica, Arial, sans-serif',
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

const heading: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '600',
  color: '#1B3A5C',
  margin: '0 0 16px',
  lineHeight: '1.3',
}

const paragraph: React.CSSProperties = {
  fontSize: '14px',
  lineHeight: '1.6',
  color: '#3D3D3A',
  margin: '0 0 16px',
}

const buttonContainer: React.CSSProperties = {
  textAlign: 'center',
  margin: '28px 0',
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

const linkText: React.CSSProperties = {
  fontSize: '12px',
  color: '#1D9E75',
  wordBreak: 'break-all',
  margin: '0 0 24px',
}

const hr: React.CSSProperties = {
  borderColor: '#D3D1C7',
  margin: '24px 0',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  lineHeight: '1.5',
  color: '#6B6B65',
  margin: '0 0 8px',
}
