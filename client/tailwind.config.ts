import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        sage: {
          50: 'rgb(var(--color-sage-50) / <alpha-value>)',
          100: 'rgb(var(--color-sage-100) / <alpha-value>)',
          200: 'rgb(var(--color-sage-200) / <alpha-value>)',
          300: 'rgb(var(--color-sage-300) / <alpha-value>)',
          400: 'rgb(var(--color-sage-400) / <alpha-value>)',
          500: 'rgb(var(--color-sage-500) / <alpha-value>)',
          600: 'rgb(var(--color-sage-600) / <alpha-value>)',
          700: 'rgb(var(--color-sage-700) / <alpha-value>)',
          800: 'rgb(var(--color-sage-800) / <alpha-value>)',
          900: 'rgb(var(--color-sage-900) / <alpha-value>)',
        },
        accent: {
          blue: 'rgb(var(--color-accent-blue) / <alpha-value>)',
          green: 'rgb(var(--color-accent-green) / <alpha-value>)',
          amber: 'rgb(var(--color-accent-amber) / <alpha-value>)',
          rose: 'rgb(var(--color-accent-rose) / <alpha-value>)',
        },
      },
      boxShadow: {
        'sage-sm': '0 1px 2px 0 rgba(139, 159, 135, 0.05)',
        'sage': '0 1px 3px 0 rgba(139, 159, 135, 0.1), 0 1px 2px 0 rgba(139, 159, 135, 0.06)',
        'sage-md': '0 4px 6px -1px rgba(139, 159, 135, 0.1), 0 2px 4px -1px rgba(139, 159, 135, 0.06)',
        'sage-lg': '0 10px 15px -3px rgba(139, 159, 135, 0.1), 0 4px 6px -2px rgba(139, 159, 135, 0.05)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(139, 159, 135, 0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(139, 159, 135, 0.4)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
