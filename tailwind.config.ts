import type { Config } from 'tailwindcss'
import { fontFamily } from 'tailwindcss/defaultTheme'

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // OutSail brand colors
        'outsail-teal': '#1D9E75',
        'outsail-teal-dark': '#0F6E56',
        'outsail-teal-light': '#E1F5EE',
        'outsail-navy': '#1B3A5C',
        'outsail-coral': '#D85A30',
        'outsail-amber': '#E5A000',
        'outsail-purple': '#5B4FC7',
        'outsail-blue': '#3B6FC2',
        'outsail-red': '#D93025',
        'outsail-green': '#1D8348',
        'outsail-slate': '#3D3D3A',
        'outsail-gray-600': '#6B6B65',
        'outsail-gray-200': '#D3D1C7',
        'outsail-gray-50': '#F8F7F4',

        // shadcn/ui color tokens
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', ...fontFamily.sans],
      },
      fontSize: {
        body: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        label: ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'header-sm': ['18px', { lineHeight: '1.3', fontWeight: '600' }],
        'header-md': ['20px', { lineHeight: '1.3', fontWeight: '600' }],
        'header-lg': ['24px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        card: '12px',
        'card-lg': '16px',
      },
      spacing: {
        'card-padding': '24px',
        'sidebar-collapsed': '80px',
        'sidebar-expanded': '240px',
      },
      maxWidth: {
        content: '1200px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in-left': 'slide-in-left 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
