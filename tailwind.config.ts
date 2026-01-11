import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['Georgia', 'Cambria', 'serif'],
        mono: ['Menlo', 'monospace'],
        'inter': ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        // ============================================
        // INSIGHT ATLAS - COMPLETE COLOR PALETTE
        // ============================================

        // BRAND COLORS (Core Identity)
        sepia: {
          DEFAULT: "#5C4A3D",
          light: "#7A6A5D",
        },
        parchment: {
          DEFAULT: "#F5F3ED",
          dark: "#E8E4DC",
        },
        ink: "#3D3229",

        // PRIMARY PALETTE - GOLD (Premium Accent)
        gold: {
          DEFAULT: "#C9A227",
          light: "#DCBE5E",
          dark: "#A88A1F",
          subtle: "rgba(201, 162, 39, 0.08)",
          muted: "rgba(201, 162, 39, 0.25)",
          glow: "rgba(201, 162, 39, 0.4)",
          tint: "#FBF7E9",
          50: "#FBF7E9",
          100: "#F5EDD0",
          200: "#EBDAA1",
          300: "#DCBE5E",
          400: "#C9A227",
          500: "#A88A1F",
          600: "#8A7019",
          700: "#6B5614",
          800: "#4D3D0F",
          900: "#2E240A",
        },

        // BURGUNDY / OXBLOOD (Authority & CTAs)
        burgundy: {
          DEFAULT: "#6B3A4A",
          light: "#8A5066",
          subtle: "rgba(107, 58, 74, 0.06)",
          muted: "rgba(107, 58, 74, 0.25)",
          50: "#F9F5F6",
          100: "#F0E5E8",
          200: "#E0CAD0",
          300: "#C9A0AD",
          400: "#8A5066",
          500: "#6B3A4A",
          600: "#582534",
          700: "#451D29",
          800: "#32151E",
          900: "#1F0D13",
        },
        oxblood: "#582534",

        // CORAL / TERRACOTTA (Action & Highlights)
        coral: {
          DEFAULT: "#D4735C",
          ember: "#E76F51",
          light: "#E08B73",
          subtle: "rgba(212, 115, 92, 0.08)",
          muted: "rgba(212, 115, 92, 0.25)",
          apply: "#E07A5F",
          50: "#FDF5F3",
          100: "#FAE8E4",
          200: "#F4CFC6",
          300: "#E08B73",
          400: "#D4735C",
          500: "#C45A43",
          600: "#A44736",
          700: "#833829",
          800: "#62291F",
          900: "#411B14",
        },

        // TEAL (Trust & Calm)
        teal: {
          DEFAULT: "#2A9D8F",
          light: "#3BA396",
          subtle: "rgba(42, 157, 143, 0.08)",
          muted: "rgba(42, 157, 143, 0.25)",
          border: "#B8E0D9",
          50: "#F0FAF8",
          100: "#D9F2EE",
          200: "#B8E0D9",
          300: "#7FCDC2",
          400: "#3BA396",
          500: "#2A9D8F",
          600: "#228076",
          700: "#1A635B",
          800: "#134640",
          900: "#0C2925",
        },

        // ORANGE (Warmth)
        orange: {
          DEFAULT: "#E89B5A",
          light: "#F0B07A",
          subtle: "rgba(232, 155, 90, 0.1)",
          50: "#FEF6EE",
          100: "#FCEBD8",
          200: "#F8D4B0",
          300: "#F0B07A",
          400: "#E89B5A",
          500: "#D47F3A",
          600: "#B0652C",
          700: "#8C4E22",
          800: "#683818",
          900: "#44230F",
        },

        // GREEN (Success/Application)
        green: {
          DEFAULT: "#4A9B7F",
          success: "#4CAF50",
          50: "#F0F9F5",
          100: "#D9F0E6",
          200: "#B3E0CC",
          300: "#7FCBA8",
          400: "#4A9B7F",
          500: "#3D8069",
          600: "#306653",
          700: "#244C3E",
          800: "#183329",
          900: "#0C1914",
        },

        // TEXT COLORS
        heading: "#2D2520",
        body: "#3D3229",
        "text-muted": "#5C5248",
        "text-subtle": "#7A7168",
        "text-inverse": "#FDFCFA",

        // BACKGROUND COLORS
        "bg-primary": "#FDFCFA",
        "bg-secondary": "#F5F3ED",
        "bg-card": "#FFFFFF",
        cream: {
          DEFAULT: "#FAF9F7",
          warm: "#FDF8F3",
          pink: "#FFF5F3",
        },

        // BOX-SPECIFIC BACKGROUNDS
        "quick-glance": "#FDF8F3",
        "insight-note": "#FDF8F3",
        "insight-blob": "#FFE4D6",
        "apply-it": "#F5FAFA",
        reflection: "#F0FAF8",
        "key-takeaways": "#FBF7E9",

        // BORDER & RULE COLORS
        rule: {
          DEFAULT: "#D1CDC7",
          light: "#E5E2DD",
        },
        "border-light": "#E8DFD0",
        "border-teal": "#B8E0D9",

        // QUOTE & TABLE COLORS
        "quote-mark": "#E8C5B8",
        "table-header-start": "#D4A84B",
        "table-header-end": "#E8A84B",
        "table-row-alt": "#FDF8F3",

        // SEMANTIC / STATUS COLORS
        success: "#4CAF50",
        warning: "#FF9800",
        error: "#F44336",

        // DARK MODE
        "dark-bg": "#1A1816",

        // Legacy mappings for compatibility
        ivory: "#F5F3ED",
        sage: {
          DEFAULT: "#4A9B7F",
          50: "#F0F9F5",
          100: "#D9F0E6",
          200: "#B3E0CC",
          300: "#7FCBA8",
          400: "#4A9B7F",
          500: "#3D8069",
          600: "#306653",
          700: "#244C3E",
          800: "#183329",
          900: "#0C1914",
        },
        moss: {
          DEFAULT: "#5C5248",
          50: "#F5F3ED",
          100: "#E8E4DC",
          200: "#D1CDC7",
          300: "#A9A39B",
          400: "#7A7168",
          500: "#5C5248",
          600: "#4A423A",
          700: "#3D3229",
          800: "#2D2520",
          900: "#1A1816",
        },
        evergreen: "#3D3229",
        "french-blue": {
          DEFAULT: "#2A9D8F",
          50: "#F0FAF8",
          100: "#D9F2EE",
          200: "#B8E0D9",
          300: "#7FCDC2",
          400: "#3BA396",
          500: "#2A9D8F",
          600: "#228076",
          700: "#1A635B",
          800: "#134640",
          900: "#0C2925",
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
        "gold-shimmer": {
          "0%, 100%": {
            opacity: "1",
          },
          "50%": {
            opacity: "0.7",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "gold-shimmer": "gold-shimmer 2s ease-in-out infinite",
      },
      boxShadow: {
        'gold': '0 4px 14px 0 rgba(201, 162, 39, 0.25)',
        'gold-lg': '0 10px 40px 0 rgba(201, 162, 39, 0.3)',
        'burgundy': '0 4px 14px 0 rgba(107, 58, 74, 0.25)',
        'teal': '0 4px 14px 0 rgba(42, 157, 143, 0.25)',
        'coral': '0 4px 14px 0 rgba(212, 115, 92, 0.25)',
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
