import { enhancedStorage } from './storage-extensions';
import therapeuticRoutes from './routes/therapeutic';

export function integrateTherapeuticFeatures(app: any) {
  (global as any).storage = enhancedStorage;
  app.use('/api/therapeutic', therapeuticRoutes);
  console.log('✅ Therapeutic features integrated');
  return {
    storage: enhancedStorage,
    routes: therapeuticRoutes
  };
}

export { enhancedStorage, therapeuticRoutes };
