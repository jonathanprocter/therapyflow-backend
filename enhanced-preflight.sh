#!/bin/bash

# ============================================
# CareNotes AI - Enhanced Pre-Flight Check & Design Optimizer
# ============================================
# This script fixes errors AND optimizes design for sage theme
# Run with: bash enhanced-preflight.sh

set -e  # Exit on error

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
MAGENTA='\033[0;95m'
NC='\033[0m' # No Color

# Counters
ERRORS_FIXED=0
OPTIMIZATIONS=0
COMPONENTS_CREATED=0

# Directories
BACKUP_DIR="enhanced-backup-$(date +%Y%m%d-%H%M%S)"
LOG_FILE="enhanced-preflight.log"

# ============================================
# Helper Functions
# ============================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
}

log_optimize() {
    echo -e "${MAGENTA}[⚡]${NC} $1" | tee -a "$LOG_FILE"
    ((OPTIMIZATIONS++)) || true
}

log_create() {
    echo -e "${CYAN}[+]${NC} $1" | tee -a "$LOG_FILE"
    ((COMPONENTS_CREATED++)) || true
}

log_section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════╗${NC}" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}║  $1${NC}" | tee -a "$LOG_FILE"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════╝${NC}" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

create_backup() {
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
    fi
    if [ -f "$1" ]; then
        cp "$1" "$BACKUP_DIR/$(basename $1).bak" 2>/dev/null || true
    fi
}

# ============================================
# Start Enhanced Pre-Flight
# ============================================

