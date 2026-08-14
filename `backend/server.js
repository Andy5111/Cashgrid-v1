require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const db = new sqlite3.Database('./database.db');

const MINERS_CONFIG = {
 1:{price:5000,daily:500,total:10000,term:20},
 2:{price:10000,daily:1000,total:20000,term:20},
}

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE,password TEXT,balance INTEGER DEFAULT 500,commission INTEGER DEFAULT 0,ref_code TEXT UNIQUE,referred_by TEXT,ref_earnings INTEGER DEFAULT 0,has_deposited INTEGER DEFAULT 0,has_purchased INTEGER DEFAULT 0)`);
  db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,type TEXT,amount INTEGER,note TEXT,status TEXT,date DATETIME DEFAULT CURRENT_TIMESTAMP)`);
  db.run(`CREATE TABLE IF NOT EXISTS miners (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,miner_id INTEGER,profit INTEGER,buy_date INTEGER,last_claim INTEGER,days_earned INTEGER DEFAULT 0,active INTEGER DEFAULT 1)`);
  db.run(`CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER,amount INTEGER,tax INTEGER,total INTEGER,bank TEXT,account TEXT,name TEXT,status TEXT DEFAULT 'pending',date DATETIME DEFAULT CURRENT_TIMESTAMP)`);
});

function auth(req,res,next){const token = req.headers['authorization'];if(!token) return res.status(401).json({msg:"No token"});try{ req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }catch{return res.status(401).json({msg:"Invalid token"})}}
function adminAuth(req,res,next){if(req.user.email!== process.env.ADMIN_EMAIL) return res.status(403).json({msg:"Admin only"});next();}

app.post('/api/register', async (req,res)=>{const {email,password,refCode} = req.body;const hash = await bcrypt.hash(password,10);const ref_code = email.split('@')[0]+Math.floor(Math.random()*1000);db.run(`INSERT INTO users (email,password,ref_code,referred_by) VALUES (?,?,?,?)`,[email,hash,ref_code,refCode], function(err){if(err) return res.status(400).json({msg:"Email exists"});db.run(`INSERT INTO transactions (user_id,type,amount,note,status) VALUES (?,?,?,?,?)`,[this.lastID,'deposit',500,'Signup Bonus','completed']);const token = jwt.sign({id:this.lastID,email},process.env.JWT_SECRET);res.json({token})})})

app.post('/api/login', (req,res)=>{const {email,password} = req.body;db.get(`SELECT * FROM users WHERE email=?`,[email], async (err,user)=>{if(!user) return res.status(400).json({msg:"Invalid"});const ok = await bcrypt.compare(password,user.password);if(!ok) return res.status(400).json({msg:"Invalid"});const token = jwt.sign({id:user.id,email},process.env.JWT_SECRET);res.json({token})})})

app.get('/api/me',auth,(req,res)=>{db.get(`SELECT * FROM users WHERE id=?`,[req.user.id],(err,user)=>{db.all(`SELECT * FROM miners WHERE user_id=?`,[req.user.id],(err,miners)=>{db.all(`SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC LIMIT 100`,[req.user.id],(err,tx)=>{res.json({...user, miners, transactions: tx})

app.post('/api/deposit',auth,(req,res)=>{const {amount} = req.body;if(amount<5000) return res.status(400).json({msg:"Min 5000"});db.run(`UPDATE users SET balance=balance+?,has_deposited=1 WHERE id=?`,[amount,req.user.id]);db.run(`INSERT INTO transactions (user_id,type,amount,note,status) VALUES (?,?,?,?,?)`,[req.user.id,'deposit',amount,'Manual Deposit','completed']);res.json({msg:"Deposited"})})

app.post('/api/withdraw',auth,(req,res)=>{const {amount,bank,account,name} = req.body;if(amount<1000) return res.status(400).json({msg:"Min 1000"});db.get(`SELECT * FROM users WHERE id=?`,[req.user.id],(err,user)=>{if(!user.has_deposited ||!user.has_purchased)return res.status(403).json({msg:"Deposit and Buy miner first"});if(amount>user.balance) return res.status(400).json({msg:"Insufficient"});const tax = Math.round(amount*0.18);const receive = amount-tax;db.run(`UPDATE users SET balance=balance-? WHERE id=?`,[amount,req.user.id]);db.run(`INSERT INTO withdrawals (user_id,amount,tax,total,bank,account,name) VALUES (?,?,?,?,?,?,?)`,[req.user.id,receive,tax,amount,bank,account,name]);db.run(`INSERT INTO transactions (user_id,type,amount,note,status) VALUES (?,?,?,?,?)`,[req.user.id,'withdraw',receive,`To ${bank} - ${account}`,'pending']);res.json({msg:"Withdrawal pending approval"})})})

app.post('/api/buy-miner',auth,(req,res)=>{const {minerId,price} = req.body;db.get(`SELECT * FROM users WHERE id=?`,[req.user.id],(err,user)=>{if(price>user.balance) return res.status(400).json({msg:"Insufficient"});db.run(`UPDATE users SET balance=balance-?,has_purchased=1 WHERE id=?`,[price,req.user.id]);db.run(`INSERT INTO miners (user_id,miner_id,profit,buy_date,last_claim) VALUES (?,?,?,?,?)`,[req.user.id,minerId,MINERS_CONFIG[minerId].daily,Date.now(),Date.now()]);db.run(`INSERT INTO transactions (user_id,type,amount,note,status) VALUES (?,?,?,?,?)`,[req.user.id,'purchase',price,`Miner ${minerId}`,'completed']);res.json({msg:"Miner bought"})})})

// ========== PAYSTACK v1.1 ==========
app.post('/api/paystack/init', auth, async (req,res)=>{
  const {amount} = req.body; 
  if(amount < 5000) return res.status(400).json({msg:"Min ₦5000"});
  try{
    const response = await axios.post('https://api.paystack.co/transaction/initialize',{
      email: req.user.email, amount: amount*100
    },{ headers:{Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`} })
    res.json({url: response.data.data.authorization_url, reference: response.data.data.reference})
  }catch(e){res.status(500).json({msg:"Paystack error"})}}
)

