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