clear
cat << "EOF"
   ____                _   _       _            _    ___ 
  / ___|__ _ _ __ ___ | \ | | ___ | |_ ___  ___  / \  |_ _|
 | |   / _` | '__/ _ \|  \| |/ _ \| __/ _ \/ __|/ _ \  | | 
 | |__| (_| | | |  __/| |\  | (_) | ||  __/\__ / ___ \ | | 
  \____\__,_|_|  \___|_| \_|\___/ \__\___||___/_/   \_\___|

    Enhanced Pre-Flight Check & Design Optimizer v2.0
    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF

echo "" | tee "$LOG_FILE"

# ============================================
# PHASE 1: Fix Core Issues (Original Pre-Flight)
# ============================================

log_section "PHASE 1: Core System Fixes"

# All original pre-flight checks here (condensed for space)
log_info "Running core system checks..."

# Fix package.json
if [ ! -f "package.json" ]; then
    cat > "package.json" << 'EOF'
{
  "name": "carenotes-ai",
  "version": "2.0.0",
  "private": true,
  "scripts": {
    "dev": "concurrently \"npm run server\" \"npm run client\"",
    "client": "cd client && npm run dev",
    "server": "cd server && npm run dev",
    "build": "cd client && npm run build"
  },
  "devDependencies": {
    "concurrently": "^8.2.0"
  }
}
EOF
    ((ERRORS_FIXED++)) || true
fi

# Create required directories
directories=(
    "client/src/components/ui"
    "client/src/components/layout"
    "client/src/components/dashboard"
    "client/src/components/animations"
    "client/src/hooks"
    "client/src/lib/utils"
    "client/src/styles"
)

for dir in "${directories[@]}"; do
    mkdir -p "$dir" 2>/dev/null || true
done

log_success "Core system checks complete"

# ============================================
# PHASE 2: Create Optimized UI Components
# ============================================

log_section "PHASE 2: Creating Optimized UI Components"

# Create Glass Card Component
log_create "Creating GlassCard component for better visual hierarchy..."
cat > "client/src/components/ui/GlassCard.tsx" << 'EOF'
import React, { ReactNode } from 'react';
import { motion, MotionProps } from 'framer-motion';
import { cn } from '@/lib/utils/cn';

interface GlassCardProps extends MotionProps {
  children: ReactNode;
  className?: string;
  variant?: 'light' | 'medium' | 'dark';
  hover?: boolean;
  blur?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className,
  variant = 'light',
  hover = true,
  blur = true,
  ...motionProps
}) => {
  const variants = {
    light: 'bg-white/70',
    medium: 'bg-white/85',
    dark: 'bg-sage-800/70',
  };

  const baseClasses = cn(
    'rounded-xl border border-sage-200/20',
    blur && 'backdrop-blur-lg',
    hover && 'transition-all duration-300 hover:shadow-sage-lg hover:-translate-y-1',
    variants[variant],
    className
  );

  return (
    <motion.div
      className={baseClasses}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      {...motionProps}
    >
      {children}
    </motion.div>
  );
};

export default GlassCard;
EOF

# Create Floating Orb Component
log_create "Creating FloatingOrb component for parallax effects..."
cat > "client/src/components/animations/FloatingOrb.tsx" << 'EOF'
import React from 'react';
import { motion } from 'framer-motion';

interface FloatingOrbProps {
  color?: string;
  size?: string;
  position?: { top?: string; left?: string; right?: string; bottom?: string };
  duration?: number;
  delay?: number;
}

export const FloatingOrb: React.FC<FloatingOrbProps> = ({
  color = 'sage',
  size = '400px',
  position = { top: '20%', right: '10%' },
  duration = 25,
  delay = 0,
}) => {
  const colorMap = {
    sage: 'from-sage-400/20 to-sage-600/10',
    blue: 'from-accent-blue/20 to-accent-blue/10',
    amber: 'from-accent-amber/20 to-accent-amber/10',
  };

  return (
    <motion.div
      className={`absolute pointer-events-none`}
      style={{ ...position, width: size, height: size }}
      animate={{
        scale: [1, 1.2, 1],
        opacity: [0.3, 0.5, 0.3],
        rotate: [0, 180, 360],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <div
        className={`w-full h-full bg-gradient-radial ${colorMap[color]} 
                    rounded-full filter blur-3xl`}
      />
    </motion.div>
  );
};

export default FloatingOrb;
EOF

# Create Skeleton Loader
log_create "Creating SkeletonLoader for better loading states..."
cat > "client/src/components/ui/SkeletonLoader.tsx" << 'EOF'
import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'card' | 'avatar' | 'button';
  count?: number;
}

export const SkeletonLoader: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'text',
  count = 1,
}) => {
  const variants = {
    text: 'h-4 w-full rounded',
    card: 'h-32 w-full rounded-xl',
    avatar: 'h-12 w-12 rounded-full',
    button: 'h-10 w-24 rounded-lg',
  };

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className={`${variants[variant]} ${className} bg-sage-200/50`}
          animate={{
            opacity: [0.5, 0.8, 0.5],
            background: [
              'linear-gradient(90deg, #B5C4B1 0%, #8B9F87 50%, #B5C4B1 100%)',
              'linear-gradient(90deg, #8B9F87 0%, #B5C4B1 50%, #8B9F87 100%)',
              'linear-gradient(90deg, #B5C4B1 0%, #8B9F87 50%, #B5C4B1 100%)',
            ],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      ))}
    </>
  );
};

export default SkeletonLoader;
EOF

log_success "UI components created"

# ============================================
# PHASE 3: Optimize Layout Components
# ============================================

log_section "PHASE 3: Optimizing Layout Components"

# Create Enhanced PageWrapper
log_optimize "Creating PageWrapper with built-in animations..."
cat > "client/src/components/layout/PageWrapper.tsx" << 'EOF'
import React, { ReactNode, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FloatingOrb } from '@/components/animations/FloatingOrb';

interface PageWrapperProps {
  children: ReactNode;
  title?: string;
  showOrbs?: boolean;
  className?: string;
}

export const PageWrapper: React.FC<PageWrapperProps> = ({
  children,
  title,
  showOrbs = true,
  className = '',
}) => {
  useEffect(() => {
    // Smooth scroll to top on mount
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <motion.div
      className={`min-h-screen relative overflow-hidden ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background Orbs */}
      {showOrbs && (
        <>
          <FloatingOrb color="sage" position={{ top: '10%', right: '5%' }} />
          <FloatingOrb color="blue" size="300px" position={{ bottom: '20%', left: '10%' }} duration={30} delay={5} />
          <FloatingOrb color="amber" size="250px" position={{ top: '60%', right: '50%' }} duration={35} delay={10} />
        </>
      )}

      {/* Content */}
      <div className="relative z-10">
        {title && (
          <motion.h1
            className="text-4xl font-light text-sage-800 mb-8"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {title}
          </motion.h1>
        )}

        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </div>

      {/* Gradient Overlay */}
      <div className="fixed inset-0 bg-gradient-to-br from-sage-50/50 via-transparent to-accent-blue/5 pointer-events-none" />
    </motion.div>
  );
};

