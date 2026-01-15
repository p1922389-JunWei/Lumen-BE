require('dotenv').config();
const { createServer } = require('node:http');
const mysql = require('mysql2/promise');

const hostname = '127.0.0.1';
const port = 3001;

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true
});

// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connection successful!');
        connection.release();
    })
    .catch(error => {
        console.error('❌ Database connection failed:', error.message);
        console.error('📌 Make sure Cloud SQL Proxy is running: /opt/homebrew/Cellar/cloud-sql-proxy/2.20.0/bin/cloud-sql-proxy h4good-good-people:asia-southeast1:h4good');
    });

const server = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    
    try {
        // Example: Query the database
        const connection = await pool.getConnection();
        const [rows] = await connection.query('SELECT 1 as test');
        connection.release();
        
        res.statusCode = 200;
        res.end(JSON.stringify({ success: true, data: rows }));
    } catch (error) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: error.message }));
    }
});

server.listen(port, hostname, () => {
    console.log(`🚀 Server running at http://${hostname}:${port}/`);
});