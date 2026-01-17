// Script to check and update database schema
const { pool } = require('./db');

async function checkAndUpdateSchema() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to database successfully!\n');

        // Show all tables
        const [tables] = await connection.query('SHOW TABLES');
        console.log('=== Current Tables ===');
        tables.forEach(t => console.log('  -', Object.values(t)[0]));
        console.log('');

        // Check User table schema
        try {
            const [userSchema] = await connection.query('DESCRIBE User');
            console.log('=== User Table Schema ===');
            userSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`));
            console.log('');
        } catch (e) {
            console.log('User table does not exist\n');
        }

        // Check Staff table schema
        try {
            const [staffSchema] = await connection.query('DESCRIBE Staff');
            console.log('=== Staff Table Schema ===');
            staffSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`));
            console.log('');
        } catch (e) {
            console.log('Staff table does not exist\n');
        }

        // Check Participant table schema
        try {
            const [participantSchema] = await connection.query('DESCRIBE Participant');
            console.log('=== Participant Table Schema ===');
            participantSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`));
            console.log('');
        } catch (e) {
            console.log('Participant table does not exist\n');
        }

        // Check Volunteer table schema
        try {
            const [volunteerSchema] = await connection.query('DESCRIBE Volunteer');
            console.log('=== Volunteer Table Schema ===');
            volunteerSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`));
            console.log('');
        } catch (e) {
            console.log('Volunteer table does not exist\n');
        }

        // Check Activity table schema
        try {
            const [activitySchema] = await connection.query('DESCRIBE Activity');
            console.log('=== Activity Table Schema ===');
            activitySchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key || ''}`));
            console.log('');
        } catch (e) {
            console.log('Activity table does not exist\n');
        }

        // Check sample data
        try {
            const [users] = await connection.query('SELECT * FROM User LIMIT 5');
            console.log('=== Sample Users ===');
            console.log(users);
        } catch (e) {
            console.log('Could not fetch users:', e.message);
        }

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

checkAndUpdateSchema();
