import React from 'react';
import { PageWrapper, Grid, GlassCard, StatsCard, SkeletonLoader } from '@/components';
import { Users, Calendar, FileText, Brain } from 'lucide-react';

const DesignDemo = () => {
  const stats = [
    { title: 'Active Clients', value: '24', change: '+12%', icon: Users, color: 'teal' as const },
    { title: 'Sessions', value: '156', change: '+8%', icon: Calendar, color: 'gold' as const },
    { title: 'Notes', value: '89', change: '+23%', icon: FileText, color: 'coral' as const },
    { title: 'Insights', value: '45', change: '+15%', icon: Brain, color: 'green' as const },
  ];

  return (
    <PageWrapper title="Design System Demo">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Stats Grid */}
        <section>
          <h2 className="text-2xl font-light text-teal-700 mb-4">Statistics Cards</h2>
          <Grid columns={4} gap="lg">
            {stats.map((stat, index) => (
              <StatsCard key={stat.title} {...stat} index={index} />
            ))}
          </Grid>
        </section>

        {/* Glass Cards */}
        <section>
          <h2 className="text-2xl font-light text-teal-700 mb-4">Glass Morphism</h2>
          <Grid columns={3} gap="md">
            <GlassCard variant="light" className="p-6">
              <h3 className="text-lg font-medium text-teal-800">Light Glass</h3>
              <p className="text-teal-600 mt-2">Subtle transparency with blur</p>
            </GlassCard>
            <GlassCard variant="medium" className="p-6">
              <h3 className="text-lg font-medium text-teal-800">Medium Glass</h3>
              <p className="text-teal-600 mt-2">Balanced opacity and blur</p>
            </GlassCard>
            <GlassCard variant="dark" className="p-6 text-white">
              <h3 className="text-lg font-medium">Dark Glass</h3>
              <p className="text-teal-100 mt-2">Dark mode compatible</p>
            </GlassCard>
          </Grid>
        </section>

        {/* Loading States */}
        <section>
          <h2 className="text-2xl font-light text-teal-700 mb-4">Loading States</h2>
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
