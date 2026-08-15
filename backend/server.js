const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI).then(() => console.log('MongoDB Connected'));

// MODELS
const UserSchema = new mongoose.Schema({
  name: String, email: {type: String, unique: true}, phone: String, password: String,
  balance: {type: Number, default: 500}, commission: {type: Number, default: 0},
  refCode: String, referredBy: String, refEarnings: {type: Number, default: 0},
  miners: {type: Array, default: []},
  transactions: {type: Array, default: []},
  pendingWithdrawals: {type: Array, default: []}
});
const User = mongoose.model('User', UserSchema);

const MINERS = [
 {id:1,name:"Cashgrid S1",price:5000,daily:500,total:10000,term:20,limit:20},
 {id:2,name:"Cashgrid S2",price:10000,daily:1000,total:20000,term:20,limit:10},
 {id:3,name:"Cashgrid S3",price:30000,daily:3000,total:60000,term:20,limit:5},
 {id:4,name:"Cashgrid S4",price:70000,daily:7000,total:140000,term:20,limit:3},
 {id:5,name:"Cashgrid S5",price:120000,daily:12000,total:240000,term:20,limit:3},
 {id:6,name:"Cashgrid S6",price:200000,daily:20000,total:400000,term:20,limit:3},
 {id:7,name:"Cashgrid S7 Pro",price:300000,daily:30000,total:600000,term:20,limit:3}
]
const COMMISSIONS = [0.20, 0.05, 0.02]
const ADMIN_EMAIL = "andrewdauda555@gmail.com"

// MIDDLEWARE
const auth = async (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) return res.status(401).json({ msg: 'No token' });
  try { const decoded = jwt.verify(token, process.env.JWT_SECRET); req.user = decoded.user; next(); }
  catch (err) { res.status(401).json({ msg: 'Token invalid' }); }
};

// ROUTES
app.post('/api/register', async (req, res) => {
  const { name, email, phone, password, refCode } = req.body;
  let user = await User.findOne({ email }); if (user) return res.status(400).json({ msg: 'Email exists' });
  const hashedPassword = await bcrypt.hash(password, 10);
  const newRefCode = email.split('@')[0]+Math.floor(Math.random()*1000);
  user = new User({ name, email, phone, password: hashedPassword, refCode: newRefCode, referredBy: refCode, transactions: [{id:Date.now(),date:new Date().toLocaleString(),type:"deposit",amount:500,note:"Signup Bonus",status:"completed"}] });
  if(refCode){ let refUser = await User.findOne({refCode}); if(refUser){ refUser.referrals = [...(refUser.referrals||[]), newRefCode]; await refUser.save(); } }
  await user.save();
  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  let user = await User.findOne({ email }); if (!user) return res.status(400).json({ msg: 'Invalid credentials' });
  const isMatch = await bcrypt.compare(password, user.password); if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });
  const token = jwt.sign({ user: { id: user.id } }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user });
});

app.get('/api/me', auth, async (req, res) => { const user = await User.findById(req.user.id).select('-password'); res.json(user); });

app.post('/api/wallet/fund', auth, async (req, res) => {
  const { amount } = req.body; const user = await User.findById(req.user.id);
  user.balance += Number(amount);
  user.transactions.unshift({id: Date.now(), date:new Date().toLocaleString(),type:"deposit",amount,note:"Manual Deposit",status:"completed"});
  await user.save(); res.json({ msg: 'Funded', balance: user.balance });
});

app.post('/api/buy-miner', auth, async (req, res) => {
  const { minerId } = req.body; const user = await User.findById(req.user.id); const m = MINERS.find(x=>x.id===minerId);
  const owned = user.miners.filter(x=>x.id===minerId).length; if(owned >= m.limit) return res.status(400).json({ msg: `Limit ${m.limit}` });
  if(user.balance < m.price) return res.status(400).json({ msg: 'Insufficient balance' });
  user.balance -= m.price;
  user.miners.push({id: minerId, profit: m.daily, buyDate: Date.now(), lastClaim: Date.now(), daysEarned: 0, active: true});
  user.transactions.unshift({id: Date.now(), date:new Date().toLocaleString(),type:"purchase",amount:m.price,note:m.name,status:"completed"});
  // Pay referral
  let currentCode = user.referredBy; let level = 0;
  while(currentCode && level < 3){
    let refUser = await User.findOne({refCode: currentCode}); if(!refUser) break;
    let commission = m.price * COMMISSIONS[level];
    refUser.commission += commission; refUser.refEarnings += commission;
    refUser.transactions.unshift({id: Date.now()+level, date:new Date().toLocaleString(),type:"referral",amount:commission,note:`L${level+1} from ${user.email}`,status:"completed"});
    await refUser.save(); currentCode = refUser.referredBy; level++;
  }
  await user.save(); res.json({ msg: 'Miner Purchased' });
});

app.post('/api/withdraw', auth, async (req, res) => {
  const { amount, bankName, accountNo, accountName } = req.body; const user = await User.findById(req.user.id);
  if(amount < 1000) return res.status(400).json({ msg: 'Min 1000' }); if(amount > user.balance) return res.status(400).json({ msg: 'Insufficient' });
  let tax = Math.round(amount * 0.18); let receiveAmt = amount - tax;
  user.balance -= amount;
  const tx = {id: Date.now(), date:new Date().toLocaleString(),type:"withdraw",amount:receiveAmt,note:`To ${bankName} - ${accountNo} | Tax: ${tax}`,status:"pending"};
  user.transactions.unshift(tx);
  user.pendingWithdrawals.push({txId: tx.id, amount: receiveAmt, tax, total: amount, bank: bankName, account: accountNo, name: accountName, date: new Date().toLocaleString(), status: "pending"});
  await user.save(); res.json({ msg: 'Withdrawal submitted' });
});

// ADMIN ROUTES
app.get('/api/admin/users', auth, async (req, res) => {
  const admin = await User.findById(req.user.id); if(admin.email!== ADMIN_EMAIL) return res.status(403).json({msg: 'No access'});
  const users = await User.find().select('-password'); res.json(users);
});
app.post('/api/admin/approve', auth, async (req, res) => {
  const { userEmail, txId } = req.body; const user = await User.findOne({email: userEmail});
  user.pendingWithdrawals = user.pendingWithdrawals.filter(w=>w.txId!==txId);
  user.transactions = user.transactions.map(t=> t.id===txId? {...t,status:"approved"} : t); await user.save(); res.json({msg: 'Approved'});
});
app.post('/api/admin/reject', auth, async (req, res) => {
  const { userEmail, txId } = req.body; const user = await User.findOne({email: userEmail});
  let w = user.pendingWithdrawals.find(w=>w.txId===txId);
  user.balance += w.total; user.pendingWithdrawals = user.pendingWithdrawals.filter(w=>w.txId!==txId);
  user.transactions = user.transactions.map(t=> t.id===txId? {...t,status:"rejected"} : t); await user.save(); res.json({msg: 'Rejected'});
});

app.get('/', (req, res) => res.send('Cashgrid API Running'));
const PORT = process.env.PORT || 5000; app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
