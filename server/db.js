const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_FILE = process.env.DATABASE_FILE || path.join(__dirname, 'data', 'db.sqlite');

// Ensure directory exists
const dir = path.dirname(DB_FILE);
if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new sqlite3.Database(DB_FILE);

db.serialize(()=>{
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        password TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        userId TEXT,
        total REAL,
        items TEXT,
        createdAt TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS carts (
        userId TEXT PRIMARY KEY,
        items TEXT
    )`);
});

module.exports = db;
