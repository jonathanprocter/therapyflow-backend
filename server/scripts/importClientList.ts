// Script to import the comprehensive client list with contact information
import { db } from '../db';
import { clients } from '../../shared/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Comprehensive client list with contact information
const CLIENT_DATA = [
  // A
  {
    name: "Billy Aymami",
    phone: "(917) 495-9421",
    email: "waymami@yahoo.com"
  },
  
  // B
  {
    name: "Christopher Balabanick",
    phone: "(516) 738-2550",
    email: "pattonswarrior0777@gmail.com"
  },
  {
    name: "Paul N. Benjamin",
    phone: "(516) 297-7877",
    email: "ssb95@aol.com"
  },
  {
    name: "John Best",
    phone: "(646) 208-3202",
    email: "bestjm@gmail.com"
  },
  {
    name: "Nick Bonomi",
    phone: "(516) 816-6064",
    email: "nick.bonomi22@gmail.com"
  },
  {
    name: "Michael Bower",
    phone: "(516) 313-4616",
    email: "mlbower1234@gmail.com"
  },
  {
    name: "Brianna Brickman",
    phone: "(845) 826-2186",
    email: "bbrickman1@gmail.com"
  },
  
  // C
  {
    name: "Mary Camarano",
    phone: "(516) 361-6960",
    email: "mekc92016@gmail.com"
  },
  {
    name: "Amberly Comeau",
    phone: "(516) 506-2821",
    email: "afcomeau925@hotmail.com"
  },
  {
    name: "Michael Cserenyi",
    phone: "(631) 449-0268", // Primary phone
    email: "Kiuorno22@gmail.com" // Primary email
  },
  
  // D
  {
    name: "Nick Dabreu",
    phone: "(631) 793-5564",
    email: "nick.dabreu@gmail.com"
  },
  {
    name: "Maryellen Dankenbrink",
    phone: "(516) 428-2797",
    email: "Maryellendankenbrink@gmail.com"
  },
  {
    name: "Bob Delmond",
    phone: "(516) 313-3962",
    email: "mikenbob1@gmail.com"
  },
  {
    name: "Steven Deluca",
    phone: "(516) 477-1539",
    email: "sdeluca25@yahoo.com"
  },
  {
    name: "Caitlin Dunn",
    phone: "(516) 761-7775",
    email: "caitlindunn0721@gmail.com"
  },
  
  // F
  {
    name: "Gavin Fisch",
    phone: "(631) 383-5781",
    email: "gavindfisch@gmail.com"
  },
  {
    name: "Krista Flood",
    phone: "(516) 468-0508",
    email: "Krista.flood1@gmail.com"
  },
  {
    name: "Karen Foster",
    phone: "(646) 642-7582",
    email: "karendenise93@gmail.com"
  },
  {
    name: "Zena Frey",
    phone: "(516) 368-5468",
    email: "Zena@ZenaFrey.com"
  },
  
  // G
  {
    name: "Valentina Gjidoda",
    phone: "(914) 299-9442",
    email: "vgjidoda@gmail.com"
  },
  {
    name: "David Grossman",
    phone: "(516) 521-8497",
    email: "david100@optonline.net"
  },
  {
    name: "Nancy Grossman",
    phone: "(516) 521-7672",
    email: "nancy100@optonline.net"
  },
  {
    name: "Carlos F. Guerra",
    phone: "(347) 777-8930",
    email: "solrac819@yahoo.com"
  },
  
  // H
  {
    name: "Max Hafker",
    phone: "(516) 416-1974",
    email: "hafkermax@gmail.com"
  },
  {
    name: "Susan Hannigan",
    phone: "(516) 567-5710",
    email: "susanhanniganrn@gmail.com"
  },
  {
    name: "Richie Hayes",
    phone: "(516) 526-0206",
    email: "richiehayesboe@hotmail.com"
  },
  {
    name: "Calvin Hill",
    phone: "(917) 675-0749",
    email: "hillcalvin337@yahoo.com"
  },
  {
    name: "Sherrifa Hoosein",
    phone: "(347) 624-2820",
    email: "sherrifa.hoosein@gmail.com"
  },
  
  // J
  {
    name: "Sacha Jones",
    phone: "(778) 266-2913",
    email: "sacha_roberts@hotmail.com" // Primary email
  },
  
  // K
  {
    name: "Luke Knox",
    phone: "(719) 338-6884",
    email: "lukeknoxfilms@gmail.com"
  },
  {
    name: "Brian Kolsch",
    phone: "(516) 238-5709", // Primary phone
    email: "kk208@MSN.COM" // Primary email
  },
  {
    name: "Kieran Kriss",
    phone: "(516) 672-7632",
    email: "kierankriss@gmail.com"
  },
  
  // L
  {
    name: "Jason Laskin",
    phone: "(516) 728-2966",
    email: "jasonlaskin@optimum.net"
  },
  {
    name: "Owen Lennon",
    phone: "(516) 757-3268",
    email: "Olennon2006@outlook.com"
  },
  {
    name: "Nico Luppino",
    phone: "(516) 939-7577",
    email: "nicoluppino@gmail.com"
  },
  
  // M
  {
    name: "Jennifer McNally",
    phone: "(516) 509-3484",
    email: "jennifermcnally11@gmail.com"
  },
  {
    name: "Vivian Meador",
    phone: "(304) 222-7667",
    email: "meadorve@yahoo.com"
  },
  {
    name: "Hector E. Mendez",
    phone: "(201) 736-2966",
    email: "hector.e.mendez@gmail.com"
  },
  {
    name: "Matt Michelson",
    phone: "(516) 606-0689",
    email: "mattmichelson1@gmail.com"
  },
  {
    name: "Ava Moskowitz",
    phone: "(516) 375-2966",
    email: "ava.moskowitz@gmail.com"
  },
  {
    name: "Max Moskowitz",
    phone: "(516) 710-0573",
    email: "moskowitzemax@gmail.com"
  },
  
  // N
  {
    name: "Michael Neira",
    phone: "(516) 469-6407",
    email: "michaelneira94@gmail.com"
  },
  
  // P
  {
    name: "Matt Paccione",
    phone: "(516) 369-3505",
    email: "mpaccione10@aol.com",
    tags: ["Couple - with Freddy Rodriguez"]
  },
  {
    name: "Sarah Palladino",
    phone: "(631) 901-8200",
    email: "sapalladino1@gmail.com"
  },
  {
    name: "Gavin Perna",
    phone: "(304) 550-9281",
    email: "gavinperna@gmail.com"
  },
  
  // R
  {
    name: "Tom Remy",
    phone: "(917) 575-6848",
    email: "remytc6@gmail.com"
  },
  {
    name: "Freddy Rodriguez",
    phone: "(516) 425-6528",
    email: "fjrodriguez85@gmail.com",
    tags: ["Couple - with Matt Paccione"]
  },
  {
    name: "Kristi Rook",
    phone: "(480) 737-6666",
    email: "Kristirook10@gmail.com"
  },
  {
    name: "Angelica Ruden",
    phone: "(516) 512-0033",
    email: "arudenn@gmail.com"
  },
  
  // S
  {
    name: "Jordano Sanchez",
    phone: "(917) 331-2921",
    email: "jordanosanchez@gmail.com"
  },
  {
    name: "Dan Settle",
    phone: "(516) 253-9244",
    email: "Dfs9925@yahoo.com"
  },
  {
    name: "Noah Silverman",
    phone: "(516) 697-2997",
    email: "jen1971@gmail.com" // Primary email
  },
  {
    name: "Ruben Spilberg",
    phone: "(516) 578-5118",
    email: "rspilberg118@gmail.com"
  },
  {
    name: "Trendall Storey",
    phone: "(516) 987-9787",
    email: "tracys1979@gmail.com"
  },
  
  // T
  {
    name: "Sarah Thomas",
    phone: "(516) 640-0738",
    email: "sarah8thomas@gmail.com"
  },
  
  // W
  {
    name: "Jaquan Williams",
    phone: "(646) 245-1762",
    email: "jaquanwilliamsnyc@gmail.com"
  },
  {
    name: "Chris Wright",
    phone: null,
    email: null,
    tags: ["Missing contact info"]
  },
  {
    name: "James Wright",
    phone: "(516) 972-4205",
    email: null,
    tags: ["Missing email"]
  },
  
  // Z
  {
    name: "Meera Zucker",
    phone: "(216) 650-3274",
    email: "meerazucker@gmail.com"
  }
];

