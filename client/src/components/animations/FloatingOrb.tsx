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
  const colorMap: Record<string, string> = {
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
