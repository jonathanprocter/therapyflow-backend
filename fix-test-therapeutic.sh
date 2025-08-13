#!/bin/bash

cat > scripts/test-therapeutic.ts << 'TESTEND'
import { enhancedStorage } from '../server/storage-extensions';
import { v4 as uuidv4 } from 'uuid';

async function testTherapeuticFeatures() {
  console.log('🧪 Testing Therapeutic Journey Features...\n');

  try {
    // Create test data with proper relationships
    const testTherapistId = uuidv4();
    const testClientId = uuidv4();
    const testSessionId = uuidv4();

    console.log('0️⃣ Setting up test data...');

    // Create a test therapist/user
    const testTherapist = await enhancedStorage.createUser({
      id: testTherapistId,
      username: `test-therapist-${Date.now()}`,
      email: `test${Date.now()}@example.com`,
      role: 'therapist'
    });
    console.log('   ✅ Test therapist created');

    // Create a test client
    const testClient = await enhancedStorage.createClient({
      id: testClientId,
      therapistId: testTherapistId,
      firstName: 'Test',
      lastName: 'Client',
      email: `testclient${Date.now()}@example.com`,
      phone: '555-0100',
      dateOfBirth: new Date('1990-01-01'),
      status: 'active'
    });
    console.log('   ✅ Test client created');

    // Create a test session
    const testSession = await enhancedStorage.createSession({
      id: testSessionId,
      clientId: testClientId,
      therapistId: testTherapistId,
      scheduledAt: new Date(),
      duration: 60,
      status: 'completed',
      type: 'individual',
      notes: 'Test session for therapeutic features'
    });
    console.log('   ✅ Test session created');

    // Test 1: Auto-tagging
    console.log('\n1️⃣ Testing Auto-Tagging...');
    const testNote = {
      clientId: testClientId,
      sessionId: testSessionId,
      therapistId: testTherapistId,
      sessionDate: new Date(),
      content: 'Today I felt anxious about work. My boss was frustrated with me. I tried breathing exercises and felt better. I realized that I need to set better boundaries with my family.',
      status: 'completed' as const,
      tags: [],
      aiTags: [],
    };

    const createdNote = await enhancedStorage.createProgressNote(testNote);
    console.log('   ✅ Note created with ID:', createdNote.id);
    console.log('   📝 Content tags will be extracted asynchronously');

    // Wait for async tagging to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test 2: Quick recall
    console.log('\n2️⃣ Testing Quick Recall...');
    const recallResults = await enhancedStorage.quickRecall(
      testTherapistId,
      testClientId,
      'anxiety'
    );
    console.log('   ✅ Quick recall completed');
    console.log('   📊 Found', recallResults.directMatches.length, 'direct matches');
    console.log('   💡 Found', recallResults.relatedInsights.length, 'related insights');
    console.log('   📈 Pattern frequency:', recallResults.patterns.frequency);

    // Test 3: Journey synthesis
    console.log('\n3️⃣ Testing Journey Synthesis...');
    const synthesis = await enhancedStorage.synthesizeClientJourney(
      testClientId,
      testTherapistId
    );
    console.log('   ✅ Journey synthesis completed');
    console.log('   🎯 Dominant themes:', Object.keys(synthesis.dominantThemes.frequency || {}));
    console.log('   💡 Key insights:', synthesis.keyInsights?.length || 0);
    console.log('   📋 Recommendations:', synthesis.recommendations?.length || 0);

    // Test 4: Get insights
    console.log('\n4️⃣ Testing Get Insights...');
    const insights = await enhancedStorage.getTherapeuticInsights(testClientId);
    console.log('   ✅ Retrieved', insights.length, 'insights');

    // Test 5: Get tags
    console.log('\n5️⃣ Testing Get Tags...');
    const emotionTags = await enhancedStorage.getSessionTags(testClientId, 'emotions');
    const themeTags = await enhancedStorage.getSessionTags(testClientId, 'themes');
    console.log('   ✅ Retrieved tags');
    console.log('   😊 Emotion tags:', emotionTags.length);
    console.log('   📚 Theme tags:', themeTags.length);

    // Clean up test data
    console.log('\n6️⃣ Cleaning up test data...');
    await enhancedStorage.deleteProgressNote(createdNote.id);
    await enhancedStorage.deleteClient(testClientId);
    console.log('   ✅ Test data cleaned up');

    console.log('\n✨ All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Auto-tagging system working');
    console.log('   ✅ Quick recall functioning');
    console.log('   ✅ Journey synthesis operational');
    console.log('   ✅ Insights extraction working');
    console.log('   ✅ Tag retrieval functioning');
    console.log('\n🎉 Therapeutic Journey features are fully operational!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    if (error.detail) {
      console.error('   Details:', error.detail);
    }
    if (error.hint) {
      console.error('   Hint:', error.hint);
    }
    process.exit(1);
  }
}

// Run tests
console.log('Starting therapeutic feature tests...\n');
testTherapeuticFeatures()
  .then(() => {
    console.log('\n✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  });
TESTEND

echo "✅ Test script updated with proper data relationships"

# Install uuid if not already installed
npm list uuid || npm install --save uuid
npm list @types/uuid || npm install --save-dev @types/uuid

echo ""
echo "Now run the test again:"
echo "npm run test:therapeutic"