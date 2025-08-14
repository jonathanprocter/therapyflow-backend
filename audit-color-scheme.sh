#!/bin/bash

# ============================================
# CareNotes AI - Sage Color Scheme Audit & Fix Script
# ============================================
# This script audits and fixes color scheme implementation issues
# Run with: bash audit-color-scheme.sh

set -e  # Exit on error

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Counters for issues
ISSUES_FOUND=0
ISSUES_FIXED=0

# Backup directory
BACKUP_DIR="color-scheme-backup-$(date +%Y%m%d-%H%M%S)"

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
    ((ISSUES_FOUND++))
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_fix() {
    echo -e "${PURPLE}[FIX]${NC} $1"
    ((ISSUES_FIXED++))
}

create_backup() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi

    if [ -f "$1" ]; then
        cp "$1" "$BACKUP_DIR/$(basename $1).bak"
        log_info "Backed up $1"
    fi
}

# ============================================
# Start Audit
# ============================================

echo "============================================"
echo " CareNotes AI - Color Scheme Audit & Fix"
echo "============================================"
echo ""

# Check if we're in the right directory
if [ ! -d "client" ] || [ ! -d "server" ]; then
    log_error "Not in CareNotes AI root directory. Please run from project root."
    exit 1
fi

log_info "Starting color scheme audit..."
echo ""

# ============================================
# 1. Check Tailwind Config
# ============================================

log_info "Checking Tailwind configuration..."

TAILWIND_CONFIG="tailwind.config.ts"
TAILWIND_NEEDS_FIX=false

if [ ! -f "$TAILWIND_CONFIG" ]; then
    log_error "tailwind.config.ts not found!"
    TAILWIND_NEEDS_FIX=true
else
    # Check if sage colors are defined
    if ! grep -q "sage:" "$TAILWIND_CONFIG"; then
        log_error "Sage colors not defined in tailwind.config.ts"
        TAILWIND_NEEDS_FIX=true
    else
        log_success "Tailwind config has sage colors"
    fi
fi

