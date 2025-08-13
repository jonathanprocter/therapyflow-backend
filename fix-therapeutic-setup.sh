#!/bin/bash

# ========================================
# Therapeutic Journey - Fix and Complete
# ========================================

set -e

echo "🔧 Fixing and completing setup..."

# ========================================
# 1. Create missing directories
# ========================================
echo "📁 Creating missing directories..."
mkdir -p server/routes
mkdir -p scripts

# ========================================
# 2. Create API Routes
# ========================================
echo "🌐 Creating API routes..."

cat > server/routes/therapeutic.ts << 'EOF'
import { Request, Response, Router } from 'express';
import { enhancedStorage } from '../storage-extensions';

const router = Router();

// Synthesize client journey
router.post('/synthesize/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { startDate, endDate, focusTags } = req.body;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const synthesis = await enhancedStorage.synthesizeClientJourney(
      clientId,
      therapistId,
      {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        focusTags,
      }
    );

    res.json({ success: true, synthesis });
  } catch (error) {
    console.error('Error synthesizing journey:', error);
    res.status(500).json({ success: false, error: 'Failed to synthesize journey' });
  }
});

// Quick recall search
router.post('/recall/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { query } = req.body;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const results = await enhancedStorage.quickRecall(
      therapistId,
      clientId,
      query
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error in quick recall:', error);
    res.status(500).json({ success: false, error: 'Failed to perform recall' });
  }
});

// Get therapeutic insights
router.get('/insights/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const insights = await enhancedStorage.getTherapeuticInsights(clientId);

    res.json({ success: true, insights });
  } catch (error) {
    console.error('Error getting insights:', error);
    res.status(500).json({ success: false, error: 'Failed to get insights' });
  }
});

// Get session tags
router.get('/tags/:clientId', async (req: Request, res: Response) => {
  try {
    const { clientId } = req.params;
    const { category } = req.query;
    const therapistId = (req as any).user?.id;

    if (!therapistId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const tags = await enhancedStorage.getSessionTags(
      clientId,
      category as string
    );

    res.json({ success: true, tags });
  } catch (error) {
    console.error('Error getting tags:', error);
    res.status(500).json({ success: false, error: 'Failed to get tags' });
  }
});

export default router;
EOF

echo "✅ API routes created"

# ========================================
# 3. Create Test Script
# ========================================
echo "🧪 Creating test script..."

cat > scripts/test-therapeutic.ts << 'EOF'
import { enhancedStorage } from '../server/storage-extensions';

async function testTherapeuticFeatures() {
  console.log('🧪 Testing Therapeutic Journey Features...\n');

  const testTherapistId = 'test-therapist-' + Date.now();
  const testClientId = 'test-client-' + Date.now();
  const testSessionId = 'test-session-' + Date.now();

  try {
    // Test 1: Auto-tagging
    console.log('1️⃣ Testing Auto-Tagging...');
    const testNote = {
      clientId: testClientId,
      sessionId: testSessionId,
      therapistId: testTherapistId,
      sessionDate: new Date(),
      content: 'Today I felt anxious about work. My boss was frustrated with me. I tried breathing exercises and felt better. I realized that I need to set better boundaries.',
      status: 'completed' as const,
      tags: [],
      aiTags: [],
    };

    const createdNote = await enhancedStorage.createProgressNote(testNote);
    console.log('✅ Note created with ID:', createdNote.id);

    // Wait a moment for async tagging
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Quick recall
    console.log('\n2️⃣ Testing Quick Recall...');
    const recallResults = await enhancedStorage.quickRecall(
      testTherapistId,
      testClientId,
      'anxiety'
    );
    console.log('✅ Quick recall completed');
    console.log('   Found', recallResults.directMatches.length, 'direct matches');
    console.log('   Found', recallResults.relatedInsights.length, 'related insights');

    // Test 3: Journey synthesis
    console.log('\n3️⃣ Testing Journey Synthesis...');
    const synthesis = await enhancedStorage.synthesizeClientJourney(
      testClientId,
      testTherapistId
    );
    console.log('✅ Journey synthesis completed');
    console.log('   Dominant themes:', Object.keys(synthesis.dominantThemes.frequency || {}));
    console.log('   Key insights:', synthesis.keyInsights?.length || 0);
    console.log('   Recommendations:', synthesis.recommendations?.length || 0);

    // Test 4: Get insights
    console.log('\n4️⃣ Testing Get Insights...');
    const insights = await enhancedStorage.getTherapeuticInsights(testClientId);
    console.log('✅ Retrieved', insights.length, 'insights');

    console.log('\n✨ All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run tests
console.log('Starting therapeutic feature tests...\n');
testTherapeuticFeatures()
  .then(() => {
    console.log('\n✅ Test suite completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
EOF

echo "✅ Test script created"

# ========================================
# 4. Create Integration Helper
# ========================================
echo "📝 Creating integration helper..."

cat > server/integrate-therapeutic.ts << 'EOF'
/**
 * Integration helper for therapeutic features
 * Add this to your main server file
 */

import { enhancedStorage } from './storage-extensions';
import therapeuticRoutes from './routes/therapeutic';

export function integrateTherapeuticFeatures(app: any) {
  // Replace the storage globally
  (global as any).storage = enhancedStorage;

  // Add routes
  app.use('/api/therapeutic', therapeuticRoutes);

  console.log('✅ Therapeutic features integrated');

  return {
    storage: enhancedStorage,
    routes: therapeuticRoutes
  };
}

// Export for manual integration
export { enhancedStorage, therapeuticRoutes };
EOF

echo "✅ Integration helper created"

# ========================================
# 5. Create Documentation
# ========================================
echo "📚 Creating documentation..."

cat > therapeutic-docs.md << 'EOF'
# Therapeutic Journey Enhancement Documentation

## Overview
The Therapeutic Journey Enhancement system provides intelligent auto-tagging, journey synthesis, and quick recall capabilities for therapy session management.

## Quick Start

### 1. Run Database Migration
```bash
psql $DATABASE_URL < server/migrations/add-therapeutic-journey.sql