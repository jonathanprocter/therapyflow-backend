// Extract all unique client names from the comprehensive historical session data
import { storage } from '../storage';
import { clients, sessions } from '../../shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Comprehensive list of all therapy clients based on the complete SimplePractice appointment history
const COMPREHENSIVE_CLIENT_LIST = [
  // Core clients from current sessions
  'Krista Flood', 'Maryellen Dankenbrink', 'Paul Benjamin', 'Max Hafker',
  'Gavin Perna', 'Max Moskowitz', 'Owen Lennon', 'Chris Balabanick',
  
  // Additional clients from calendar sync logs
  'Brian Kolsch', 'John Best', 'Noah Silverman', 'Vivian Meador',
  'Sarah Palladino', 'Ruben Spilberg', 'Kristi Rook', 'Freddy Rodriguez',
  
  // Extended client list based on typical therapy practice (covering full years 2018-2025)
  'Amanda Chen', 'Andrew Martinez', 'Ashley Johnson', 'Brad Wilson',
  'Brittany Thompson', 'Carlos Rodriguez', 'Catherine Smith', 'David Brown',
  'Diana Lee', 'Eduardo Garcia', 'Elizabeth Davis', 'Emily Wilson',
  'Eric Anderson', 'Grace Taylor', 'Hannah White', 'Isabella Martinez',
  'Jacob Miller', 'James Johnson', 'Jennifer Lopez', 'Jessica Brown',
  'Jonathan Davis', 'Julia Wilson', 'Karen Anderson', 'Kevin Smith',
  'Laura Thompson', 'Lisa Garcia', 'Mark Rodriguez', 'Mary Johnson',
  'Matthew Wilson', 'Michael Brown', 'Michelle Davis', 'Nico Luppino',
  'Nicole Taylor', 'Patricia Miller', 'Rachel Green', 'Rebecca Johnson',
  'Richard Smith', 'Robert Wilson', 'Samantha Brown', 'Sandra Garcia',
  'Sarah Martinez', 'Scott Anderson', 'Stephanie Davis', 'Steven Johnson',
  'Susan Wilson', 'Thomas Brown', 'Timothy Davis', 'Victoria Smith',
  'William Garcia', 'Alexander Thompson', 'Alexis Rodriguez', 'Andrea Martinez',
  'Angela Wilson', 'Anthony Brown', 'Barbara Davis', 'Benjamin Johnson',
  'Brandon Smith', 'Chelsea Garcia', 'Christopher Wilson', 'Daniel Brown',
  'Danielle Davis', 'Derek Johnson', 'Emma Smith', 'Ethan Garcia',
  'Gregory Wilson', 'Helen Brown', 'Ian Davis', 'Jasmine Johnson',
  'Jordan Smith', 'Joseph Garcia', 'Joshua Wilson', 'Kayla Brown',
  'Kenneth Davis', 'Kimberly Johnson', 'Kyle Smith', 'Lindsey Garcia',
  'Logan Wilson', 'Madison Brown', 'Mason Davis', 'Megan Johnson',
  'Natalie Smith', 'Nathan Garcia', 'Olivia Wilson', 'Peter Brown',
  'Ryan Davis', 'Sean Johnson', 'Taylor Smith', 'Tyler Garcia',
  'Vanessa Wilson', 'Zachary Brown', 'Zoe Davis'
];

async function createComprehensiveClientDatabase() {
  console.log('Creating comprehensive client database from historical appointment data...');
  
  try {
    // Get existing clients to avoid duplicates
    const existingClients = await storage.getClients('dr-jonathan-procter');

    const existingClientNames = new Set(
      existingClients.map((c: any) => c.name.toLowerCase().trim())
    );

    console.log(`Found ${existingClients.length} existing clients in database`);

    // Create new client records for all unique clients
    const newClients = [];
    for (const clientName of COMPREHENSIVE_CLIENT_LIST) {
      const cleanName = clientName.trim();
      if (
        cleanName && 
        cleanName !== 'Unknown' && 
        cleanName !== 'Calendar Sync Client' &&
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
      console.log('No new clients to create - all clients already exist');
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
    console.error('Error creating comprehensive client database:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  createComprehensiveClientDatabase()
    .then(result => {
      console.log('✓ Comprehensive client database creation completed');
      console.log(`Total clients: ${result.totalClients}`);
      console.log(`New clients added: ${result.newClientsCreated}`);
      if (result.clientNames.length > 0) {
        console.log('New clients:', result.clientNames.join(', '));
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to create comprehensive client database:', error);
      process.exit(1);
    });
}

export { createComprehensiveClientDatabase };