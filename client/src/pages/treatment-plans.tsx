import React from 'react';

export default function TreatmentPlans() {
  return (
    <div className="p-8">
      <h1 
        className="text-2xl font-bold mb-6"
        style={{ color: '#344C3D' }}
      >
        Treatment Plans
      </h1>
      <div 
        className="rounded-lg p-4"
        style={{
          backgroundColor: 'rgba(142, 165, 140, 0.1)',
          border: '1px solid rgba(142, 165, 140, 0.2)'
        }}
      >
        <p style={{ color: '#8EA58C' }}>
          Treatment plan management functionality will be implemented here.
        </p>
      </div>
    </div>
  );
}