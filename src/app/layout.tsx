import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'OutSail Blueprint',
    template: '%s | OutSail Blueprint',
  },
  description:
    'OutSail Blueprint — AI-powered HR tech discovery and requirements platform',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased bg-outsail-gray-50">
        {children}
      </body>
    </html>
  )
}
