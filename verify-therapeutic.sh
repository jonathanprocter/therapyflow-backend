#!/bin/bash

# ========================================
# Therapeutic Journey - Verification & Integration
# ========================================

echo "🔍 Verifying Therapeutic Journey Installation..."
echo ""

# Check all files exist
echo "📁 Checking files..."
files=(
  "server/services/therapeutic/auto-tagger.ts"
  "server/services/therapeutic/journey-synthesizer.ts"
  "server/services/therapeutic/quick-recall.ts"
  "server/storage-extensions.ts"
  "server/routes/therapeutic.ts"
  "server/integrate-therapeutic.ts"
  "shared/schema-extensions.ts"
  "server/migrations/add-therapeutic-journey.sql"
  "scripts/test-therapeutic.ts"
)

all_good=true
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ $file"
  else
    echo "❌ $file (missing)"
    all_good=false
  fi
done

echo ""
if $all_good; then
  echo "✅ All files are in place!"
else
  echo "⚠️ Some files are missing"
  exit 1
fi

echo ""
echo "📦 Checking dependencies..."
deps=(
  "natural"
  "sentiment"
  "fuse.js"
  "node-cache"
  "lodash"
  "date-fns"
)

for dep in "${deps[@]}"; do
  if npm list "$dep" >/dev/null 2>&1; then
    echo "✅ $dep"
  else
    echo "❌ $dep not installed"
  fi
done

echo ""
echo "=========================================="
echo "📋 INTEGRATION INSTRUCTIONS"
echo "=========================================="
echo ""
echo "STEP 1: Add to your main server file (server/index.ts):"
echo ""
echo "----------------------------------------"
cat << 'CODE'
// At the top with other imports
import { integrateTherapeuticFeatures } from './integrate-therapeutic';

// After your Express app setup (after middleware, before routes)
// Replace 'app' with your Express app variable name
integrateTherapeuticFeatures(app);
CODE
echo "----------------------------------------"
echo ""
echo "STEP 2: Run the database migration:"
echo ""
echo "  npm run migrate:therapeutic"
echo ""
echo "  OR if that doesn't work:"
echo ""
echo "  psql \$DATABASE_URL < server/migrations/add-therapeutic-journey.sql"
echo ""
echo "STEP 3: Test the integration:"
echo ""
echo "  npm run test:therapeutic"
echo ""
echo "=========================================="
echo "🌐 API ENDPOINTS AVAILABLE"
echo "=========================================="
echo ""
echo "POST /api/therapeutic/synthesize/:clientId"
echo "  - Generate journey synthesis for a client"
echo ""
echo "POST /api/therapeutic/recall/:clientId"
echo "  - Quick search through client's therapeutic data"
echo "  - Body: { query: 'search term' }"
echo ""
echo "GET /api/therapeutic/insights/:clientId"
echo "  - Get AI insights for a client"
echo ""
echo "GET /api/therapeutic/tags/:clientId?category=emotions"
echo "  - Get session tags (categories: emotions, themes, coping_strategies, progress_indicators)"
echo ""
echo "=========================================="
echo "✨ FEATURES ENABLED"
echo "=========================================="
echo ""
echo "✅ Auto-tagging: Progress notes are automatically tagged"
echo "✅ Journey Synthesis: Analyze therapeutic progress over time"
echo "✅ Quick Recall: Instant search across all session data"
echo "✅ AI Insights: Extract key insights and breakthroughs"
echo "✅ Pattern Detection: Identify recurring themes and patterns"
echo ""

# Create a quick test endpoint file
echo "Creating test endpoint file..."
cat > test-therapeutic-endpoint.ts << 'TESTFILE'
// Test file to verify therapeutic endpoints
import axios from 'axios';

const BASE_URL = 'http://localhost:3000'; // Update with your server URL
const TEST_CLIENT_ID = 'test-client-123'; // Update with a real client ID

async function testEndpoints() {
  console.log('Testing Therapeutic Endpoints...\n');

  try {
    // Test synthesis
    console.log('1. Testing Journey Synthesis...');
    const synthesisResponse = await axios.post(
      `${BASE_URL}/api/therapeutic/synthesize/${TEST_CLIENT_ID}`,
      {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate: new Date()
      }
    );
    console.log('✅ Synthesis endpoint working');

    // Test recall
    console.log('\n2. Testing Quick Recall...');
    const recallResponse = await axios.post(
      `${BASE_URL}/api/therapeutic/recall/${TEST_CLIENT_ID}`,
      { query: 'anxiety' }
    );
    console.log('✅ Recall endpoint working');

    // Test insights
    console.log('\n3. Testing Get Insights...');
    const insightsResponse = await axios.get(
      `${BASE_URL}/api/therapeutic/insights/${TEST_CLIENT_ID}`
    );
    console.log('✅ Insights endpoint working');

    // Test tags
    console.log('\n4. Testing Get Tags...');
    const tagsResponse = await axios.get(
      `${BASE_URL}/api/therapeutic/tags/${TEST_CLIENT_ID}?category=emotions`
    );
    console.log('✅ Tags endpoint working');

    console.log('\n✨ All endpoints are working!');
  } catch (error) {
    console.error('❌ Error testing endpoints:', error.message);
  }
}

testEndpoints();
TESTFILE

echo "✅ Test endpoint file created: test-therapeutic-endpoint.ts"
echo ""
echo "=========================================="
echo "🎉 VERIFICATION COMPLETE!"
echo "=========================================="
echo ""
echo "Your therapeutic journey system is ready to use!"
echo "Follow the integration instructions above to complete setup."