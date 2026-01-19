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

/**
 * @swagger
 * /api/me:
 *   get:
 *     summary: Get current user profile
 *     description: Retrieve the profile of the currently authenticated user based on their access token
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       500:
 *         description: Server error
 */
// GET current user from token
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userID = req.user.userID;
        const connection = await pool.getConnection();
        
        // Get base user info
        const [users] = await connection.query('SELECT * FROM User WHERE userID = ?', [userID]);
        
        if (!users || users.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const user = users[0];
        
        // Get additional info based on role
        let additionalInfo = {};
        
        if (user.role === 'staff') {
            const [staff] = await connection.query('SELECT email FROM Staff WHERE userID = ?', [userID]);
            if (staff && staff.length > 0) {
                additionalInfo.email = staff[0].email;
            }
        } else if (user.role === 'volunteer') {
            const [volunteer] = await connection.query('SELECT email FROM Volunteers WHERE userID = ?', [userID]);
            if (volunteer && volunteer.length > 0) {
                additionalInfo.email = volunteer[0].email;
            }
        } else if (user.role === 'participant') {
            const [participant] = await connection.query('SELECT phoneNumber, birthdate FROM Participant WHERE userID = ?', [userID]);
            if (participant && participant.length > 0) {
                additionalInfo.phoneNumber = participant[0].phoneNumber;
                additionalInfo.birthdate = participant[0].birthdate;
            }
        }
        
        connection.release();
        
        res.json({ 
            success: true, 
            data: {
                ...user,
                ...additionalInfo
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     description: Retrieve a list of all users in the system
 *     tags:
 *       - Users
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     description: Create a new user with basic information
 *     tags:
 *       - Users
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - role
 *             properties:
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [participant, volunteer, staff]
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userID:
 *                   type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// CREATE user
router.post('/users', async (req, res) => {
    try {
        const { fullName, role, image_url } = req.body;
        const connection = await pool.getConnection();
        const [result] = await connection.query(
            'INSERT INTO User (fullName, role, image_url) VALUES (?, ?, ?)',
            [fullName, role, image_url]
        );
        connection.release();
        res.status(201).json({ success: true, userID: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/users/{userID}:
 *   put:
 *     summary: Update own user profile
 *     description: Update user information (only for the authenticated user's own profile)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               image_url:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               birthdate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: User updated successfully
 *       403:
 *         description: Forbidden - can only update own profile
 *       500:
 *         description: Server error
 */
// UPDATE user (only own profile)
router.put('/users/:userID', verifyToken, async (req, res) => {
    try {
        // Only allow user to update their own profile
        if (req.user.userID !== parseInt(req.params.userID)) {
            return res.status(403).json({ success: false, error: 'You can only update your own profile' });
        }
        
        const { fullName, image_url, phoneNumber, birthdate } = req.body;
        const connection = await pool.getConnection();
        
        // Get user with participant details
        const [users] = await connection.query(
            `SELECT u.*, p.phoneNumber, p.birthdate 
             FROM User u 
             LEFT JOIN Participant p ON u.userID = p.userID 
             WHERE u.userID = ?`,
            [req.params.userID]
        );
        
        if (!users || users.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        const user = users[0];
        
        // Update User table (only update if provided, otherwise keep existing)
        await connection.query(
            'UPDATE User SET fullName = ?, image_url = ? WHERE userID = ?',
            [fullName || user.fullName, image_url !== undefined ? image_url : user.image_url, req.params.userID]
        );
        
        // Update Participant table if user is a participant
        if (user.role === 'participant') {
            await connection.query(
                'UPDATE Participant SET phoneNumber = ?, birthdate = ?, full_name = ? WHERE userID = ?',
                [phoneNumber || user.phoneNumber, birthdate || user.birthdate, fullName || user.fullName, req.params.userID]
            );
        }
        
        connection.release();
        res.json({ success: true, message: 'User updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/users/{userID}:
 *   delete:
 *     summary: Delete own user account
 *     description: Delete user account (only for the authenticated user's own account)
 *     tags:
 *       - Users
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       403:
 *         description: Forbidden - can only delete own account
 *       500:
 *         description: Server error
 */
// DELETE user (only own account)
router.delete('/users/:userID', verifyToken, async (req, res) => {
    try {
        // Only allow user to delete their own account
        if (req.user.userID !== parseInt(req.params.userID)) {
            return res.status(403).json({ success: false, error: 'You can only delete your own account' });
        }
        
        const connection = await pool.getConnection();
        
        // Delete from role-specific tables first (due to foreign key constraints)
        await connection.query('DELETE FROM Staff WHERE userID = ?', [req.params.userID]);
        await connection.query('DELETE FROM Volunteers WHERE userID = ?', [req.params.userID]);
        await connection.query('DELETE FROM Participant WHERE userID = ?', [req.params.userID]);
        
        // Delete from User table
        await connection.query('DELETE FROM User WHERE userID = ?', [req.params.userID]);
        connection.release();
        res.json({ success: true, message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== AUTHENTICATION ====================

/**
 * @swagger
 * /api/login:
 *   post:
 *     summary: Login staff/volunteer
 *     description: Authenticate a staff member or volunteer with email and password to receive a JWT token
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// LOGIN - Staff/Volunteer authentication with email and password
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Try to find in Staff table first
        let [users] = await connection.query(
            'SELECT u.userID, u.fullName, u.role, u.image_url, s.email, s.password FROM User u JOIN Staff s ON u.userID = s.userID WHERE s.email = ?',
            [email]
        );
        
        // If not found in Staff, try Volunteers table
        if (!users || users.length === 0) {
            [users] = await connection.query(
                'SELECT u.userID, u.fullName, u.role, u.image_url, v.email, v.password FROM User u JOIN Volunteers v ON u.userID = v.userID WHERE v.email = ?',
                [email]
            );
        }
        
        connection.release();
        
        if (!users || users.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        const user = users[0];
        
        // Compare provided password with hashed password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Invalid email or password' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userID: user.userID, 
                email: user.email, 
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
                email: user.email,
                role: user.role,
                image_url: user.image_url
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/participant/check-or-create:
 *   post:
 *     summary: Check or create participant
 *     description: Check if participant exists with given credentials, create if not, then send OTP
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - fullName
 *               - birthdate
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               fullName:
 *                 type: string
 *               birthdate:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 isNewUser:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       400:
 *         description: Missing required fields
 *       500:
 *         description: Server error
 */
// CHECK OR CREATE participant and send OTP
router.post('/participant/check-or-create', async (req, res) => {
    try {
        const { phoneNumber, fullName, birthdate } = req.body;
        
        if (!phoneNumber || !fullName || !birthdate) {
            return res.status(400).json({ success: false, error: 'Phone number, full name, and birthdate are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Check if phone number is already registered (phone is the unique identifier)
        const [existingParticipant] = await connection.query(
            `SELECT p.userID, p.phoneNumber, p.birthdate, u.fullName, u.role, u.image_url 
             FROM Participant p 
             JOIN User u ON p.userID = u.userID 
             WHERE p.phoneNumber = ?`,
            [phoneNumber]
        );
        
        let isNewUser = false;
        let user;
        
        if (!existingParticipant || existingParticipant.length === 0) {
            // Phone not registered - create new User and Participant
            isNewUser = true;
            
            try {
                // Create User first
                const [userResult] = await connection.query(
                    'INSERT INTO User (fullName, role, image_url) VALUES (?, ?, ?)',
                    [fullName, 'participant', '']
                );
                
                const newUserID = userResult.insertId;
                console.log('Created new User with ID:', newUserID);
                
                // Then create Participant with the new userID
                await connection.query(
                    'INSERT INTO Participant (userID, phoneNumber, birthdate, full_name) VALUES (?, ?, ?, ?)',
                    [newUserID, phoneNumber, birthdate, fullName]
                );
                
                user = {
                    userID: newUserID,
                    fullName: fullName,
                    phoneNumber: phoneNumber,
                    birthdate: birthdate,
                    role: 'participant'
                };
            } catch (insertError) {
                connection.release();
                console.error('Error creating user/participant:', insertError);
                return res.status(500).json({ success: false, error: 'Failed to create account: ' + insertError.message });
            }
        } else {
            // Phone exists - verify fullName and birthdate match
            const existing = existingParticipant[0];
            
            // Normalize dates for comparison (handle timezone issues)
            const existingDate = existing.birthdate;
            const existingBirthdate = existingDate ? 
                `${existingDate.getFullYear()}-${String(existingDate.getMonth() + 1).padStart(2, '0')}-${String(existingDate.getDate()).padStart(2, '0')}` : null;
            
            // Input birthdate comes as YYYY-MM-DD string from frontend
            const inputBirthdate = birthdate.split('T')[0];
            
            if (existing.fullName !== fullName || existingBirthdate !== inputBirthdate) {
                connection.release();
                return res.status(401).json({ 
                    success: false, 
                    error: 'Credentials do not match. Please check your name and birthdate.' 
                });
            }
            
            user = {
                userID: existing.userID,
                fullName: existing.fullName,
                phoneNumber: existing.phoneNumber,
                birthdate: existing.birthdate,
                role: existing.role
            };
        }
        
        connection.release();
        
        // In production, send actual OTP via SMS here
        // For demo, we'll just return success
        
        res.json({ 
            success: true, 
            isNewUser,
            message: isNewUser ? 'Account created. OTP sent!' : 'OTP sent!',
            userID: user.userID  // Used for OTP verification
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/login-otp:
 *   post:
 *     summary: Login with OTP
 *     description: Authenticate a participant with phone number and OTP
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Invalid OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 */
// LOGIN with OTP - Participant authentication
router.post('/login-otp', async (req, res) => {
    try {
        const { phone, otp } = req.body;
        
        if (!phone || !otp) {
            return res.status(400).json({ success: false, error: 'Phone and OTP are required' });
        }
        
        // Demo OTP validation - accept 123456
        if (otp !== '123456') {
            return res.status(401).json({ success: false, error: 'Invalid OTP' });
        }
        
        const connection = await pool.getConnection();
        
        // Find participant with this phone number (should exist from check-or-create)
        let [participants] = await connection.query(
            `SELECT u.userID, u.fullName, u.role, u.image_url, p.phoneNumber, p.birthdate 
             FROM User u 
             JOIN Participant p ON u.userID = p.userID 
             WHERE p.phoneNumber = ?`,
            [phone]
        );
        
        connection.release();
        
        if (!participants || participants.length === 0) {
            return res.status(401).json({ success: false, error: 'Participant not found. Please register first.' });
        }
        
        const user = participants[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { userID: user.userID, fullName: user.fullName, role: user.role },
            process.env.JWT_SECRET || 'your_secret_key_change_in_production',
            { expiresIn: '7d' }
        );
        
        // Return user info and token
        res.json({ 
            success: true, 
            token,
            data: {
                userID: user.userID,
                fullName: user.fullName,
                phone: user.phone || phone,
                role: user.role || 'participant'
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/login/participant:
 *   post:
 *     summary: Login participant
 *     description: Authenticate a participant with phone number, birthdate and full name
 *     tags:
 *       - Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *               - birthdate
 *               - fullName
 *             properties:
 *               phoneNumber:
 *                 type: string
 *               birthdate:
 *                 type: string
 *                 format: date
 *               fullName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Server error
 */
// LOGIN - Participant authentication with phone + birthdate + name
router.post('/login/participant', async (req, res) => {
    try {
        const { phoneNumber, birthdate, fullName } = req.body;
        
        if (!phoneNumber || !birthdate || !fullName) {
            return res.status(400).json({ success: false, error: 'Phone number, birthdate, and full name are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Find participant by phone number and verify birthdate and name
        const [participants] = await connection.query(
            `SELECT u.userID, u.fullName, u.role, u.image_url, p.phoneNumber, p.birthdate 
             FROM User u 
             JOIN Participant p ON u.userID = p.userID 
             WHERE p.phoneNumber = ? AND p.birthdate = ? AND u.fullName = ?`,
            [phoneNumber, birthdate, fullName]
        );
        
        connection.release();
        
        if (!participants || participants.length === 0) {
            return res.status(401).json({ success: false, error: 'Invalid credentials. Please check your phone number, birthdate, and name.' });
        }
        
        const participant = participants[0];
        
        // Generate JWT token
        const token = jwt.sign(
            { 
                userID: participant.userID, 
                phoneNumber: participant.phoneNumber, 
                role: participant.role 
            },
            process.env.JWT_SECRET || 'your_secret_key_change_in_production',
            { expiresIn: '24h' }
        );
        
        // Return participant info and token
        res.json({ 
            success: true, 
            token,
            data: {
                userID: participant.userID,
                fullName: participant.fullName,
                phoneNumber: participant.phoneNumber,
                role: participant.role,
                image_url: participant.image_url
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== PARTICIPANT CRUD ====================

/**
 * @swagger
 * /api/participants:
 *   get:
 *     summary: Get all participants
 *     description: Retrieve a list of all participants
 *     tags:
 *       - Participants
 *     responses:
 *       200:
 *         description: List of participants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET all participants
router.get('/participants', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [participants] = await connection.query(
            'SELECT u.userID, u.fullName, u.role, u.image_url, p.phoneNumber, p.birthdate, p.created_at FROM Participant p JOIN User u ON p.userID = u.userID'
        );
        connection.release();
        res.json({ success: true, data: participants });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/participants:
 *   post:
 *     summary: Create a new participant
 *     description: Create a new participant in the system
 *     tags:
 *       - Participants
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - phoneNumber
 *               - birthdate
 *             properties:
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               birthdate:
 *                 type: string
 *                 format: date
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Participant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userID:
 *                   type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// CREATE participant
router.post('/participants', async (req, res) => {
    try {
        const { fullName, phoneNumber, birthdate, image_url } = req.body;
        
        if (!fullName || !phoneNumber || !birthdate) {
            return res.status(400).json({ success: false, error: 'fullName, phoneNumber, and birthdate are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Check if phone number is already registered
        const [existingPhone] = await connection.query(
            'SELECT userID FROM Participant WHERE phoneNumber = ?',
            [phoneNumber]
        );
        
        if (existingPhone && existingPhone.length > 0) {
            connection.release();
            return res.status(400).json({ success: false, error: 'This phone number is already registered' });
        }
        
        // Insert into User table
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, role, image_url) VALUES (?, ?, ?)',
            [fullName, 'participant', image_url]
        );
        
        // Insert into Participant table with phoneNumber and birthdate
        await connection.query(
            'INSERT INTO Participant (userID, phoneNumber, birthdate) VALUES (?, ?, ?)', 
            [userResult.insertId, phoneNumber, birthdate]
        );
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/participants/{userID}:
 *   delete:
 *     summary: Delete a participant
 *     description: Remove a participant from the system
 *     tags:
 *       - Participants
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant user ID
 *     responses:
 *       200:
 *         description: Participant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/volunteers:
 *   get:
 *     summary: Get all volunteers
 *     description: Retrieve a list of all volunteers
 *     tags:
 *       - Volunteers
 *     responses:
 *       200:
 *         description: List of volunteers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/volunteers:
 *   post:
 *     summary: Create a new volunteer
 *     description: Create a new volunteer with email and password
 *     tags:
 *       - Volunteers
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Volunteer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userID:
 *                   type: integer
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// CREATE volunteer
router.post('/volunteers', async (req, res) => {
    try {
        const { fullName, email, password, image_url } = req.body;
        
        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, error: 'fullName, email, and password are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, role, image_url) VALUES (?, ?, ?)',
            [fullName, 'volunteer', image_url]
        );
        
        await connection.query(
            'INSERT INTO Volunteers (userID, email, password) VALUES (?, ?, ?)', 
            [userResult.insertId, email, hashedPassword]
        );
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/volunteers/{userID}:
 *   delete:
 *     summary: Delete a volunteer
 *     description: Remove a volunteer from the system
 *     tags:
 *       - Volunteers
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The volunteer user ID
 *     responses:
 *       200:
 *         description: Volunteer deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/staff:
 *   get:
 *     summary: Get all staff members
 *     description: Retrieve a list of all staff members
 *     tags:
 *       - Staff
 *     responses:
 *       200:
 *         description: List of staff members retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET all staff
router.get('/staff', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [staff] = await connection.query(
            'SELECT u.userID, u.fullName, u.role, u.image_url, s.created_at FROM Staff s JOIN User u ON s.userID = u.userID'
        );
        connection.release();
        res.json({ success: true, data: staff });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/staff:
 *   post:
 *     summary: Create a new staff member (Admin only)
 *     description: Create a new staff member with email and password. Only authenticated staff/admin can create new staff accounts.
 *     tags:
 *       - Staff
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fullName
 *               - email
 *               - password
 *             properties:
 *               fullName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               image_url:
 *                 type: string
 *     responses:
 *       201:
 *         description: Staff member created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 userID:
 *                   type: integer
 *       401:
 *         description: Unauthorized - invalid or missing token
 *       403:
 *         description: Forbidden - only staff/admin can create staff accounts
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// CREATE staff (Admin only)
router.post('/staff', verifyToken, async (req, res) => {
    try {
        // Only allow staff/admin to create new staff accounts
        if (req.user.role !== 'staff') {
            return res.status(403).json({ success: false, error: 'Only admin/staff can create staff accounts' });
        }
        
        const { fullName, email, password, image_url } = req.body;
        
        if (!fullName || !email || !password) {
            return res.status(400).json({ success: false, error: 'fullName, email, and password are required' });
        }
        
        const connection = await pool.getConnection();
        
        // Check if email already exists
        const [existingStaff] = await connection.query('SELECT userID FROM Staff WHERE email = ?', [email]);
        if (existingStaff && existingStaff.length > 0) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Email already registered' });
        }
        
        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const [userResult] = await connection.query(
            'INSERT INTO User (fullName, role, image_url) VALUES (?, ?, ?)',
            [fullName, 'staff', image_url]
        );
        
        await connection.query('INSERT INTO Staff (userID, email, password) VALUES (?, ?, ?)', 
            [userResult.insertId, email, hashedPassword]);
        connection.release();
        
        res.status(201).json({ success: true, userID: userResult.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/staff/{userID}:
 *   put:
 *     summary: Update staff member password
 *     description: Update the password of a staff member
 *     tags:
 *       - Staff
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The staff member user ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Staff member updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/staff/{userID}:
 *   delete:
 *     summary: Delete a staff member
 *     description: Remove a staff member from the system
 *     tags:
 *       - Staff
 *     parameters:
 *       - in: path
 *         name: userID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The staff member user ID
 *     responses:
 *       200:
 *         description: Staff member deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/events:
 *   get:
 *     summary: Get all events
 *     description: Retrieve a list of all events sorted by date
 *     tags:
 *       - Events
 *     responses:
 *       200:
 *         description: List of events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET all events
// GET all events with registration counts
router.get('/events', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        const [events] = await connection.query(`
            SELECT 
                e.*,
                COUNT(DISTINCT pe.participantID) as registered_participants,
                COUNT(DISTINCT ve.volunteerID) as registered_volunteers
            FROM Event e
            LEFT JOIN ParticipantEvent pe ON e.eventID = pe.eventID
            LEFT JOIN VolunteerEvent ve ON e.eventID = ve.eventID
            GROUP BY e.eventID
            ORDER BY e.datetime DESC
        `);
        connection.release();
        res.json({ success: true, data: events });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/events/{eventID}:
 *   get:
 *     summary: Get a single event
 *     description: Retrieve details of a specific event by ID
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: Event retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// GET single event
// GET single event with registration counts and lists
router.get('/events/:eventID', async (req, res) => {
    try {
        const connection = await pool.getConnection();
        
        // Get event with counts
        const [event] = await connection.query(`
            SELECT 
                e.*,
                COUNT(DISTINCT pe.participantID) as registered_participants,
                COUNT(DISTINCT ve.volunteerID) as registered_volunteers
            FROM Event e
            LEFT JOIN ParticipantEvent pe ON e.eventID = pe.eventID
            LEFT JOIN VolunteerEvent ve ON e.eventID = ve.eventID
            WHERE e.eventID = ?
            GROUP BY e.eventID
        `, [req.params.eventID]);
        
        if (!event || event.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        
        // Get registered participants
        const [participants] = await connection.query(`
            SELECT u.userID, u.fullName, u.image_url, pe.signed_at
            FROM ParticipantEvent pe
            JOIN User u ON pe.participantID = u.userID
            WHERE pe.eventID = ?
        `, [req.params.eventID]);
        
        // Get registered volunteers
        const [volunteers] = await connection.query(`
            SELECT u.userID, u.fullName, u.image_url, ve.signed_at
            FROM VolunteerEvent ve
            JOIN User u ON ve.volunteerID = u.userID
            WHERE ve.eventID = ?
        `, [req.params.eventID]);
        
        connection.release();
        
        res.json({ 
            success: true, 
            data: {
                ...event[0],
                participants,
                volunteers
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: Create a new event
 *     description: Create a new event (staff only)
 *     tags:
 *       - Events
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *               - eventDescription
 *               - datetime
 *               - location
 *             properties:
 *               eventName:
 *                 type: string
 *               eventDescription:
 *                 type: string
 *               disabled_friendly:
 *                 type: boolean
 *               datetime:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               additional_information:
 *                 type: string
 *     responses:
 *       201:
 *         description: Event created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 eventID:
 *                   type: integer
 *       401:
 *         description: Unauthorized - invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - only staff can create events
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// CREATE event
router.post('/events', verifyToken, async (req, res) => {
    try {
        const { eventName, eventDescription, disabled_friendly, datetime, location, additional_information, max_participants, max_volunteers } = req.body;
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
            'INSERT INTO Event (eventName, eventDescription, disabled_friendly, datetime, location, additional_information, created_by, max_participants, max_volunteers) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [eventName, eventDescription, disabled_friendly, datetime, location, additional_information, created_by, max_participants, max_volunteers]
        );
        connection.release();
        res.status(201).json({ success: true, eventID: result.insertId });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/events/{eventID}:
 *   put:
 *     summary: Update an event
 *     description: Update event information
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               eventDescription:
 *                 type: string
 *               disabled_friendly:
 *                 type: boolean
 *               datetime:
 *                 type: string
 *                 format: date-time
 *               location:
 *                 type: string
 *               additional_information:
 *                 type: string
 *     responses:
 *       200:
 *         description: Event updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// UPDATE event
router.put('/events/:eventID', async (req, res) => {
    try {
        const { eventName, eventDescription, disabled_friendly, datetime, location, additional_information, max_participants, max_volunteers } = req.body;
        const connection = await pool.getConnection();
        await connection.query(
            'UPDATE Event SET eventName = ?, eventDescription = ?, disabled_friendly = ?, datetime = ?, location = ?, additional_information = ?, max_participants = ?, max_volunteers = ? WHERE eventID = ?',
            [eventName, eventDescription, disabled_friendly, datetime, location, additional_information, max_participants, max_volunteers, req.params.eventID]
        );
        connection.release();
        res.json({ success: true, message: 'Event updated' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * @swagger
 * /api/events/{eventID}:
 *   delete:
 *     summary: Delete an event
 *     description: Remove an event from the system
 *     tags:
 *       - Events
 *     parameters:
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: Event deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/events/{eventID}/participants:
 *   get:
 *     summary: Get participants for an event
 *     description: Retrieve all participants registered for a specific event
 *     tags:
 *       - ParticipantEvents
 *     parameters:
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: List of participants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/participants/{participantID}/events:
 *   get:
 *     summary: Get events for a participant
 *     description: Retrieve all events a participant is registered for
 *     tags:
 *       - ParticipantEvents
 *     parameters:
 *       - in: path
 *         name: participantID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant ID
 *     responses:
 *       200:
 *         description: List of events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/participant-events:
 *   post:
 *     summary: Register participant to event
 *     description: Sign a participant up for an event
 *     tags:
 *       - ParticipantEvents
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - participantID
 *               - eventID
 *             properties:
 *               participantID:
 *                 type: integer
 *               eventID:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Participant registered to event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// PARTICIPANT SIGNS EVENT
router.post('/participant-events', async (req, res) => {
    try {
        const { participantID, eventID } = req.body;
        const connection = await pool.getConnection();
        
        // Check if event is full
        const [event] = await connection.query(`
            SELECT 
                e.max_participants,
                COUNT(pe.participantID) as current_count
            FROM Event e
            LEFT JOIN ParticipantEvent pe ON e.eventID = pe.eventID
            WHERE e.eventID = ?
            GROUP BY e.eventID
        `, [eventID]);
        
        if (!event || event.length === 0) {
            connection.release();
            return res.status(404).json({ success: false, error: 'Event not found' });
        }
        
        if (event[0].current_count >= event[0].max_participants) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Event is full' });
        }
        
        // Check if already registered
        const [existing] = await connection.query(
            'SELECT * FROM ParticipantEvent WHERE participantID = ? AND eventID = ?',
            [participantID, eventID]
        );
        
        if (existing.length > 0) {
            connection.release();
            return res.status(400).json({ success: false, error: 'Already registered' });
        }
        
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

/**
 * @swagger
 * /api/participant-events/{participantID}/{eventID}:
 *   delete:
 *     summary: Unregister participant from event
 *     description: Remove a participant from an event
 *     tags:
 *       - ParticipantEvents
 *     parameters:
 *       - in: path
 *         name: participantID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The participant ID
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: Participant removed from event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/events/{eventID}/volunteers:
 *   get:
 *     summary: Get volunteers for an event
 *     description: Retrieve all volunteers registered for a specific event
 *     tags:
 *       - VolunteerEvents
 *     parameters:
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: List of volunteers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/volunteers/{volunteerID}/events:
 *   get:
 *     summary: Get events for a volunteer
 *     description: Retrieve all events a volunteer is registered for
 *     tags:
 *       - VolunteerEvents
 *     parameters:
 *       - in: path
 *         name: volunteerID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The volunteer ID
 *     responses:
 *       200:
 *         description: List of events retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Event'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/volunteer-events:
 *   post:
 *     summary: Register volunteer to event
 *     description: Sign a volunteer up for an event
 *     tags:
 *       - VolunteerEvents
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - volunteerID
 *               - eventID
 *             properties:
 *               volunteerID:
 *                 type: integer
 *               eventID:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Volunteer registered to event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

/**
 * @swagger
 * /api/volunteer-events/{volunteerID}/{eventID}:
 *   delete:
 *     summary: Unregister volunteer from event
 *     description: Remove a volunteer from an event
 *     tags:
 *       - VolunteerEvents
 *     parameters:
 *       - in: path
 *         name: volunteerID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The volunteer ID
 *       - in: path
 *         name: eventID
 *         schema:
 *           type: integer
 *         required: true
 *         description: The event ID
 *     responses:
 *       200:
 *         description: Volunteer removed from event successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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
