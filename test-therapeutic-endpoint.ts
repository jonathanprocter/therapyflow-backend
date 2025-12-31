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
