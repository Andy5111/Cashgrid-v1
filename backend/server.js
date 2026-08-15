const express = require('express');
const mongoose = require('mongoose');
const app = express();

// Middleware to read JSON
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('MongoDB Connected'))
.catch(err => console.log('MongoDB Error:', err));

// Test route
app.get('/', (req, res) => {
  res.send('CashGrid API is running...');
});

// PayHub route - we will fill this later
app.post('/api/pay', (req, res) => {
  res.json({ message: 'PayHub endpoint ready. Mongo connected.' });
});

// Port for Render
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
