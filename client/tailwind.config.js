/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand colors - Direct hex values for quick use
        ivory: '#F2F3F1',
        sage: '#8EA58C',
        moss: '#738A6E',
        evergreen: '#344C3D',
        'french-blue': '#88A5BC',

        // Therapeutic palette for healthcare context
        therapeutic: {
          calm: '#E8F0E7',      // Light sage tint
          trust: '#D4E2D3',     // Soft sage
          growth: '#C7D9C6',    // Medium sage
          insight: '#F5F6F4',   // Light ivory
          balance: '#A8C0D8',   // Light french-blue
          safety: '#F8E8E8',    // Soft warning
        },

        // Tailwind design system with CSS variables
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',

        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },

        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },

        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },

        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },

        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },

        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },

        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },

        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',

        // Extended sage palette with CSS variables and fallbacks
        sage: {
          50: 'rgb(var(--color-sage-50, 246 247 246) / <alpha-value>)',
          100: 'rgb(var(--color-sage-100, 227 231 227) / <alpha-value>)',
          200: 'rgb(var(--color-sage-200, 199 210 199) / <alpha-value>)',
          300: 'rgb(var(--color-sage-300, 163 181 163) / <alpha-value>)',
          400: 'rgb(var(--color-sage-400, 127 146 127) / <alpha-value>)',
          500: 'rgb(var(--color-sage-500, 99 117 99) / <alpha-value>)',
          600: 'rgb(var(--color-sage-600, 78 93 78) / <alpha-value>)',
          700: 'rgb(var(--color-sage-700, 64 75 64) / <alpha-value>)',
          800: 'rgb(var(--color-sage-800, 54 63 54) / <alpha-value>)',
          900: 'rgb(var(--color-sage-900, 47 53 47) / <alpha-value>)',
          950: 'rgb(var(--color-sage-950, 25 31 25) / <alpha-value>)',
        },

        // Status colors for session management
        status: {
          scheduled: '#8EA58C',   // sage
          completed: '#738A6E',   // moss
          cancelled: '#9CA3AF',   // gray-400
          pending: '#88A5BC',     // french-blue
          urgent: '#EF4444',      // red-500
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        'xxs': ['0.625rem', { lineHeight: '0.875rem' }],  // 10px
      },

      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },

      boxShadow: {
        'sage-sm': '0 1px 2px 0 rgba(142, 165, 140, 0.05)',
        'sage': '0 1px 3px 0 rgba(142, 165, 140, 0.1), 0 1px 2px 0 rgba(142, 165, 140, 0.06)',
        'sage-md': '0 4px 6px -1px rgba(142, 165, 140, 0.1), 0 2px 4px -1px rgba(142, 165, 140, 0.06)',
        'sage-lg': '0 10px 15px -3px rgba(142, 165, 140, 0.1), 0 4px 6px -2px rgba(142, 165, 140, 0.05)',
        'sage-xl': '0 20px 25px -5px rgba(142, 165, 140, 0.1), 0 10px 10px -5px rgba(142, 165, 140, 0.04)',
        'inner-sage': 'inset 0 2px 4px 0 rgba(142, 165, 140, 0.06)',
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },

      animation: {
        // Existing animations
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',

        // New animations for better UX
        'fade-in': 'fade-in 0.3s ease-in-out',
        'fade-out': 'fade-out 0.3s ease-in-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'slide-in-left': 'slide-in-left 0.3s ease-out',
        'slide-in-up': 'slide-in-up 0.3s ease-out',
        'slide-in-down': 'slide-in-down 0.3s ease-out',
        'scale-in': 'scale-in 0.2s ease-out',
        'spin-slow': 'spin 3s linear infinite',
      },

      keyframes: {
        // Existing keyframes
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(142, 165, 140, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(142, 165, 140, 0.4)' },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },

        // New keyframes
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-left': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        'slide-in-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'slide-in-down': {
          from: { transform: 'translateY(-100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { transform: 'scale(0.9)', opacity: '0' },
          to: { transform: 'scale(1)', opacity: '1' },
        },
      },

      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'sage-gradient': 'linear-gradient(135deg, #8EA58C 0%, #738A6E 100%)',
        'moss-gradient': 'linear-gradient(135deg, #738A6E 0%, #344C3D 100%)',
        'therapy-gradient': 'linear-gradient(135deg, #F2F3F1 0%, #E8F0E7 50%, #D4E2D3 100%)',
      },

      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '120': '30rem',
        '128': '32rem',
        '144': '36rem',
      },

      minHeight: {
        'screen-75': '75vh',
        'screen-50': '50vh',
      },

      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },

      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      transitionDuration: {
        '400': '400ms',
        '600': '600ms',
        '800': '800ms',
        '900': '900ms',
      },

      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0.0, 0.2, 1)',
      },

      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    require("@tailwindcss/typography"),
  ],
}