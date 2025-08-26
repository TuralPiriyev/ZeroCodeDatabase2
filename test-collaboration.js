// Test script for Team Collaboration System
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

// Test data
const testUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'testpass123'
};

const testInvitation = {
  workspaceId: 'test-workspace-123',
  inviterUsername: 'owner',
  inviteeUsername: 'testuser',
  role: 'editor',
  joinCode: 'ABC12345',
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  status: 'pending'
};

async function testCollaborationSystem() {
  console.log('🧪 Testing Team Collaboration System...\n');

  try {
    // Test 1: User validation
    console.log('1. Testing user validation...');
    const validationResponse = await axios.post(`${BASE_URL}/users/validate`, {
      username: testUser.username
    });
    console.log('✅ User validation:', validationResponse.data);

    // Test 2: Create invitation
    console.log('\n2. Testing invitation creation...');
    const invitationResponse = await axios.post(`${BASE_URL}/invitations`, testInvitation);
    console.log('✅ Invitation created:', invitationResponse.data);

    // Test 3: Validate join code
    console.log('\n3. Testing join code validation...');
    const codeValidationResponse = await axios.post(`${BASE_URL}/invitations/validate`, {
      joinCode: testInvitation.joinCode
    });
    console.log('✅ Join code validation:', codeValidationResponse.data);

    // Test 4: Update invitation status
    console.log('\n4. Testing invitation status update...');
    const updateResponse = await axios.put(`${BASE_URL}/invitations/${invitationResponse.data.id}`, {
      status: 'accepted'
    });
    console.log('✅ Invitation status updated:', updateResponse.data);

    // Test 5: Create member
    console.log('\n5. Testing member creation...');
    const memberResponse = await axios.post(`${BASE_URL}/members`, {
      workspaceId: testInvitation.workspaceId,
      id: 'member-123',
      username: testUser.username,
      role: testInvitation.role,
      joinedAt: new Date().toISOString()
    });
    console.log('✅ Member created:', memberResponse.data);

    // Test 6: Get members
    console.log('\n6. Testing member retrieval...');
    const membersResponse = await axios.get(`${BASE_URL}/members?workspaceId=${testInvitation.workspaceId}`);
    console.log('✅ Members retrieved:', membersResponse.data);

    console.log('\n🎉 All collaboration tests passed!');
    console.log('\n📋 Summary:');
    console.log('- User validation: ✅');
    console.log('- Invitation creation: ✅');
    console.log('- Join code validation: ✅');
    console.log('- Invitation status update: ✅');
    console.log('- Member creation: ✅');
    console.log('- Member retrieval: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    console.log('\n🔍 Debug information:');
    console.log('- Status:', error.response?.status);
    console.log('- Headers:', error.response?.headers);
    console.log('- Data:', error.response?.data);
  }
}

// Run the test
testCollaborationSystem();