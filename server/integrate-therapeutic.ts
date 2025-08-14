// Enhanced storage functions will be available through the new CareNotesAI pipeline
// import { enhancedStorage } from './storage-extensions';
import therapeuticRoutes from './routes/therapeutic';

export function integrateTherapeuticFeatures(app: any) {
  // TODO: Integrate with new CareNotesAI pipeline storage
  // (global as any).storage = enhancedStorage;
  app.use('/api/therapeutic', therapeuticRoutes);
  console.log('✅ Therapeutic features integrated (CareNotesAI pipeline pending)');
  return {
    routes: therapeuticRoutes
  };
}

export { therapeuticRoutes };
