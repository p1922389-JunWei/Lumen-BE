const { pool } = require('./db');

async function checkParticipants() {
    const conn = await pool.getConnection();
    
    // Check all users with participant role and see if they have Participant entries
    const [users] = await conn.query(`
        SELECT u.userID, u.fullName, u.role, p.phoneNumber, p.birthdate 
        FROM User u 
        LEFT JOIN Participant p ON u.userID = p.userID 
        WHERE u.role = 'participant'
    `);
    
    console.log('=== Participants (User LEFT JOIN Participant) ===');
    users.forEach(u => {
        if (u.phoneNumber) {
            console.log(`ID: ${u.userID} | Name: ${u.fullName} | Phone: ${u.phoneNumber}`);
        } else {
            console.log(`ID: ${u.userID} | Name: ${u.fullName} | ⚠️ MISSING IN PARTICIPANT TABLE`);
        }
    });
    
    conn.release();
    process.exit(0);
}

checkParticipants();
