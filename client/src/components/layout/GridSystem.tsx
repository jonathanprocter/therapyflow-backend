import React, { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface GridProps {
  children: ReactNode;
  columns?: 1 | 2 | 3 | 4 | 6 | 12;
  gap?: 'sm' | 'md' | 'lg' | 'xl' | 'brand';
  className?: string;
  animate?: boolean;
  staggerDelay?: number;
}

export const Grid: React.FC<GridProps> = ({
  children,
  columns = 3,
  gap = 'brand', // Default to brand spacing
  className = '',
  animate = true,
  staggerDelay = 0.08, // Slightly faster for professional feel
}) => {

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6',
    12: 'grid-cols-3 md:grid-cols-6 lg:grid-cols-12',
  };

  // Gap classes with brand-specific spacing
  const gapClasses = {
    sm: 'gap-2',           // 8px
    md: 'gap-4',           // 16px
    brand: 'gap-5',        // 20px - your specified card spacing
    lg: 'gap-6',           // 24px
    xl: 'gap-8',           // 32px
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
        delayChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 15, // Subtle movement
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.4,
        ease: 'easeOut',
      }
    },
  };

  // Style for consistent grid behavior
  const gridStyle: React.CSSProperties = {
    width: '100%',
  };

  if (animate) {
    return (
      <motion.div
        className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}
        style={gridStyle}
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {React.Children.map(children, (child, index) => (
          <motion.div
            key={index}
            variants={itemVariants}
            style={{ width: '100%' }}
          >
            {child}
          </motion.div>
        ))}
      </motion.div>
    );
  }

  return (
    <div 
      className={`grid ${columnClasses[columns]} ${gapClasses[gap]} ${className}`}
      style={gridStyle}
    >
      {children}
    </div>
  );
};

// Card wrapper for consistent styling within grid
export const GridCard: React.FC<{ 
  children: ReactNode; 
  onClick?: () => void;
  href?: string;
  className?: string;
}> = ({ children, onClick, href, className = '' }) => {
  const cardStyle: React.CSSProperties = {
    backgroundColor: '#FFFFFF',
    border: '1px solid rgba(115, 138, 110, 0.15)',
    borderRadius: '8px',
    padding: '24px',
    boxShadow: '0 2px 4px rgba(52, 76, 61, 0.08)',
    transition: 'all 0.3s ease',
    cursor: onClick || href ? 'pointer' : 'default',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick || href) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 8px rgba(52, 76, 61, 0.12)';
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (onClick || href) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 4px rgba(52, 76, 61, 0.08)';
    }
  };

  return (
    <div
      className={className}
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </div>
  );
};

// Section header for grids
export const GridHeader: React.FC<{ 
  title: string; 
  subtitle?: string;
  className?: string;
}> = ({ title, subtitle, className = '' }) => {
  return (
    <div className={`text-center mb-8 ${className}`}>
      <h2 
        className="text-2xl font-semibold mb-2"
        style={{ color: '#344C3D' }}
      >
        {title}
      </h2>
      {subtitle && (
        <p 
          className="text-sm"
          style={{ color: '#738A6E' }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
};

export default Grid;