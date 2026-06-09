const mongoose = require('mongoose');

let cachedClient = null;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (cachedClient) {
    return cachedClient;
  }

  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    cachedClient = conn.connection;
    return conn.connection;
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    throw error;
  }
}

module.exports = connectDB;