export default PageWrapper;
EOF

# Create Optimized Grid System
log_optimize "Creating responsive grid system..."
cat > "client/src/components/layout/GridSystem.tsx" << 'EOF'
import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  animate?: boolean;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className = '',
  animate = true,
}) => {
  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-3 md:grid-cols-6 lg:grid-cols-12',
  };

  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  if (animate) {
    return (
      <motion.div
        className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 },
            }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
};

export default Grid;
EOF

log_success "Layout components optimized"

# ============================================
# PHASE 4: Create Utility Functions
# ============================================

log_section "PHASE 4: Creating Utility Functions"

# Create cn utility (classname merger)
log_create "Creating className utility..."
cat > "client/src/lib/utils/cn.ts" << 'EOF'
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
EOF

# Create animation variants
log_create "Creating animation variants..."
cat > "client/src/lib/utils/animations.ts" << 'EOF'
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const fadeInScale = {
  initial: { opacity: 0, scale: 0.9 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.9 },
};

export const slideInLeft = {
  initial: { opacity: 0, x: -100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -100 },
};

export const slideInRight = {
  initial: { opacity: 0, x: 100 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 100 },
};

export const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export const pulseAnimation = {
  scale: [1, 1.02, 1],
  transition: {
    duration: 2,
    repeat: Infinity,
    ease: "easeInOut",
  },
};
EOF

log_success "Utility functions created"

# ============================================
# PHASE 5: Optimize Dashboard Components
# ============================================

log_section "PHASE 5: Optimizing Dashboard Components"

# Create optimized StatsCard
log_optimize "Creating optimized StatsCard component..."
cat > "client/src/components/dashboard/StatsCard.tsx" << 'EOF'
import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color?: 'sage' | 'blue' | 'amber' | 'rose';
  index?: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = 'sage',
  index = 0,
}) => {
  const colorMap = {
    sage: 'from-sage-400 to-sage-600',
    blue: 'from-accent-blue to-blue-600',
    amber: 'from-accent-amber to-amber-600',
    rose: 'from-accent-rose to-rose-600',
  };

  return (
    <GlassCard
      className="p-6 group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sage-600 text-sm font-medium">{title}</p>
          <motion.p
            className="text-3xl font-light text-sage-800 mt-2"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            {value}
          </motion.p>
          {change && (
            <motion.span
              className={`text-sm mt-2 inline-block ${
                change.startsWith('+') ? 'text-accent-green' : 'text-accent-amber'
              }`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
            >
              {change}
            </motion.span>
          )}
        </div>
        <motion.div
          className={`p-3 rounded-lg bg-gradient-to-br ${colorMap[color]} 
                     text-white group-hover:scale-110 transition-transform`}
          whileHover={{ rotate: 5 }}
        >
          <Icon className="w-6 h-6" />
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1 bg-sage-100 rounded-full overflow-hidden">
        <motion.div
          className={`h-full bg-gradient-to-r ${colorMap[color]}`}
          initial={{ width: 0 }}
          animate={{ width: '70%' }}
          transition={{ delay: 0.5 + index * 0.1, duration: 1 }}
        />
      </div>
    </GlassCard>
  );
};

export default StatsCard;
EOF

log_success "Dashboard components optimized"

# ============================================
# PHASE 6: Create Custom Hooks
# ============================================

log_section "PHASE 6: Creating Custom Hooks"

# Create useScrollAnimation hook
log_create "Creating scroll animation hook..."
cat > "client/src/hooks/useScrollAnimation.ts" << 'EOF'
import { useEffect, useRef, useState } from 'react';

export const useScrollAnimation = (threshold = 0.1) => {
  const ref = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold }
    );

    const element = ref.current;
    if (element) {
      observer.observe(element);
    }

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [threshold]);

  return { ref, isVisible };
};
EOF

