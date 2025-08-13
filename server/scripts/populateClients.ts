// Script to populate client database from SimplePractice appointment names
import { db } from '../storage';
import { clients, sessions } from '../../shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function populateClientsFromAppointments() {
  console.log('Starting client population from SimplePractice appointments...');
  
  try {
    // Get all unique client names from appointment data stored in sessions
    const uniqueClientsQuery = await db
      .select({
        clientName: sql<string>`
          TRIM(REGEXP_REPLACE(
            CASE 
              WHEN ${sessions.googleEventId} IS NOT NULL THEN 
                -- This would be populated from the actual Google Calendar event summary
                -- For now, we'll get from the client records that were already created
                (SELECT name FROM ${clients} WHERE id = ${sessions.clientId})
              ELSE 'Unknown'
            END,
            '(Appointment|Session).*$', '', 'gi'
          ))
        `,
        sessionCount: sql<number>`COUNT(*)`
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.therapistId, 'dr-jonathan-procter'),
          eq(sessions.isSimplePracticeEvent, true)
        )
      )
      .groupBy(sql`1`)
      .having(sql`COUNT(*) > 0`);

    console.log(`Found ${uniqueClientsQuery.length} unique clients in appointments`);

    // Get existing clients to avoid duplicates
    const existingClients = await db
      .select({ name: clients.name })
      .from(clients)
      .where(eq(clients.therapistId, 'dr-jonathan-procter'));

    const existingClientNames = new Set(
      existingClients.map(c => c.name.toLowerCase().trim())
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
          status: 'active' as const,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        existingClientNames.add(cleanName.toLowerCase());
      }
    }

    if (newClients.length > 0) {
      console.log(`Creating ${newClients.length} new client records...`);
      await db.insert(clients).values(newClients);
      console.log('✓ Client records created successfully');
    } else {
      console.log('No new clients to create - all found clients already exist');
    }

    // Get final count
    const finalCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(clients)
      .where(eq(clients.therapistId, 'dr-jonathan-procter'));

    console.log(`Total clients in database: ${finalCount[0].count}`);
    
    return {
      totalClients: finalCount[0].count,
      newClientsCreated: newClients.length,
      clientNames: newClients.map(c => c.name)
    };

  } catch (error) {
    console.error('Error populating clients:', error);
    throw error;
  }
}

export { populateClientsFromAppointments };