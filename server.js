require('dotenv').config();
const { createServer } = require('node:http');
const mysql = require('mysql2/promise');

const hostname = '127.0.0.1';
const port = 3001;

// Create a connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
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
    console.log(`Server running at http://${hostname}:${port}/`);
});