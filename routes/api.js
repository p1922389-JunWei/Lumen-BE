const { Router } = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = Router();

// Import pool from db
const { pool } = require('../db');

// ==================== MIDDLEWARE ====================

// Verify JWT token middleware
const verifyToken = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, error: 'Authorization header missing' });
        }
        
        const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your_secret_key_change_in_production');
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }
};

// ==================== USER CRUD ====================

// GET all users
router.get('/users', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [users] = await connection.query('SELECT * FROM User');
        connection.release();
        res.json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET single user
router.get('/users/:userID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [user] = await connection.query('SELECT * FROM User WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, data: user[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE user
router.post('/users', async (req, res) => {
    try {
        const { fullName, NRIC, role, image_url } = req.body;
        const connection = await pool.getConnection();
        const [result] = await connection.query(
            'INSERT INTO User (fullName, NRIC, role, image_url) VALUES (?, ?, ?, ?)',
            [fullName, NRIC, role, image_url]
        );
        connection.release();
        res.status(201).json({ success: true, userID: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UPDATE user
router.put('/users/:userID', async (req, res) => {
    try {
        const { fullName, NRIC, role, image_url } = req.body;
        const connection = await pool.getConnection();
        await connection.query(
            'UPDATE User SET fullName = ?, NRIC = ?, role = ?, image_url = ? WHERE userID = ?',
            [fullName, NRIC, role, image_url, req.params.userID]
        );
        connection.release();
        res.json({ success: true, message: 'User updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE user
router.delete('/users/:userID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM User WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== AUTHENTICATION ====================

// LOGIN - Staff authentication
router.post('/login', async (req, res) => {
    try {
        const { NRIC, password } = req.body;
        
        if (!NRIC || !password) {
            return res.status(400).json({ success: false, error: 'NRIC and password are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Get user and password hash from database
        const [users] = await connection.query(
            'SELECT u.userID, u.fullName, u.NRIC, u.role, u.image_url, s.password FROM User u JOIN Staff s ON u.userID = s.userID WHERE u.NRIC = ?',
            [NRIC]
        );
        
        connection.release();
        
        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid NRIC or password' });
        }
        
        const user = users[0];
        
        // Compare provided password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid NRIC or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userID: user.userID, 
                NRIC: user.NRIC, 
                role: user.role 
            },
            process.env.JWT_SECRET || 'your_secret_key_change_in_production',
            { expiresIn: '24h' }
        );
        
        // Return user info and token (exclude password)
        res.json({ 
            success: true, 
            token,
            data: {
                userID: user.userID,
                fullName: user.fullName,
                NRIC: user.NRIC,
                role: user.role,
                image_url: user.image_url
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PARTICIPANT CRUD ====================

// GET all participants
router.get('/participants', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [participants] = await connection.query(
            'SELECT u.*, p.created_at FROM Participant p JOIN User u ON p.userID = u.userID'
        );
        connection.release();
        res.json({ success: true, data: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE participant
router.post('/participants', async (req, res) => {
    try {
        const { fullName, NRIC, image_url } = req.body;
        const connection = await pool.getConnection();
        
        // Insert into User table
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, NRIC, role, image_url) VALUES (?, ?, ?, ?)',
            [fullName, NRIC, 'participant', image_url]
        );
        
        // Insert into Participant table
        await connection.query('INSERT INTO Participant (userID) VALUES (?)', [userResult.insertId]);
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE participant
router.delete('/participants/:userID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM Participant WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'Participant deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== VOLUNTEERS CRUD ====================

// GET all volunteers
router.get('/volunteers', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [volunteers] = await connection.query(
            'SELECT u.*, v.created_at FROM Volunteers v JOIN User u ON v.userID = u.userID'
        );
        connection.release();
        res.json({ success: true, data: volunteers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE volunteer
router.post('/volunteers', async (req, res) => {
    try {
        const { fullName, NRIC, image_url } = req.body;
        const connection = await pool.getConnection();
        
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, NRIC, role, image_url) VALUES (?, ?, ?, ?)',
            [fullName, NRIC, 'volunteer', image_url]
        );
        
        await connection.query('INSERT INTO Volunteers (userID) VALUES (?)', [userResult.insertId]);
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE volunteer
router.delete('/volunteers/:userID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM Volunteers WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'Volunteer deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== STAFF CRUD ====================

// GET all staff
router.get('/staff', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [staff] = await connection.query(
            'SELECT u.userID, u.fullName, u.NRIC, u.role, u.image_url, s.created_at FROM Staff s JOIN User u ON s.userID = u.userID'
        );
        connection.release();
        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE staff
router.post('/staff', async (req, res) => {
    try {
        const { fullName, NRIC, password, image_url } = req.body;
        const connection = await pool.getConnection();
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, NRIC, role, image_url) VALUES (?, ?, ?, ?)',
            [fullName, NRIC, 'staff', image_url]
        );
        
        await connection.query('INSERT INTO Staff (userID, password) VALUES (?, ?)', 
            [userResult.insertId, hashedPassword]);
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UPDATE staff password
router.put('/staff/:userID', async (req, res) => {
    try {
        const { password } = req.body;
        const connection = await pool.getConnection();
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await connection.query('UPDATE Staff SET password = ? WHERE userID = ?', 
            [hashedPassword, req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'Staff updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE staff
router.delete('/staff/:userID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM Staff WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'Staff deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== EVENT CRUD ====================

// GET all events
router.get('/events', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [events] = await connection.query('SELECT * FROM Event ORDER BY datetime DESC');
        connection.release();
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET single event
router.get('/events/:eventID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [event] = await connection.query('SELECT * FROM Event WHERE eventID = ?', [req.params.eventID]);
        connection.release();
        res.json({ success: true, data: event[0] });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// CREATE event
router.post('/events', verifyToken, async (req, res) => {
    try {
        const { eventName, eventDescription, disabled_friendly, datetime, location, additional_information } = req.body;
        const created_by = req.user.userID;
        
        const connection = await pool.getConnection();
        
        // Check if user has staff role (already verified in token, but double-check)
        const [user] = await connection.query('SELECT role FROM User WHERE userID = ?', [created_by]);
        
        if (!user || user.length === 0) {
            connection.release();
            return res.status(401).json({ success: false, error: 'User not found' });
        }
        
        if (user[0].role !== 'staff') {
            connection.release();
            return res.status(403).json({ success: false, error: 'Only staff members can create events' });
        }
        
        // Create event
        const [result] = await connection.query(
            'INSERT INTO Event (eventName, eventDescription, disabled_friendly, datetime, location, additional_information, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [eventName, eventDescription, disabled_friendly, datetime, location, additional_information, created_by]
        );
        connection.release();
        res.status(201).json({ success: true, eventID: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// UPDATE event
router.put('/events/:eventID', async (req, res) => {
    try {
        const { eventName, eventDescription, disabled_friendly, datetime, location, additional_information } = req.body;
        const connection = await pool.getConnection();
        await connection.query(
            'UPDATE Event SET eventName = ?, eventDescription = ?, disabled_friendly = ?, datetime = ?, location = ?, additional_information = ? WHERE eventID = ?',
            [eventName, eventDescription, disabled_friendly, datetime, location, additional_information, req.params.eventID]
        );
        connection.release();
        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE event
router.delete('/events/:eventID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query('DELETE FROM Event WHERE eventID = ?', [req.params.eventID]);
        connection.release();
        res.json({ success: true, message: 'Event deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PARTICIPANT EVENT CRUD ====================

// GET participants for an event
router.get('/events/:eventID/participants', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [participants] = await connection.query(
            'SELECT u.*, pe.signed_at FROM ParticipantEvent pe JOIN User u ON pe.participantID = u.userID WHERE pe.eventID = ?',
            [req.params.eventID]
        );
        connection.release();
        res.json({ success: true, data: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET events for a participant
router.get('/participants/:participantID/events', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [events] = await connection.query(
            'SELECT e.*, pe.signed_at FROM ParticipantEvent pe JOIN Event e ON pe.eventID = e.eventID WHERE pe.participantID = ?',
            [req.params.participantID]
        );
        connection.release();
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PARTICIPANT SIGNS EVENT
router.post('/participant-events', async (req, res) => {
    try {
        const { participantID, eventID } = req.body;
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO ParticipantEvent (participantID, eventID) VALUES (?, ?)',
            [participantID, eventID]
        );
        connection.release();
        res.status(201).json({ success: true, message: 'Participant signed to event' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PARTICIPANT UNREGISTER FROM EVENT
router.delete('/participant-events/:participantID/:eventID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query(
            'DELETE FROM ParticipantEvent WHERE participantID = ? AND eventID = ?',
            [req.params.participantID, req.params.eventID]
        );
        connection.release();
        res.json({ success: true, message: 'Participant removed from event' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== VOLUNTEER EVENT CRUD ====================

// GET volunteers for an event
router.get('/events/:eventID/volunteers', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [volunteers] = await connection.query(
            'SELECT u.*, ve.signed_at FROM VolunteerEvent ve JOIN User u ON ve.volunteerID = u.userID WHERE ve.eventID = ?',
            [req.params.eventID]
        );
        connection.release();
        res.json({ success: true, data: volunteers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET events for a volunteer
router.get('/volunteers/:volunteerID/events', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [events] = await connection.query(
            'SELECT e.*, ve.signed_at FROM VolunteerEvent ve JOIN Event e ON ve.eventID = e.eventID WHERE ve.volunteerID = ?',
            [req.params.volunteerID]
        );
        connection.release();
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// VOLUNTEER SIGNS EVENT
router.post('/volunteer-events', async (req, res) => {
    try {
        const { volunteerID, eventID } = req.body;
        const connection = await pool.getConnection();
        await connection.query(
            'INSERT INTO VolunteerEvent (volunteerID, eventID) VALUES (?, ?)',
            [volunteerID, eventID]
        );
        connection.release();
        res.status(201).json({ success: true, message: 'Volunteer signed to event' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// VOLUNTEER UNREGISTER FROM EVENT
router.delete('/volunteer-events/:volunteerID/:eventID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        await connection.query(
            'DELETE FROM VolunteerEvent WHERE volunteerID = ? AND eventID = ?',
            [req.params.volunteerID, req.params.eventID]
        );
        connection.release();
        res.json({ success: true, message: 'Volunteer removed from event' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
