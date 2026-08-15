const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware
app.use(cors()); // allows your HTML frontend to connect
app.use(express.json());

// Test Route
app.get('/', (req, res) => {
  res.json({ msg: 'CashGrid API Running' });
});

// Example: Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // TODO: Save user to database here
    res.json({ msg: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Example: Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // TODO: Check user in database here
    
    // Create JWT Token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Example: Paystack Payment Route
app.post('/api/pay', async (req, res) => {
  try {
    const { email, amount } = req.body;
    const response = await axios.post(
      'https://api.paystack.co/transaction/initialize',
      { email, amount: amount * 100 }, // Paystack uses kobo
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
    );
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: 'Payment error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
