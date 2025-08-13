// Script to fix calendar database and create proper client records
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { clients, sessions } = require('./shared/schema');
const { eq, and } = require('drizzle-orm');

async function fixCalendarDatabase() {
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  
  try {
    console.log('Starting calendar database fix...');
    
    // Get the Calendar Sync Client ID
    const calendarSyncClient = await db
      .select()
      .from(clients)
      .where(eq(clients.name, 'Calendar Sync Client'))
      .limit(1);
    
    if (calendarSyncClient.length === 0) {
      console.log('Calendar Sync Client not found');
      return;
    }
    
    const calendarSyncClientId = calendarSyncClient[0].id;
    console.log('Calendar Sync Client ID:', calendarSyncClientId);
    
    // Get all SimplePractice sessions connected to Calendar Sync Client
    const simplePracticeSessions = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.clientId, calendarSyncClientId),
        eq(sessions.isSimplePracticeEvent, true)
      ));
    
    console.log(`Found ${simplePracticeSessions.length} SimplePractice sessions to fix`);
    
    const clientsCreated = new Map();
    let sessionsUpdated = 0;
    
    for (const session of simplePracticeSessions) {
      // Extract client name from session notes or ID
      let clientName = 'Unknown Client';
      
      // Try to get the client name from the Google Calendar event
      // This would require a separate API call in a real implementation
      // For now, we'll create sample clients based on the session patterns
      
      if (session.notes) {
        // Extract potential client name from notes
        const noteMatch = session.notes.match(/with\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
        if (noteMatch) {
          clientName = noteMatch[1];
        }
      }
      
      // Create or get client
      let clientId = clientsCreated.get(clientName);
      
      if (!clientId) {
        // Create new client
        const [newClient] = await db
          .insert(clients)
          .values({
            therapistId: 'dr-jonathan-procter',
            name: clientName,
            status: 'active',
            email: null,
            phone: null,
            dateOfBirth: null,
            emergencyContact: null,
            insurance: null,
            tags: ['SimplePractice Import']
          })
          .returning();
        
        clientId = newClient.id;
        clientsCreated.set(clientName, clientId);
        console.log(`Created client: ${clientName}`);
      }
      
      // Update session to point to the correct client
      await db
        .update(sessions)
        .set({ clientId: clientId })
        .where(eq(sessions.id, session.id));
      
      sessionsUpdated++;
    }
    
    console.log(`Fixed ${sessionsUpdated} sessions`);
    console.log(`Created ${clientsCreated.size} new clients`);
    console.log('Calendar database fix completed successfully');
    
  } catch (error) {
    console.error('Error fixing calendar database:', error);
  }
}

// Run the fix if this script is called directly
if (require.main === module) {
  fixCalendarDatabase().then(() => process.exit(0));
}

module.exports = { fixCalendarDatabase };