require('dotenv').config();
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger');
const { pool } = require('./db');
const apiRoutes = require('./routes/api');

const app = express();
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});



// Test connection on startup
pool.getConnection()
    .then(connection => {
        console.log('✅ Database connection successful!');
        connection.release();
    })
    .catch(error => {
        console.error('❌ Database connection failed:', error.message);
        console.error('📌 Make sure Cloud SQL Proxy is running on port', process.env.DB_PORT || 3307);
    });

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ success: true, message: 'Server is running' });
});

// 404
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running at http://localhost:${port}/`);
    console.log(`📚 API Documentation: http://localhost:${port}/api-docs`);
    console.log(`   Users: GET/POST/PUT/DELETE /api/users`);
    console.log(`   Participants: GET/POST/DELETE /api/participants`);
    console.log(`   Volunteers: GET/POST/DELETE /api/volunteers`);
    console.log(`   Staff: GET/POST/PUT/DELETE /api/staff`);
    console.log(`   Events: GET/POST/PUT/DELETE /api/events`);
    console.log(`   ParticipantEvent: GET/POST/DELETE /api/participant-events`);
    console.log(`   VolunteerEvent: GET/POST/DELETE /api/volunteer-events`);
});
