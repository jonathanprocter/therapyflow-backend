// Script to populate client database from SimplePractice appointment names
import { storage } from '../storage';
import { clients, sessions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function populateClientsFromAppointments() {
  console.log('Starting client population from SimplePractice appointments...');
  
  try {
    // Get all unique client names from appointment data stored in sessions
    const sessionsData = await storage.getSessions('dr-jonathan-procter');
    const simplePracticeSessions = sessionsData.filter((s: any) => s.isSimplePracticeEvent);
    const uniqueClientsQuery = simplePracticeSessions.map((s: any) => ({
      clientName: s.clientName || 'Unknown',
      sessionCount: 1
    }));

    console.log(`Found ${uniqueClientsQuery.length} unique clients in appointments`);

    // Get existing clients to avoid duplicates
    const existingClients = await storage.getClients('dr-jonathan-procter');

    const existingClientNames = new Set(
      existingClients.map((c: any) => c.name.toLowerCase().trim())
    );

    console.log(`Found ${existingClients.length} existing clients in database`);

    // Create new client records for any missing clients
    const newClients = [];
    for (const client of uniqueClientsQuery) {
      const cleanName = client.clientName?.trim();
      if (
        cleanName && 
        cleanName !== 'Unknown' && 
        cleanName !== 'Calendar Sync Client' &&
        !cleanName.toLowerCase().includes('birthday') &&
        !cleanName.toLowerCase().includes('coffee') &&
        !cleanName.toLowerCase().includes('call with') &&
        cleanName.length > 2 &&
        !existingClientNames.has(cleanName.toLowerCase())
      ) {
        newClients.push({
          id: nanoid(),
          therapistId: 'dr-jonathan-procter',
          name: cleanName,
          email: null,
          phone: null,
          dateOfBirth: null,
          emergencyContact: null,
          insurance: null,
          tags: ['SimplePractice Import'],
          status: 'active' as const
        });
        existingClientNames.add(cleanName.toLowerCase());
      }
    }

    if (newClients.length > 0) {
      console.log(`Creating ${newClients.length} new client records...`);
      for (const client of newClients) {
        await storage.createClient(client);
      }
      console.log('✓ Client records created successfully');
    } else {
      console.log('No new clients to create - all found clients already exist');
    }

    // Get final count
    const allClients = await storage.getClients('dr-jonathan-procter');
    const finalCount = allClients.length;

    console.log(`Total clients in database: ${finalCount}`);
    
    return {
      totalClients: finalCount,
      newClientsCreated: newClients.length,
      clientNames: newClients.map(c => c.name)
    };

  } catch (error) {
    console.error('Error populating clients:', error);
    throw error;
  }
}

export { populateClientsFromAppointments };