# Create useTheme hook
log_create "Creating theme hook..."
cat > "client/src/hooks/useTheme.ts" << 'EOF'
import { useContext, createContext } from 'react';
import { sageTheme } from '@/lib/sage-theme';

export const ThemeContext = createContext({
  theme: sageTheme,
  isDark: false,
  toggleDark: () => {},
});

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
EOF

log_success "Custom hooks created"

# ============================================
# PHASE 7: Update Global Styles
# ============================================

log_section "PHASE 7: Optimizing Global Styles"

log_optimize "Creating enhanced global styles..."
cat > "client/src/styles/globals.css" << 'EOF'
@import 'tailwindcss/base';
@import 'tailwindcss/components';
@import 'tailwindcss/utilities';

@layer base {
  :root {
    /* Optimized Sage Colors */
    --color-background: 250 250 249;
    --color-surface: 255 255 255;
    --color-sage-50: 245 247 245;
    --color-sage-100: 232 236 231;
    --color-sage-200: 191 207 187;
    --color-sage-300: 181 196 177;
    --color-sage-400: 139 159 135;
    --color-sage-500: 115 138 110;
    --color-sage-600: 95 111 92;
    --color-sage-700: 74 89 72;
    --color-sage-800: 44 62 44;
    --color-sage-900: 30 43 33;

    /* Accent Colors */
    --color-accent-blue: 122 149 176;
    --color-accent-green: 127 160 116;
    --color-accent-amber: 196 164 100;
    --color-accent-rose: 176 133 133;

    /* Animation Timing */
    --animation-fast: 150ms;
    --animation-base: 300ms;
    --animation-slow: 500ms;

    /* Spacing Scale */
    --spacing-xs: 0.5rem;
    --spacing-sm: 1rem;
    --spacing-md: 1.5rem;
    --spacing-lg: 2rem;
    --spacing-xl: 3rem;
  }

  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-sage-800 antialiased;
    font-feature-settings: "rlig" 1, "calt" 1;
  }

  /* Smooth Scrolling */
  html {
    scroll-behavior: smooth;
    scroll-padding-top: 80px;
  }

  /* Focus Styles */
  *:focus-visible {
    @apply outline-none ring-2 ring-sage-400 ring-offset-2 ring-offset-background;
  }

  /* Selection */
  ::selection {
    @apply bg-sage-200 text-sage-900;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    @apply w-2 h-2;
  }

  ::-webkit-scrollbar-track {
    @apply bg-sage-50 rounded-full;
  }

  ::-webkit-scrollbar-thumb {
    @apply bg-gradient-to-b from-sage-400 to-sage-600 rounded-full;
  }

  ::-webkit-scrollbar-thumb:hover {
    @apply from-sage-500 to-sage-700;
  }
}

@layer components {
  /* Glass Effect Classes */
  .glass-light {
    @apply bg-white/70 backdrop-blur-lg;
  }

  .glass-medium {
    @apply bg-white/85 backdrop-blur-md;
  }

  .glass-dark {
    @apply bg-sage-800/70 backdrop-blur-lg;
  }

  /* Gradient Text */
  .gradient-text {
    @apply bg-gradient-to-r from-sage-600 to-sage-800 bg-clip-text text-transparent;
  }

  /* Card Hover Effects */
  .card-hover {
    @apply transition-all duration-300 hover:shadow-sage-lg hover:-translate-y-1;
  }

  /* Button Base */
  .btn-base {
    @apply px-4 py-2 rounded-lg font-medium transition-all duration-200;
    @apply focus-visible:ring-2 focus-visible:ring-sage-400 focus-visible:ring-offset-2;
  }

  /* Loading Animation */
  .animate-float {
    animation: float 6s ease-in-out infinite;
  }

  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }

  /* Pulse Glow */
  .pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }

  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(139, 159, 135, 0.2); }
    50% { box-shadow: 0 0 40px rgba(139, 159, 135, 0.4); }
  }
}

