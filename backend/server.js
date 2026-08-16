const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const app = express();

app.use(cors());
app.use(express.json());

// TEMP DB - Replace with MongoDB later
let USERS = { "andrewdauda555@gmail.com": { balance: 0 } } 

const PAYHUB_SECRET = process.env.PAYHUB_SECRET_KEY; // We will set this in Render

// 1. CREATE PAYMENT LINK
app.post('/api/create-payment', async (req, res) => {
  const { email, amount, reference } = req.body;
  
  if(!PAYHUB_SECRET) return res.status(500).json({error: "Secret key not set"})

  try {
    const response = await fetch('https://api.payhub.com.ng/v1/transactions/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYHUB_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: email,
        amount: amount * 100, // Convert to kobo
        reference: reference,
        callback_url: `https://cashgrid-v1.onrender.com/api/webhook/payhub`,
        currency: "NGN"
      })
    });
    
    const data = await response.json();
    console.log("Payhub Response:", data)
    
    if(data.status === true){
      res.json({ payment_url: data.data.authorization_url });
    } else {
      res.status(400).json({ error: data.message });
    }
    
  } catch(err){
    res.status(500).json({ error: err.message });
  }
});

// 2. WEBHOOK - Payhub calls this after payment
app.post('/api/webhook/payhub', async (req, res) => {
  const data = req.body;
  console.log("WEBHOOK HIT:", data)
  
  if(data.event === 'charge.success'){
    const { customer, amount, reference } = data.data;
    const email = customer.email;
    const nairaAmount = amount / 100;
    
    if(USERS[email]){
      USERS[email].balance += nairaAmount;
      console.log(`Credited ${email} with ${nairaAmount}. New balance: ${USERS[email].balance}`)
    }
  }
  
  res.status(200).json({ status: "success" });
});

// 3. GET BALANCE
app.get('/api/user', (req, res) => {
  const email = req.headers['x-user-email'];
  res.json({ balance: USERS[email]?.balance || 0 })
})

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
