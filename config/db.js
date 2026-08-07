const mongoose = require('mongoose');
require('dotenv').config();

// MongoDB connection
const connectMongoDB = async () => {
  try {
    await mongoose.connect(process.env.DB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
};

// MS Excel Online connection (via Microsoft Graph API)
const excelConfig = {
  clientId: process.env.MS365_CLIENT_ID,
  clientSecret: process.env.MS365_CLIENT_SECRET,
  tenantId: process.env.MS365_TENANT_ID,
  redirectUri: process.env.MS365_REDIRECT_URI,
};

// Supabase connection (optional)
const supabaseConfig = {
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY,
};

module.exports = {
  connectMongoDB,
  excelConfig,
  supabaseConfig,
};