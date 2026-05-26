require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const path = require('path');
const db = require('./db');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const stripeLib = require('stripe');

const app = express();
const PORT = process.env.PORT || 3000;

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const stripe = STRIPE_SECRET_KEY ? stripeLib(STRIPE_SECRET_KEY) : null;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Passport serialization
passport.serializeUser((user, done)=> done(null, user.id));
passport.deserializeUser((id, done)=>{
    db.get('SELECT id, name, email FROM users WHERE id = ?', [id], (err,row)=>{
        if(err) return done(err);
        done(null, row);
    });
});

// Google Strategy (if configured)
if(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET){
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || ('http://localhost:'+PORT+'/auth/google/callback')
    }, (accessToken, refreshToken, profile, done)=>{
        // find or create user
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        db.get('SELECT * FROM users WHERE email = ?', [email], (err,row)=>{
            if(err) return done(err);
            if(row) return done(null, row);
            const id = 'u_'+Date.now();
            db.run('INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)', [id, profile.displayName || email.split('@')[0], email, 'google-oauth'], function(err){
                if(err) return done(err);
                db.get('SELECT id, name, email FROM users WHERE id = ?', [id], (err2, newRow)=> done(err2, newRow));
            });
        });
    }));
}

// Serve static files (frontend) - optional
app.use('/', express.static(path.join(__dirname, '..')));

// --- Auth endpoints ---
const { v4: uuidv4 } = require('uuid');

app.post('/api/signup', async (req, res)=>{
    const {name, email, password} = req.body;
    if(!email || !password) return res.status(400).json({error:'Email and password required'});
    db.get('SELECT id FROM users WHERE email = ?', [email], async (err,row)=>{
        if(err) return res.status(500).json({error:'DB error'});
        if(row) return res.status(409).json({error:'User exists'});
        const id = 'u_'+Date.now();
        const hash = await bcrypt.hash(password, 10);
        db.run('INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)', [id, name||email.split('@')[0], email, hash], function(err2){
            if(err2) return res.status(500).json({error:'DB insert error'});
            req.login({id}, ()=>{});
            res.json({id, name, email});
        });
    });
});

app.post('/api/login', (req,res)=>{
    const {email, password} = req.body;
    if(!email || !password) return res.status(400).json({error:'Email and password required'});
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err,row)=>{
        if(err) return res.status(500).json({error:'DB error'});
        if(!row) return res.status(404).json({error:'User not found'});
        const ok = await bcrypt.compare(password, row.password);
        if(!ok) return res.status(401).json({error:'Invalid credentials'});
        req.session.userId = row.id;
        res.json({id: row.id, name: row.name, email: row.email});
    });
});

app.post('/api/logout', (req,res)=>{
    req.session.destroy(()=> res.json({ok:true}));
});

app.get('/api/me', (req,res)=>{
    const id = req.session.userId;
    if(!id) return res.json({user: null});
    db.get('SELECT id, name, email FROM users WHERE id = ?', [id], (err,row)=>{
        if(err) return res.status(500).json({error:'DB error'});
        res.json({user: row});
    });
});

// --- Cart endpoints ---
app.get('/api/cart', (req,res)=>{
    const uid = req.session.userId || 'guest';
    db.get('SELECT items FROM carts WHERE userId = ?', [uid], (err,row)=>{
        if(err) return res.status(500).json({error:'DB error'});
        const items = row ? JSON.parse(row.items) : [];
        res.json({items});
    });
});

app.post('/api/cart', (req,res)=>{
    const uid = req.session.userId || 'guest';
    const items = req.body.items || [];
    db.run('INSERT OR REPLACE INTO carts (userId, items) VALUES (?,?)', [uid, JSON.stringify(items)], function(err){
        if(err) return res.status(500).json({error:'DB error'});
        res.json({ok:true});
    });
});

// --- Orders & Stripe ---
app.post('/api/create-payment-intent', async (req,res)=>{
    if(!stripe) return res.status(500).json({error:'Stripe not configured'});
    const {items} = req.body;
    const amount = Math.round((items || []).reduce((s,i)=> s + (i.price||0),0) * 100);
    try{
        const paymentIntent = await stripe.paymentIntents.create({amount, currency:'eur'});
        res.json({clientSecret: paymentIntent.client_secret});
    }catch(err){
        res.status(500).json({error: err.message});
    }
});

app.post('/api/orders', (req,res)=>{
    const uid = req.session.userId || 'guest';
    const {items, total, paymentId} = req.body;
    const id = 'o_'+Date.now();
    db.run('INSERT INTO orders (id, userId, total, items, createdAt) VALUES (?,?,?,?,?)', [id, uid, total, JSON.stringify(items), new Date().toISOString()], function(err){
        if(err) return res.status(500).json({error:'DB error'});
        // clear cart
        db.run('DELETE FROM carts WHERE userId = ?', [uid]);
        res.json({id});
    });
});

// Stripe webhook (optional)
app.post('/webhook', express.raw({type: 'application/json'}), (req,res)=>{
    const sig = req.headers['stripe-signature'];
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if(!whSecret || !stripe) return res.status(400).send('Webhook not configured');
    let event;
    try{
        event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
    }catch(err){
        console.error('Webhook error', err.message); return res.status(400).send(`Webhook Error: ${err.message}`);
    }
    // handle event types
    if(event.type === 'payment_intent.succeeded'){
        console.log('Payment succeeded', event.data.object.id);
    }
    res.json({received:true});
});

// Google auth routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile','email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/inciarsession.html' }), (req,res)=>{
    // login success
    req.session.userId = req.user.id;
    res.redirect('/index.html');
});

app.listen(PORT, ()=>{
    console.log('Server running on port', PORT);
});
