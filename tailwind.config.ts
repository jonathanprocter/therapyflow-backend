import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'serif'],
        mono: ['Menlo', 'monospace'],
        'inter': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // Brand colors
        ivory: "#F2F3F1",
        sage: {
          DEFAULT: "#8EA58C",
          50: "#f7f9f7",
          100: "#e8ede7",
          200: "#d1dbd0",
          300: "#b3c4b1",
          400: "#8EA58C",
          500: "#738A6E",
          600: "#5a6e57",
          700: "#475646",
          800: "#3a453a",
          900: "#344C3D",
        },
        moss: {
          DEFAULT: "#738A6E",
          50: "#f7f9f7",
          100: "#e8ede7",
          200: "#d1dbd0",
          300: "#b3c4b1",
          400: "#8EA58C",
          500: "#738A6E",
          600: "#5a6e57",
          700: "#475646",
          800: "#3a453a",
          900: "#344C3D",
        },
        evergreen: "#344C3D",
        "french-blue": {
          DEFAULT: "#88A5BC",
          50: "#f0f4f7",
          100: "#dde7ee",
          200: "#bdd0dd",
          300: "#88A5BC",
          400: "#6B8BA6",
          500: "#5a7490",
          600: "#4a5f7a",
          700: "#3a4a63",
          800: "#2a354c",
          900: "#1a2135",
        },
        
        // Override yellow completely with sage palette
        yellow: {
          50: "#f7f9f7",
          100: "#e8ede7",
          200: "#d1dbd0",
          300: "#b3c4b1",
          400: "#8EA58C",
          500: "#738A6E",
          600: "#5a6e57",
          700: "#475646",
          800: "#3a453a",
          900: "#344C3D",
        },
        
        // Override amber with sage palette
        amber: {
          50: "#f7f9f7",
          100: "#e8ede7",
          200: "#d1dbd0",
          300: "#b3c4b1",
          400: "#8EA58C",
          500: "#738A6E",
          600: "#5a6e57",
          700: "#475646",
          800: "#3a453a",
          900: "#344C3D",
        },
        // Theme variables mapped to brand colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        chart: {
          "1": "var(--chart-1)",
          "2": "var(--chart-2)",
          "3": "var(--chart-3)",
          "4": "var(--chart-4)",
          "5": "var(--chart-5)",
        },
        sidebar: {
          DEFAULT: "var(--sidebar)",
          foreground: "var(--sidebar-foreground)",
          primary: "var(--sidebar-primary)",
          "primary-foreground": "var(--sidebar-primary-foreground)",
          accent: "var(--sidebar-accent)",
          "accent-foreground": "var(--sidebar-accent-foreground)",
          border: "var(--sidebar-border)",
          ring: "var(--sidebar-ring)",
        },
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
