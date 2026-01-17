require('dotenv').config();
const { pool } = require('./db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Sample events for elderly activities in Singapore
const sampleEvents = [
  {
    eventName: "Morning Tai Chi Session",
    eventDescription: "Gentle Tai Chi exercises for seniors to improve balance, flexibility, and mental well-being. Suitable for all fitness levels.",
    disabled_friendly: true,
    datetime: "2026-01-20 08:00:00",
    location: "Community Centre @ Toa Payoh",
    additional_information: "Please wear comfortable clothing and bring a water bottle. No prior experience needed."
  },
  {
    eventName: "Kopi & Kueh Social Gathering",
    eventDescription: "A casual social gathering where seniors can enjoy traditional Singaporean coffee and snacks while making new friends.",
    disabled_friendly: true,
    datetime: "2026-01-21 10:00:00",
    location: "Void Deck @ Ang Mo Kio",
    additional_information: "Free refreshments provided. Wheelchair accessible venue."
  },
  {
    eventName: "Traditional Chinese Calligraphy Workshop",
    eventDescription: "Learn the art of Chinese calligraphy in a relaxed, supportive environment. All materials provided.",
    disabled_friendly: true,
    datetime: "2026-01-22 14:00:00",
    location: "Senior Activity Centre @ Jurong East",
    additional_information: "No experience necessary. Materials and refreshments included."
  },
  {
    eventName: "Health Talk: Managing Diabetes",
    eventDescription: "Educational session on diabetes management for seniors, including diet tips and exercise recommendations.",
    disabled_friendly: true,
    datetime: "2026-01-23 15:00:00",
    location: "Polyclinic @ Woodlands",
    additional_information: "Conducted by certified healthcare professionals. Q&A session included."
  },
  {
    eventName: "Karaoke & Sing-Along Session",
    eventDescription: "Enjoy singing classic songs in English, Mandarin, Malay, and Tamil. Fun and interactive session for music lovers.",
    disabled_friendly: true,
    datetime: "2026-01-24 16:00:00",
    location: "Community Club @ Tampines",
    additional_information: "Songbooks provided. Microphones and sound system available."
  },
  {
    eventName: "Gardening Club: Growing Herbs",
    eventDescription: "Learn to grow common herbs used in Singaporean cooking. Take home your own potted herbs!",
    disabled_friendly: false,
    datetime: "2026-01-25 09:00:00",
    location: "Community Garden @ Pasir Ris",
    additional_information: "Outdoor activity. Please bring hat and sunscreen. Gardening tools provided."
  },
  {
    eventName: "Mindfulness & Meditation",
    eventDescription: "Guided meditation session to help seniors reduce stress and improve mental clarity. Chairs provided.",
    disabled_friendly: true,
    datetime: "2026-01-26 10:30:00",
    location: "Wellness Centre @ Bishan",
    additional_information: "Comfortable seating available. No prior experience needed."
  },
  {
    eventName: "Traditional Games: Mahjong & Chinese Chess",
    eventDescription: "Friendly games session featuring traditional Chinese games. Great for mental stimulation and social interaction.",
    disabled_friendly: true,
    datetime: "2026-01-27 13:00:00",
    location: "Senior Activity Centre @ Bedok",
    additional_information: "Game sets provided. Beginners welcome. Light refreshments served."
  },
  {
    eventName: "Cooking Class: Healthy Local Recipes",
    eventDescription: "Learn to prepare healthy versions of favorite Singaporean dishes. Recipe cards provided.",
    disabled_friendly: true,
    datetime: "2026-01-28 11:00:00",
    location: "Community Kitchen @ Clementi",
    additional_information: "All ingredients provided. Participants can take home samples."
  },
  {
    eventName: "Lion Dance Performance & Workshop",
    eventDescription: "Watch a traditional lion dance performance and learn about this cultural art form. Perfect for Chinese New Year season!",
    disabled_friendly: true,
    datetime: "2026-01-29 14:30:00",
    location: "Community Centre @ Chinatown",
    additional_information: "Outdoor performance. Seating available. Cultural snacks provided."
  }
];

async function populateEvents() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('✅ Connected to database\n');

    // First, check if we have a staff user to create events
    const [staff] = await connection.query(
      'SELECT u.userID, u.fullName, u.NRIC FROM User u JOIN Staff s ON u.userID = s.userID LIMIT 1'
    );

    let createdBy;
    
    if (!staff || staff.length === 0) {
      console.log('⚠️  No staff user found. Creating a default staff user...\n');
      
      // Create a default staff user
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const [userResult] = await connection.query(
        'INSERT INTO User (fullName, NRIC, role, image_url) VALUES (?, ?, ?, ?)',
        ['Admin Staff', 'S1234567A', 'staff', null]
      );
      
      await connection.query(
        'INSERT INTO Staff (userID, password) VALUES (?, ?)',
        [userResult.insertId, hashedPassword]
      );
      
      createdBy = userResult.insertId;
      console.log(`✅ Created staff user with ID: ${createdBy}\n`);
    } else {
      createdBy = staff[0].userID;
      console.log(`✅ Using existing staff user: ${staff[0].fullName} (ID: ${createdBy})\n`);
    }

    // Check existing events
    const [existingEvents] = await connection.query('SELECT COUNT(*) as count FROM Event');
    console.log(`📊 Current events in database: ${existingEvents[0].count}\n`);

    // Insert events
    console.log('📝 Creating events...\n');
    let created = 0;
    let skipped = 0;

    for (const event of sampleEvents) {
      try {
        await connection.query(
          'INSERT INTO Event (eventName, eventDescription, disabled_friendly, datetime, location, additional_information, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            event.eventName,
            event.eventDescription,
            event.disabled_friendly,
            event.datetime,
            event.location,
            event.additional_information,
            createdBy
          ]
        );
        console.log(`✅ Created: ${event.eventName}`);
        created++;
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⏭️  Skipped (duplicate): ${event.eventName}`);
          skipped++;
        } else {
          console.log(`❌ Error creating "${event.eventName}": ${error.message}`);
        }
      }
    }

    console.log(`\n✨ Done! Created ${created} events, skipped ${skipped} duplicates.\n`);

    // Show summary
    const [allEvents] = await connection.query('SELECT eventID, eventName, datetime, location FROM Event ORDER BY datetime');
    console.log('📅 All Events in Database:');
    console.log('='.repeat(80));
    allEvents.forEach((event, index) => {
      const date = new Date(event.datetime).toLocaleDateString('en-SG', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      console.log(`${index + 1}. ${event.eventName}`);
      console.log(`   📍 ${event.location}`);
      console.log(`   🕐 ${date}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

populateEvents();
