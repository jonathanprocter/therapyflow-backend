
#!/bin/bash
set -e
cat > client/src/components/ui/GlassCard.tsx << 'EOF'
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
echo "GlassCard created successfully!"
