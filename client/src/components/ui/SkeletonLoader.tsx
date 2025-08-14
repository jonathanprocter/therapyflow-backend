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