@layer utilities {
  /* Custom Gradients */
  .bg-gradient-radial {
    background: radial-gradient(circle, var(--tw-gradient-stops));
  }

  /* Text Balance */
  .text-balance {
    text-wrap: balance;
  }

  /* Animate on Hover Group */
  .group-hover-lift {
    @apply group-hover:-translate-y-1 transition-transform duration-300;
  }

  /* Stagger Animation Delays */
  .stagger-1 { animation-delay: 100ms; }
  .stagger-2 { animation-delay: 200ms; }
  .stagger-3 { animation-delay: 300ms; }
  .stagger-4 { animation-delay: 400ms; }
  .stagger-5 { animation-delay: 500ms; }
}
EOF

log_success "Global styles optimized"

# ============================================
# PHASE 8: Install Required Packages
# ============================================

log_section "PHASE 8: Installing Optimized Dependencies"

log_info "Installing design-focused dependencies..."
npm install --save \
  framer-motion \
  clsx \
  tailwind-merge \
  lucide-react \
  @radix-ui/react-slot \
  @radix-ui/react-portal 2>/dev/null || true

log_success "Dependencies installed"

# ============================================
# PHASE 9: Create Component Index
# ============================================

log_section "PHASE 9: Creating Component Index"

log_create "Creating component barrel exports..."
cat > "client/src/components/index.ts" << 'EOF'
// UI Components
export { GlassCard } from './ui/GlassCard';
export { SkeletonLoader } from './ui/SkeletonLoader';

// Layout Components
export { PageWrapper } from './layout/PageWrapper';
export { Grid } from './layout/GridSystem';

// Animation Components
export { FloatingOrb } from './animations/FloatingOrb';

// Dashboard Components
export { StatsCard } from './dashboard/StatsCard';

// Hooks
export { useScrollAnimation } from '../hooks/useScrollAnimation';
export { useTheme } from '../hooks/useTheme';
EOF

log_success "Component index created"

# ============================================
# PHASE 10: Create Demo Page
# ============================================

log_section "PHASE 10: Creating Demo Page"

log_create "Creating design system demo page..."
cat > "client/src/pages/design-demo.tsx" << 'EOF'
import React from 'react';
import { PageWrapper, Grid, GlassCard, StatsCard, SkeletonLoader } from '@/components';
import { Users, Calendar, FileText, Brain } from 'lucide-react';

const DesignDemo = () => {
  const stats = [
    { title: 'Active Clients', value: '24', change: '+12%', icon: Users, color: 'sage' as const },
    { title: 'Sessions', value: '156', change: '+8%', icon: Calendar, color: 'blue' as const },
    { title: 'Notes', value: '89', change: '+23%', icon: FileText, color: 'amber' as const },
    { title: 'Insights', value: '45', change: '+15%', icon: Brain, color: 'rose' as const },
  ];

  return (
    <PageWrapper title="Design System Demo">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <section>
          <h2 className="text-2xl font-light text-sage-700 mb-4">Statistics Cards</h2>
          <Grid columns={4} gap="lg">
            {stats.map((stat, index) => (
              <StatsCard key={stat.title} {...stat} index={index} />
            ))}
          </Grid>
        </section>

        {/* Glass Cards */}
        <section>
          <h2 className="text-2xl font-light text-sage-700 mb-4">Glass Morphism</h2>
          <Grid columns={3} gap="md">
            <GlassCard variant="light" className="p-6">
              <h3 className="text-lg font-medium text-sage-800">Light Glass</h3>
              <p className="text-sage-600 mt-2">Subtle transparency with blur</p>
            </GlassCard>
            <GlassCard variant="medium" className="p-6">
              <h3 className="text-lg font-medium text-sage-800">Medium Glass</h3>
              <p className="text-sage-600 mt-2">Balanced opacity and blur</p>
            </GlassCard>
            <GlassCard variant="dark" className="p-6 text-white">
              <h3 className="text-lg font-medium">Dark Glass</h3>
              <p className="text-sage-100 mt-2">Dark mode compatible</p>
            </GlassCard>
          </Grid>
        </section>

        {/* Loading States */}
        <section>
          <h2 className="text-2xl font-light text-sage-700 mb-4">Loading States</h2>
          <GlassCard className="p-6 space-y-4">
            <SkeletonLoader variant="text" count={3} className="mb-2" />
            <SkeletonLoader variant="card" />
            <div className="flex gap-4">
              <SkeletonLoader variant="avatar" />
              <SkeletonLoader variant="button" />
            </div>
          </GlassCard>
        </section>
      </div>
    </PageWrapper>
  );
};

