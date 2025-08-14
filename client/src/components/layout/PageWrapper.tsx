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

  // Define orb configurations with brand colors
  const orbConfigs = [
    {
      style: { 
        backgroundColor: '#8EA58C', // Sage
        opacity: 0.15 
      },
      position: { top: '10%', right: '5%' },
      size: '200px',
      duration: 25
    },
    {
      style: { 
        backgroundColor: '#88A5BC', // French Blue
        opacity: 0.12 
      },
      position: { bottom: '20%', left: '10%' },
      size: '300px',
      duration: 30,
      delay: 5
    },
    {
      style: { 
        backgroundColor: 'rgba(115, 138, 110, 0.1)' // Moss with transparency
      },
      position: { top: '60%', right: '50%' },
      size: '250px',
      duration: 35,
      delay: 10
    }
  ];

  return (
    <motion.div
      className={`min-h-screen relative overflow-hidden ${className}`}
      style={{ 
        backgroundColor: '#F2F3F1',
        paddingTop: '30px' // Aligns with main content
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background Orbs */}
      {showOrbs && orbConfigs.map((orb, index) => (
        <FloatingOrb
          key={index}
          {...orb}
        />
      ))}

      {/* Content Container */}
      <div className="relative z-10 px-4 max-w-6xl mx-auto">
        {title && (
          <motion.h1
            className="text-4xl font-semibold mb-8"
            style={{ color: '#344C3D' }}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            {title}
          </motion.h1>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Subtle Brand Gradient Overlay */}
      <div 
        className="fixed inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top right, 
            rgba(136, 165, 188, 0.04) 0%, 
            transparent 50%),
          radial-gradient(ellipse at bottom left, 
            rgba(142, 165, 140, 0.04) 0%, 
            transparent 50%)`
        }}
      />
    </motion.div>
  );
};

export default PageWrapper;