app.post('/api/paystack/verify', auth, async (req,res)=>{
  const {reference} = req.body;
  try{
    const response = await axios.get(`https://api.paystack.co/transaction/verify/${reference}`,{
      headers:{Authorization: `Bearer ${process.env.PAYSTACK_SECRET}`}
    })
    if(response.data.data.status === 'success'){
      const amount = response.data.amount / 100;
      db.run(`UPDATE users SET balance=balance+?,has_deposited=1 WHERE id=?`,[amount,req.user.id]);
      db.run(`INSERT INTO transactions (user_id,type,amount,note,status) VALUES (?,?,?,?,?)`,[req.user.id,'deposit',amount,'Paystack Deposit','completed'])
      res.json({msg:"Deposit successful"})
    } else {res.status(400).json({msg:"Payment not successful"})}
  }catch(e){res.status(500).json({msg:"Verify error"})}}
)

// ========== ADMIN PANEL v1.1 ==========
app.get('/api/admin/pending', auth, adminAuth, (req,res)=>{
  db.all(`SELECT w.*,u.email FROM withdrawals w JOIN users u ON w.user_id=u.id WHERE w.status='pending'`,(err,rows)=>{
    res.json(rows)
  })
})

app.post('/api/admin/approve', auth, adminAuth, (req,res)=>{
  const {withdrawId} = req.body;
  db.run(`UPDATE withdrawals SET status='approved' WHERE id=?`,[withdrawId]);
  db.run(`UPDATE transactions SET status='approved' WHERE type='withdraw' AND id=?`,[withdrawId]);
  res.json({msg:"Approved"})
})

app.post('/api/admin/reject', auth, adminAuth, (req,res)=>{
  const {withdrawId} = req.body;
  db.get(`SELECT * FROM withdrawals WHERE id=?`,[withdrawId],(err,w)=>{
    db.run(`UPDATE users SET balance=balance+? WHERE id=?`,[w.total,w.user_id]);
    db.run(`UPDATE withdrawals SET status='rejected' WHERE id=?`,[withdrawId]);
    res.json({msg:"Rejected and refunded"})
  })
})

app.listen(3000,()=>console.log("CashGrid Backend v1.1 running"))