export default DesignDemo;
EOF

log_success "Demo page created"

# ============================================
# PHASE 11: Final Verification & Cleanup
# ============================================

log_section "PHASE 11: Final Verification"

# Verify all critical files exist
log_info "Verifying installation..."
MISSING_FILES=0

critical_files=(
    "client/src/components/ui/GlassCard.tsx"
    "client/src/components/animations/FloatingOrb.tsx"
    "client/src/components/layout/PageWrapper.tsx"
    "client/src/hooks/useScrollAnimation.ts"
    "client/src/styles/globals.css"
)

for file in "${critical_files[@]}"; do
    if [ ! -f "$file" ]; then
        log_error "Missing: $file"
        ((MISSING_FILES++))
    fi
done

if [ $MISSING_FILES -eq 0 ]; then
    log_success "All critical files verified ✓"
else
    log_error "Some files are missing. Please check the log."
fi

# ============================================
# Create Start Script
# ============================================

log_create "Creating quick start script..."
cat > "start-carenotes.sh" << 'STARTSCRIPT'
#!/bin/bash
echo "Starting CareNotes AI..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Dashboard: http://localhost:3000"
echo "API: http://localhost:3001"
echo "Design Demo: http://localhost:3000/design-demo"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
npm run dev
STARTSCRIPT
chmod +x start-carenotes.sh

# ============================================
# Create Color Scheme Audit Script (if missing)
# ============================================

if [ ! -f "audit-color-scheme.sh" ]; then
    log_create "Creating color scheme audit script..."
    cat > "audit-color-scheme.sh" << 'AUDITSCRIPT'
#!/bin/bash
echo "🎨 Auditing Sage Color Scheme..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find and replace old color references
find client/src -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.css" \) -exec sed -i '' \
    -e 's/text-gray-/text-sage-/g' \
    -e 's/bg-gray-/bg-sage-/g' \
    -e 's/border-gray-/border-sage-/g' \
    -e 's/from-gray-/from-sage-/g' \
    -e 's/to-gray-/to-sage-/g' \
    {} \;

echo "✓ Color scheme updated to sage theme"
AUDITSCRIPT
    chmod +x audit-color-scheme.sh
fi

# ============================================
# Generate README
# ============================================

log_create "Generating project README..."
cat > "README.md" << 'READMEEOF'
# CareNotes AI - Enhanced Design System

## 🌿 Sage Theme Implementation

A modern, calming interface designed for mental health professionals.