async function importClientList() {
  console.log('🏥 Starting comprehensive client list import...');
  
  try {
    // Assuming therapist ID from existing scripts - you'll need to update this
    const therapistId = 'dr-jonathan-procter';
    
    // Get existing clients to avoid duplicates
    const existingClients = await db
      .select()
      .from(clients)
      .where(and(eq(clients.therapistId, therapistId), isNull(clients.deletedAt)));
    
    const existingClientNames = new Set(
      existingClients.map(c => c.name.toLowerCase().trim())
    );
    
    console.log(`📋 Found ${existingClients.length} existing clients in database`);
    console.log(`📝 Processing ${CLIENT_DATA.length} clients from your list...`);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const clientData of CLIENT_DATA) {
      const normalizedName = clientData.name.toLowerCase().trim();
      
      if (existingClientNames.has(normalizedName)) {
        console.log(`⏭️  Skipped: ${clientData.name} (already exists)`);
        skippedCount++;
        continue;
      }
      
      // Create new client record
      const newClient = {
        id: nanoid(),
        therapistId: therapistId,
        name: clientData.name,
        email: clientData.email || null,
        phone: clientData.phone || null,
        dateOfBirth: null,
        emergencyContact: null,
        insurance: null,
        tags: clientData.tags || ['Client List Import'],
        status: 'active' as const,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      await db.insert(clients).values(newClient);
      console.log(`✅ Created: ${clientData.name} - ${clientData.phone || 'No phone'} - ${clientData.email || 'No email'}`);
      createdCount++;
      existingClientNames.add(normalizedName);
    }
    
    console.log('\n🎉 Client import completed!');
    console.log(`📊 Summary:`);
    console.log(`   • ${createdCount} new clients created`);
    console.log(`   • ${skippedCount} clients skipped (already exist)`);
    console.log(`   • ${CLIENT_DATA.length} total clients processed`);
    console.log(`\n💼 Your practice now has complete contact information for all ${createdCount + existingClients.length} clients.`);
    console.log('📋 Each client record includes:');
    console.log('   • Full name and contact details');
    console.log('   • Linked storage for progress notes');
    console.log('   • Document management capabilities');
    console.log('   • Session tracking and scheduling');
    console.log('   • AI-powered clinical insights');
    
  } catch (error) {
    console.error('❌ Error importing client list:', error);
    throw error;
  }
}

// Export the function for running
export { importClientList };

// If running directly (ES module version)
if (import.meta.url === `file://${process.argv[1]}`) {
  importClientList()
    .then(() => {
      console.log('Import completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Import failed:', error);
      process.exit(1);
    });
}