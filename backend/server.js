require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const mongoose = require('mongoose');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET;
const PAYHUB_SECRET = process.env.PAYHUB_SECRET;
const MONGO_URI = process.env.MONGO_URI;

// Connect MongoDB
mongoose.connect(MONGO_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('Mongo Error:', err));

// Test Route
app.get('/', (req, res) => res.json({ msg: 'CashGrid API Running with PayHub' }));

// PAYHUB PAYMENT INIT
app.post('/api/pay', async (req, res) => {
  const { email, amount } = req.body; // amount in kobo. 50000 = N500
  try {
    const response = await axios.post('https://merchant.payhub.com.ng/api/v1/payments/initialize',
      { email, amount },
      { headers: { Authorization: `Bearer ${PAYHUB_SECRET}` } }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

// LOGIN
app.post('/api/login', (req, res) => {
  const { email } = req.body;
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
