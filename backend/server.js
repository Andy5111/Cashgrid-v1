require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ENV Variables
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

// Test Route
app.get('/', (req, res) => {
  res.json({ msg: 'CashGrid API Running' });
});

// Health Check for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Example Login Route
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  // Simple admin login for testing
  if(email === ADMIN_EMAIL && password === 'admin123') {
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
    return res.json({ token });
  }
  res.status(401).json({ msg: 'Invalid credentials' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`CashGrid API running on port ${PORT}`);
});
