const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// TEMP: Replace with your real DB later
let USERS = { "test@test.com": { balance: 0 } } 

// 1. CREATE PAYMENT LINK - redirects to your static Payhub link
app.post('/api/create-payment', async (req, res) => {
  const { email, amount, reference } = req.body;
  
  // 1. Save pending deposit
  console.log("New deposit:", {email, amount, reference, status: "pending"})

  // 2. Redirect to your static payhub link with amount
  const payment_url = `https://checkout.juntpay.top/cashier/bank-transfer/7abb7f99f765950f7833c7118b031fae888d4ee78438f03d9282ac8680760200a22485f626ef06c17f3243b96ffb6ec3?amount=${amount}&email=${email}&reference=${reference}`
  
  res.json({ payment_url });
});

// 2. WEBHOOK - Payhub will call this when payment is successful
app.post('/api/webhook/payhub', async (req, res) => {
  const data = req.body;
  console.log("WEBHOOK RECEIVED:", data)

  // Payhub sends status, amount, reference, email
  if(data.status === 'success' || data.status === 'paid'){
    const { email, amount, reference } = data;
    
    // 1. Credit user balance
    if(USERS[email]){
      USERS[email].balance += parseFloat(amount);
      console.log(`Credited ${email} with ${amount}. New balance: ${USERS[email].balance}`)
    }
    
    // 2. Mark reference as paid in DB so it doesn't credit twice
  }
  
  res.status(200).json({ received: true }); // MUST return 200
});

// 3. GET BALANCE
app.get('/api/user', (req, res) => {
  const email = req.headers['x-user-email'];
  res.json({ balance: USERS[email]?.balance || 0 })
})

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
