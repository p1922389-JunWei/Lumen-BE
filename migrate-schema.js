// Migration script to update database schema
// Changes:
// 1. Remove NRIC from User table
// 2. Add phoneNumber and birthdate to Participant table
// 3. Add email to Staff table
// 4. Update Volunteers table to have email and password

const { pool } = require('./db');

async function migrate() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to database successfully!\n');
        console.log('Starting migration...\n');

        // Step 1: Add phoneNumber and birthdate to Participant table
        console.log('1. Adding phoneNumber and birthdate to Participant table...');
        try {
            await connection.query(`
                ALTER TABLE Participant 
                ADD COLUMN phoneNumber VARCHAR(20) AFTER userID,
                ADD COLUMN birthdate DATE AFTER phoneNumber
            `);
            console.log('   ✓ Added phoneNumber and birthdate columns\n');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   ⚠ Columns already exist, skipping...\n');
            } else {
                console.error('   ✗ Error:', e.message, '\n');
            }
        }

        // Step 2: Add email to Staff table
        console.log('2. Adding email to Staff table...');
        try {
            await connection.query(`
                ALTER TABLE Staff 
                ADD COLUMN email VARCHAR(255) UNIQUE AFTER userID
            `);
            console.log('   ✓ Added email column\n');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('   ⚠ Column already exists, skipping...\n');
            } else {
                console.error('   ✗ Error:', e.message, '\n');
            }
        }

        // Step 3: Check Volunteers table and add email/password if needed
        console.log('3. Checking Volunteers table...');
        try {
            const [volunteerCols] = await connection.query('DESCRIBE Volunteers');
            console.log('   Current Volunteers columns:', volunteerCols.map(c => c.Field).join(', '));
            
            // Check if email exists
            const hasEmail = volunteerCols.some(c => c.Field === 'email');
            const hasPassword = volunteerCols.some(c => c.Field === 'password');
            
            if (!hasEmail) {
                await connection.query(`ALTER TABLE Volunteers ADD COLUMN email VARCHAR(255) UNIQUE`);
                console.log('   ✓ Added email column to Volunteers\n');
            }
            if (!hasPassword) {
                await connection.query(`ALTER TABLE Volunteers ADD COLUMN password VARCHAR(255)`);
                console.log('   ✓ Added password column to Volunteers\n');
            }
            if (hasEmail && hasPassword) {
                console.log('   ⚠ Email and password already exist\n');
            }
        } catch (e) {
            console.error('   ✗ Error:', e.message, '\n');
        }

        // Step 4: Remove NRIC from User table (make it nullable first, then can be dropped later)
        console.log('4. Making NRIC nullable in User table (for backward compatibility)...');
        try {
            // First make NRIC nullable
            await connection.query(`
                ALTER TABLE User 
                MODIFY COLUMN NRIC VARCHAR(20) NULL
            `);
            console.log('   ✓ Made NRIC nullable\n');
        } catch (e) {
            console.error('   ✗ Error:', e.message, '\n');
        }

        // Verify the changes
        console.log('=== Verifying Changes ===\n');

        const [userSchema] = await connection.query('DESCRIBE User');
        console.log('User Table:');
        userSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`));
        console.log('');

        const [staffSchema] = await connection.query('DESCRIBE Staff');
        console.log('Staff Table:');
        staffSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`));
        console.log('');

        const [participantSchema] = await connection.query('DESCRIBE Participant');
        console.log('Participant Table:');
        participantSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`));
        console.log('');

        const [volunteerSchema] = await connection.query('DESCRIBE Volunteers');
        console.log('Volunteers Table:');
        volunteerSchema.forEach(col => console.log(`  ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Key || ''}`));

        console.log('\n=== Migration Complete ===');

    } catch (error) {
        console.error('Migration Error:', error.message);
    } finally {
        if (connection) connection.release();
        process.exit(0);
    }
}

migrate();