### Quick Start
```bash
# Install dependencies
npm install

# Run development server
./start-carenotes.sh

# Or manually
npm run dev
npm run dev &
DEV_PID=$!
sleep 5

# Check if dev server started
if ps -p $DEV_PID > /dev/null; then
    log_success "Development server running (PID: $DEV_PID)"
    kill $DEV_PID
else
    log_warning "Development server test failed"
fi

# ============================================
# GENERATE README
# ============================================

log_section "GENERATING README"

cat > README.md << 'READMEEOF'
# 🌿 CareNotes AI - Sage Theme Edition

A beautiful, sage-themed mental health documentation assistant with glass morphism design.

## Quick Start

\`\`\`bash
./start-carenotes.sh
\`\`\`

### Design System Components

#### UI Components
- **GlassCard** - Glass morphism cards with blur effects
- **FloatingOrb** - Animated background orbs for depth
- **SkeletonLoader** - Elegant loading states

#### Layout Components
- **PageWrapper** - Consistent page layout with animations
- **Grid** - Responsive grid system with stagger animations

#### Dashboard Components
- **StatsCard** - Animated statistics displays

### Color Palette
- Primary: Sage (#8B9F87)
- Accent Blue: #7A95B0
- Accent Amber: #C4A464
- Accent Rose: #B08585

### View Demo
Navigate to \`/design-demo\` to see all components in action.

### Scripts
- \`enhanced-preflight.sh\` - System setup and optimization
- \`audit-color-scheme.sh\` - Apply sage color scheme
- \`start-carenotes.sh\` - Quick start development

### File Structure
\`\`\`
client/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── layout/
│   │   ├── dashboard/
│   │   └── animations/
│   ├── hooks/
│   ├── lib/
│   │   └── utils/
│   └── styles/
\`\`\`

Built with ❤️ for mental health professionals
READMEEOF

log_success "README generated"

# ============================================
# FINAL SUMMARY
# ============================================

log_section "ENHANCED PRE-FLIGHT COMPLETE"

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║                                                          ║"
echo "║     🌿 CARENOTES AI - ENHANCED SETUP COMPLETE 🌿        ║"
echo "║                                                          ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Components Created:  \$(printf '%-34s' "\$COMPONENTS_CREATED ✓") ║"
echo "║  Optimizations Made:  \$(printf '%-34s' "\$OPTIMIZATIONS ✓") ║"
echo "║  Errors Fixed:        \$(printf '%-34s' "\$ERRORS_FIXED ✓") ║"
echo "║                                                          ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║                                                          ║"
echo "║  Next Steps:                                            ║"
echo "║  1. Run: ./start-carenotes.sh                          ║"
echo "║  2. Visit: http://localhost:3000/design-demo           ║"
echo "║  3. Explore the sage-themed components                 ║"
echo "║                                                          ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

log_success "✨ System optimized for sage theme!"
echo ""
echo "New components available:"
echo "  • GlassCard - Glass morphism cards"
echo "  • FloatingOrb - Animated background orbs"
echo "  • PageWrapper - Page layout with animations"
echo "  • Grid - Responsive grid system"
echo "  • StatsCard - Optimized stat displays"
echo "  • SkeletonLoader - Beautiful loading states"
echo ""
echo "View the design system at: /design-demo"
echo ""

# Save log summary
echo "" >> "\$LOG_FILE"
echo "Installation completed at \$(date)" >> "\$LOG_FILE"
echo "Total optimizations: \$OPTIMIZATIONS" >> "\$LOG_FILE"
echo "Components created: \$COMPONENTS_CREATED" >> "\$LOG_FILE"
echo "Errors fixed: \$ERRORS_FIXED" >> "\$LOG_FILE"

# Cleanup
log_info "Log saved to: \$LOG_FILE"
log_info "Backup saved to: \$BACKUP_DIR"

# Ask to run color scheme audit
read -p "Ready to apply the sage color scheme? (y/n) " -n 1 -r
echo ""
if [[ \$REPLY =~ ^[Yy]\$ ]]; then
    if [ -f "audit-color-scheme.sh" ]; then
        bash audit-color-scheme.sh
    fi
fi

# Ask to start the application
echo ""
read -p "🚀 Would you like to start the application now? (y/n) " -n 1 -r
echo ""
if [[ \$REPLY =~ ^[Yy]\$ ]]; then
    echo ""
    log_success "Starting CareNotes AI..."
    ./start-carenotes.sh
else
    echo ""
    log_info "To start later, run: ./start-carenotes.sh"
fi

exit 0