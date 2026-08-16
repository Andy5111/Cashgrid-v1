const express = require('express');
const fetch = require('node-fetch'); // npm i node-fetch@2
const cors = require('cors'); // npm i cors
const app = express();

app.use(cors()); // allow frontend to call backend
app.use(express.json());

const PAYHUB_SECRET_KEY = process.env.PAYHUB_SECRET_KEY; // from Render env

// TEST ROUTE
app.get('/', (req, res) => {
  res.send('CASHGRID V1 Backend is running');
});

// CREATE PAYMENT LINK
app.post('/api/create-payment', async (req, res) => {
  const { email, amount, reference } = req.body;

  try {
    const response = await fetch('https://api.juntpay.top/v1/payment', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + PAYHUB_SECRET_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'NGN',
        email: email,
        reference: reference,
        redirect_url: 'https://ashgrid-v1.netlify.app' // change to your netlify url
      })
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// KEEP ALL YOUR OTHER ROUTES: /api/login, /api/register, /api/user, /api/withdraw etc HERE

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
