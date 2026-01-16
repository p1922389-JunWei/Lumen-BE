// Script to create test users
const bcrypt = require('bcrypt');
const { pool } = require('./db');

async function createTestUsers() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to database!\n');

        // Create test participant
        console.log('Creating test participant...');
        const [userResult1] = await connection.query(
            'INSERT INTO User (fullName, role) VALUES (?, ?)', 
            ['Ah Kow', 'participant']
        );
        await connection.query(
            'INSERT INTO Participant (userID, phoneNumber, birthdate) VALUES (?, ?, ?)', 
            [userResult1.insertId, '91234567', '1950-05-15']
        );
        console.log('✓ Created participant: Ah Kow, phone=91234567, birthdate=1950-05-15\n');

        // Create test volunteer
        console.log('Creating test volunteer...');
        const hashedVolPwd = await bcrypt.hash('volunteer123', 10);
        const [userResult2] = await connection.query(
            'INSERT INTO User (fullName, role) VALUES (?, ?)', 
            ['Test Volunteer', 'volunteer']
        );
        await connection.query(
            'INSERT INTO Volunteers (userID, email, password) VALUES (?, ?, ?)', 
            [userResult2.insertId, 'volunteer@test.com', hashedVolPwd]
        );
        console.log('✓ Created volunteer: volunteer@test.com, password=volunteer123\n');

        console.log('=== Test Credentials ===');
        console.log('Staff: email=staff@test.com, password=test123');
        console.log('Volunteer: email=volunteer@test.com, password=volunteer123');
        console.log('Participant: phone=91234567, birthdate=1950-05-15, name=Ah Kow');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

createTestUsers();
