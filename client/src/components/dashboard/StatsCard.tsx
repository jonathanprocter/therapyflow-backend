import React from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: LucideIcon;
  color?: 'gold' | 'burgundy' | 'teal' | 'coral' | 'green';
  index?: number;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  change,
  icon: Icon,
  color = 'gold',
  index = 0,
}) => {
  // Insight Atlas color gradients
  const colorMap = {
    gold: 'from-gold to-gold-dark',
    burgundy: 'from-burgundy to-oxblood',
    teal: 'from-teal to-teal-600',
    coral: 'from-coral to-coral-500',
    green: 'from-green to-green-600',
  };

  // Text colors for titles
  const textColorMap = {
    gold: 'text-sepia',
    burgundy: 'text-burgundy',
    teal: 'text-teal',
    coral: 'text-coral',
    green: 'text-green',
  };

  return (
    <GlassCard
      className="p-6 group cursor-pointer"
      whileHover={{ scale: 1.02 }}
      transition={{ delay: index * 0.1 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={`${textColorMap[color]} text-sm font-medium`}>{title}</p>
          <motion.p
            className="text-3xl font-light text-ink mt-2"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 + index * 0.1 }}
          >
            {value}
          </motion.p>
          {change && (
            <motion.span
              className={`text-sm mt-2 inline-block ${
                change.startsWith('+') ? 'text-green' : 'text-coral'
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
      <div className="mt-4 h-1 bg-parchment rounded-full overflow-hidden">
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
