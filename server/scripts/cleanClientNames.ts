
import { db } from '../db';
import { clients } from '../../shared/schema';
import { eq, like } from 'drizzle-orm';

async function cleanClientNames() {
  console.log('🧹 Cleaning lock emojis from client names...');
  
  try {
    // Find clients with lock emoji in their names
    const clientsWithLock = await db
      .select()
      .from(clients)
      .where(like(clients.name, '%🔒%'));
    
    console.log(`Found ${clientsWithLock.length} clients with lock emoji`);
    
    for (const client of clientsWithLock) {
      const cleanName = client.name.replace(/🔒\s*/g, '').trim();
      
      if (cleanName !== client.name) {
        await db
          .update(clients)
          .set({ name: cleanName })
          .where(eq(clients.id, client.id));
        
        console.log(`✅ Cleaned: "${client.name}" → "${cleanName}"`);
      }
    }
    
    console.log('✅ Client name cleaning complete!');
    
  } catch (error) {
    console.error('❌ Error cleaning client names:', error);
  }
}

// Run if called directly
if (require.main === module) {
  cleanClientNames().then(() => process.exit(0));
}

export { cleanClientNames };
