const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

async function testConnections() {
  console.log('🔍 Testing connections...\n');

  // Test 1: Check if server is running
  try {
    console.log('1. Testing server connection...');
    const response = await axios.get('http://localhost:3000/health', { timeout: 5000 });
    console.log('✅ Server is running:', response.data);
  } catch (error) {
    console.log('❌ Server connection failed:', error.message);
    console.log('   Make sure to run: npm start');
    return;
  }

  // Test 2: Check MongoDB connection
  try {
    console.log('\n2. Testing MongoDB connection...');
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
    await mongoose.disconnect();
  } catch (error) {
    console.log('❌ MongoDB connection failed:', error.message);
    console.log('   Make sure MongoDB is running on:', process.env.DB_URI);
    return;
  }

  // Test 3: Test login endpoint
  try {
    console.log('\n3. Testing login endpoint...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      email: 'test@example.com',
      password: 'testpassword'
    }, { timeout: 5000 });
    console.log('✅ Login endpoint is accessible');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log('✅ Login endpoint is working (returned 401 for invalid credentials)');
    } else {
      console.log('❌ Login endpoint error:', error.message);
    }
  }

  console.log('\n🎉 Connection tests completed!');
}

testConnections().catch(console.error);