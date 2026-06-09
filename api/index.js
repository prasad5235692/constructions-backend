const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/db');

let cachedDb = null;

async function ensureDB() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  try {
    cachedDb = await connectDB();
    return cachedDb;
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error.message);
    throw error;
  }
}

module.exports = async (req, res) => {
  try {
    await ensureDB();
  } catch {
    return res.status(503).json({ message: 'Database connection unavailable' });
  }
  return app(req, res);
};