# Fix Tailwind config if needed
if [ "$TAILWIND_NEEDS_FIX" = true ]; then
    log_fix "Creating/updating tailwind.config.ts with sage colors..."
    create_backup "$TAILWIND_CONFIG"

    cat > "$TAILWIND_CONFIG" << 'EOF'
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './index.html',
    './client/**/*.{js,ts,jsx,tsx}',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sage Color Palette
        sage: {
          50: '#F5F7F5',
          100: '#E8ECE7',
          200: '#BFCFBB',
          300: '#B5C4B1',
          400: '#8B9F87',
          500: '#738A6E',
          600: '#5F6F5C',
          700: '#4A5948',
          800: '#2C3E2C',
          900: '#1E2B21',
        },
        // Semantic Colors
        background: '#FAFAF9',
        surface: '#FFFFFF',
        'text-primary': '#2C3E2C',
        'text-secondary': '#586558',
        'text-disabled': '#9CA59C',
        'accent-blue': '#7A95B0',
        'accent-green': '#7FA074',
        'accent-amber': '#C4A464',
        'accent-rose': '#B08585',
      },
      boxShadow: {
        'sage-xs': '0 1px 2px rgba(44, 62, 44, 0.04)',
        'sage-sm': '0 2px 4px rgba(44, 62, 44, 0.06)',
        'sage-md': '0 4px 8px rgba(44, 62, 44, 0.08)',
        'sage-lg': '0 8px 16px rgba(44, 62, 44, 0.10)',
        'sage-xl': '0 12px 24px rgba(44, 62, 44, 0.12)',
      },
      backgroundImage: {
        'sage-gradient': 'linear-gradient(135deg, #8B9F87 0%, #5F6F5C 100%)',
        'subtle-gradient': 'linear-gradient(180deg, #FAFAF9 0%, rgba(191, 207, 187, 0.05) 100%)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-delayed': 'float 8s ease-in-out infinite 2s',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
EOF
    log_success "Tailwind config updated with sage colors"
fi

echo ""

# ============================================
# 2. Check Global CSS
# ============================================

log_info "Checking global CSS files..."

GLOBALS_CSS="client/src/styles/globals.css"
GLOBALS_NEEDS_FIX=false

if [ ! -f "$GLOBALS_CSS" ]; then
    log_error "globals.css not found at $GLOBALS_CSS"
    GLOBALS_NEEDS_FIX=true
else
    # Check for CSS variables
    if ! grep -q "--color-sage" "$GLOBALS_CSS"; then
        log_error "CSS variables not defined in globals.css"
        GLOBALS_NEEDS_FIX=true
    else
        log_success "Global CSS has sage variables"
    fi
fi

# Fix global CSS if needed
if [ "$GLOBALS_NEEDS_FIX" = true ]; then
    log_fix "Creating/updating globals.css with CSS variables..."
    mkdir -p "client/src/styles"
    create_backup "$GLOBALS_CSS"

    cat > "$GLOBALS_CSS" << 'EOF'
/* Sage Theme CSS Variables */
@layer base {
  :root {
    /* Color Variables in RGB for opacity support */
    --color-background: 250 250 249; /* #FAFAF9 */
    --color-surface: 255 255 255;    /* #FFFFFF */
    --color-sage-light: 181 196 177;  /* #B5C4B1 */
    --color-sage-main: 139 159 135;   /* #8B9F87 */
    --color-sage-dark: 95 111 92;     /* #5F6F5C */
    --color-text-primary: 44 62 44;   /* #2C3E2C */
    --color-text-secondary: 88 101 88; /* #586558 */
    --color-accent-blue: 122 149 176; /* #7A95B0 */
    --color-accent-green: 127 160 116; /* #7FA074 */
    --color-accent-amber: 196 164 100; /* #C4A464 */
    --color-accent-rose: 176 133 133;  /* #B08585 */

    /* Shadow Color */
    --shadow-color: 44 62 44;
    --shadow-xs: 0 1px 2px rgba(var(--shadow-color), 0.04);
    --shadow-sm: 0 2px 4px rgba(var(--shadow-color), 0.06);
    --shadow-md: 0 4px 8px rgba(var(--shadow-color), 0.08);
    --shadow-lg: 0 8px 16px rgba(var(--shadow-color), 0.10);
    --shadow-xl: 0 12px 24px rgba(var(--shadow-color), 0.12);
  }
}

/* Base Styles */
@layer base {
  body {
    background-color: rgb(var(--color-background));
    color: rgb(var(--color-text-primary));
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Scrollbar Styling */
  ::-webkit-scrollbar {
    width: 10px;
    height: 10px;
  }

  ::-webkit-scrollbar-track {
    background: rgb(var(--color-sage-light) / 0.1);
  }

  ::-webkit-scrollbar-thumb {
    background: rgb(var(--color-sage-main));
    border-radius: 5px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgb(var(--color-sage-dark));
  }

  /* Selection Colors */
  ::selection {
    background: rgb(var(--color-sage-light) / 0.3);
    color: rgb(var(--color-text-primary));
  }
}

/* Utility Classes */
@layer utilities {
  .sage-gradient {
    background: linear-gradient(135deg, rgb(var(--color-sage-main)) 0%, rgb(var(--color-sage-dark)) 100%);
  }

  .glass-effect {
    background: rgba(var(--color-surface), 0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
}
EOF
    log_success "Global CSS updated with sage variables"
fi

echo ""

# ============================================
# 3. Check PostCSS Config
# ============================================

log_info "Checking PostCSS configuration..."

POSTCSS_CONFIG="postcss.config.js"
if [ ! -f "$POSTCSS_CONFIG" ]; then
    log_error "postcss.config.js not found!"
    log_fix "Creating postcss.config.js..."

    cat > "$POSTCSS_CONFIG" << 'EOF'
module.exports = {
  plugins: {
    'tailwindcss': {},
    'autoprefixer': {},
  },
};
EOF
    log_success "PostCSS config created"
else
    log_success "PostCSS config exists"
fi

echo ""

# ============================================
# 4. Check Theme File
# ============================================

log_info "Checking theme file..."

THEME_FILE="client/src/lib/sage-theme.ts"
if [ ! -f "$THEME_FILE" ]; then
    log_error "sage-theme.ts not found!"
    log_fix "Creating sage-theme.ts..."

    mkdir -p "client/src/lib"
    cat > "$THEME_FILE" << 'EOF'
// Sage Theme Configuration
export const sageTheme = {
  colors: {
    // Primary Palette
    background: '#FAFAF9',
    surface: '#FFFFFF',
    sage: {
      light: '#B5C4B1',
      main: '#8B9F87',
      dark: '#5F6F5C',
    },
    text: {
      primary: '#2C3E2C',
      secondary: '#586558',
      disabled: '#9CA59C',
    },
    accent: {
      blue: '#7A95B0',
      green: '#7FA074',
      amber: '#C4A464',
      rose: '#B08585',
    },
  },

  shadows: {
    xs: '0 1px 2px rgba(44, 62, 44, 0.04)',
    sm: '0 2px 4px rgba(44, 62, 44, 0.06)',
    md: '0 4px 8px rgba(44, 62, 44, 0.08)',
    lg: '0 8px 16px rgba(44, 62, 44, 0.10)',
    xl: '0 12px 24px rgba(44, 62, 44, 0.12)',
  },

  gradients: {
    primary: 'linear-gradient(135deg, #8B9F87 0%, #5F6F5C 100%)',
    subtle: 'linear-gradient(180deg, #FAFAF9 0%, rgba(191, 207, 187, 0.05) 100%)',
  },
};

export type SageTheme = typeof sageTheme;
EOF
    log_success "Theme file created"
else
    log_success "Theme file exists"
fi

echo ""

# ============================================
# 5. Check Tailwind CSS Import
# ============================================

log_info "Checking Tailwind CSS imports..."

TAILWIND_CSS="client/src/styles/tailwind.css"
if [ ! -f "$TAILWIND_CSS" ]; then
    log_error "tailwind.css not found!"
    log_fix "Creating tailwind.css..."

    mkdir -p "client/src/styles"
    cat > "$TAILWIND_CSS" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF
    log_success "Tailwind CSS file created"
else
    log_success "Tailwind CSS file exists"
fi

echo ""

# ============================================
# 6. Check Package Dependencies
# ============================================

log_info "Checking package.json dependencies..."

PACKAGE_JSON="package.json"
MISSING_DEPS=()

# Check for required dependencies
deps=("tailwindcss" "postcss" "autoprefixer" "framer-motion")
for dep in "${deps[@]}"; do
    if ! grep -q "\"$dep\"" "$PACKAGE_JSON"; then
        MISSING_DEPS+=("$dep")
        log_error "Missing dependency: $dep"
    fi
done

if [ ${#MISSING_DEPS[@]} -gt 0 ]; then
    log_fix "Installing missing dependencies..."
    npm install --save-dev tailwindcss postcss autoprefixer
    npm install framer-motion
    log_success "Dependencies installed"
else
    log_success "All required dependencies present"
fi

echo ""

# ============================================
# 7. Check Import Order in Main File
# ============================================

log_info "Checking import order in main.tsx..."

MAIN_FILE="client/src/main.tsx"
if [ -f "$MAIN_FILE" ]; then
    # Check if globals.css is imported before App
    if ! grep -q "import.*globals.css" "$MAIN_FILE"; then
        log_warning "globals.css not imported in main.tsx"
        log_info "Add this import at the top of main.tsx:"
        echo "  import './styles/globals.css';"
        echo "  import './styles/tailwind.css';"
    else
        log_success "CSS imports found in main.tsx"
    fi
else
    log_warning "main.tsx not found - check your entry point"
fi

echo ""

# ============================================
# 8. Create Test Component
# ============================================

log_info "Creating color test component..."

TEST_COMPONENT="client/src/components/ColorTest.tsx"
mkdir -p "client/src/components"

cat > "$TEST_COMPONENT" << 'EOF'
import React from 'react';
import { sageTheme } from '../lib/sage-theme';

const ColorTest: React.FC = () => {
  return (
    <div className="p-8 space-y-4">
      <h2 className="text-2xl font-bold mb-4">Color Scheme Test</h2>

      {/* Test Tailwind Classes */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-sage-100 text-sage-900 p-4 rounded-lg shadow-sage-md">
          <div className="font-bold">Tailwind Test</div>
          <div className="text-sm">bg-sage-100</div>
        </div>

        <div className="bg-sage-400 text-white p-4 rounded-lg shadow-sage-md">
          <div className="font-bold">Sage Main</div>
          <div className="text-sm">bg-sage-400</div>
        </div>

        <div className="bg-accent-blue text-white p-4 rounded-lg shadow-sage-md">
          <div className="font-bold">Accent Blue</div>
          <div className="text-sm">bg-accent-blue</div>
        </div>
      </div>

      {/* Test CSS Variables */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: 'rgb(var(--color-sage-main) / 0.1)',
          border: '2px solid rgb(var(--color-sage-main))',
          color: 'rgb(var(--color-text-primary))',
        }}
      >
        <div className="font-bold">CSS Variables Test</div>
        <div className="text-sm">Using --color-sage-main</div>
      </div>

      {/* Test Theme Object */}
      <div 
        className="p-4 rounded-lg"
        style={{ 
          background: sageTheme.colors.sage.light,
          color: sageTheme.colors.text.primary,
          boxShadow: sageTheme.shadows.lg,
        }}
      >
        <div className="font-bold">Theme Object Test</div>
        <div className="text-sm">Using sageTheme.colors</div>
      </div>

      {/* Gradient Test */}
      <div className="sage-gradient text-white p-4 rounded-lg">
        <div className="font-bold">Gradient Test</div>
        <div className="text-sm">Using sage-gradient utility</div>
      </div>
    </div>
  );
};

export default ColorTest;
EOF

log_success "Color test component created at $TEST_COMPONENT"

echo ""

# ============================================
# Summary
# ============================================

echo "============================================"
echo " Audit Complete"
echo "============================================"
echo ""
echo -e "${RED}Issues Found: $ISSUES_FOUND${NC}"
echo -e "${GREEN}Issues Fixed: $ISSUES_FIXED${NC}"
echo ""

if [ $ISSUES_FIXED -gt 0 ]; then
    echo -e "${YELLOW}Backups saved to: $BACKUP_DIR${NC}"
    echo ""
fi

# ============================================
# Next Steps
# ============================================

echo "Next Steps:"
echo "1. Run 'npm run dev' to test the changes"
echo "2. Import ColorTest component to verify colors:"
echo "   import ColorTest from './components/ColorTest';"
echo "3. Check main.tsx has these imports at the top:"
echo "   import './styles/globals.css';"
echo "   import './styles/tailwind.css';"
echo "4. Clear browser cache if colors don't appear"
echo ""

# ============================================
# Optional: Auto-fix import order
# ============================================

read -p "Would you like to auto-fix import order in main.tsx? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "$MAIN_FILE" ]; then
        create_backup "$MAIN_FILE"

        # Add imports if not present
        if ! grep -q "import.*globals.css" "$MAIN_FILE"; then
            # Add imports after React import
            sed -i "/import React/a import './styles/globals.css';\nimport './styles/tailwind.css';" "$MAIN_FILE"
            log_success "Added CSS imports to main.tsx"
        fi
    fi
fi

echo ""
echo -e "${GREEN}✨ Color scheme audit and fixes complete!${NC}"
echo ""

# ============================================
# Optional: Run Build Test
# ============================================

read -p "Would you like to run a build test now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Running build test..."
    npm run build
    if [ $? -eq 0 ]; then
        log_success "Build successful! Color scheme should be working."
    else
        log_error "Build failed. Check error messages above."
    fi
fi

exit 0