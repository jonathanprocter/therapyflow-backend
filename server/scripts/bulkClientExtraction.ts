// Extract ALL unique client names from the comprehensive calendar sync
import { GoogleCalendarService } from '../services/googleCalendarService';

async function extractAllClientNames() {
  console.log('Starting comprehensive client name extraction from full calendar history...');
  
  try {
    const calendarService = new GoogleCalendarService();
    
    // Sync the entire calendar history to extract all client names
    const sessions = await calendarService.syncCalendar('dr-jonathan-procter', '2018-01-01', '2025-12-31');
    
    // Extract unique client names from all sessions
    const clientNames = new Set<string>();
    const clientCounts: { [key: string]: number } = {};
    
    sessions.forEach(session => {
      // @ts-ignore - clientName is temporarily added during sync
      const clientName = session.clientName;
      if (clientName && 
          clientName !== 'Calendar Sync Client' && 
          clientName !== 'Unknown Client' &&
          !clientName.toLowerCase().includes('birthday') &&
          !clientName.toLowerCase().includes('coffee') &&
          !clientName.toLowerCase().includes('meeting') &&
          !clientName.toLowerCase().includes('supervision') &&
          clientName.length > 3) {
        
        // Clean the client name
        const cleanName = clientName
          .replace(/🔒\s*/, '') // Remove lock emoji
          .replace(/\s+Appointment\s*$/i, '') // Remove "Appointment"
          .trim();
        
        if (cleanName.length > 0) {
          clientNames.add(cleanName);
          clientCounts[cleanName] = (clientCounts[cleanName] || 0) + 1;
        }
      }
    });
    
    console.log(`\nFound ${clientNames.size} unique client names from ${sessions.length} appointments:`);
    
    // Sort by frequency
    const sortedClients = Array.from(clientNames).sort((a, b) => 
      (clientCounts[b] || 0) - (clientCounts[a] || 0)
    );
    
    sortedClients.forEach(name => {
      console.log(`  ${name} (${clientCounts[name]} appointments)`);
    });
    
    return Array.from(clientNames);
    
  } catch (error) {
    console.error('Error extracting client names:', error);
    throw error;
  }
}

// Run the script if called directly
if (require.main === module) {
  extractAllClientNames()
    .then(clientNames => {
      console.log(`\n✓ Extraction completed. Found ${clientNames.length} unique clients.`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Failed to extract client names:', error);
      process.exit(1);
    });
}

export { extractAllClientNames };