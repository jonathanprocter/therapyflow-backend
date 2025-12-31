import { db } from "../server/db";
import { clients } from "../shared/schema";
import { v4 as uuidv4 } from "uuid";

const clientData = [
  { name: "Adelaida Mongelli", dob: "1996-11-30" },
  { name: "Amberly Comeau", dob: "1998-09-25" },
  { name: "Andrew Ross", dob: "1989-08-24" },
  { name: "Angelica Ruden", dob: "1995-02-24" },
  { name: "Ava Moskowitz", dob: "2006-09-26" },
  { name: "Billy Aymami", dob: "1972-07-01" },
  { name: "Brian Kolsch", dob: "2002-02-17" },
  { name: "Brianna Brickman", dob: "1995-09-19" },
  { name: "Caitlin Dunn", dob: "1997-07-21" },
  { name: "Calvin Hill", dob: "1996-03-17" },
  { name: "Carlos Guerra", dob: "1989-02-02" },
  { name: "Christopher Balabanick", dob: "1998-10-28" },
  { name: "Dan Settle", dob: "1965-09-01" },
  { name: "David Grossman", dob: "1962-01-03" },
  { name: "Freddy Junior Rodriguez", dob: "1985-03-11" },
  { name: "Gavin Fisch", dob: "2006-09-12" },
  { name: "Gavin Perna", dob: "2003-09-27" },
  { name: "Hector Mendez", dob: "1965-09-02" },
  { name: "James Fusco", dob: "2004-10-14" },
  { name: "James Wright", dob: "2002-05-25" },
  { name: "Jaquan Williams", dob: "1986-12-26" },
  { name: "Jared Vignola", dob: "2003-05-17" },
  { name: "Jason Laskin", dob: "1994-09-29" },
  { name: "Jennifer McNally", dob: "1993-01-11" },
  { name: "Jerry MacKey", dob: "1984-09-20" },
  { name: "John Best", dob: "1962-06-01" },
  { name: "Jordano Sanchez", dob: "1991-06-09" },
  { name: "Karen Foster", dob: "1993-08-27" },
  { name: "Kenneth Doyle", dob: "1996-02-23" },
  { name: "Kieran Kriss", dob: "1990-02-08" },
  { name: "Krista Flood", dob: "2003-05-02" },
  { name: "Kristi Rook", dob: "1974-01-25" },
  { name: "Lindsey Grossman", dob: "1993-03-03" },
  { name: "Luke Knox", dob: "1998-01-06" },
  { name: "Mary Camarano", dob: "1995-03-19" },
  { name: "Maryellen Dankenbrink", dob: "1991-12-24" },
  { name: "Matthew Michelson", dob: "1999-10-10" },
  { name: "Matthew Paccione", dob: "1986-04-09" },
  { name: "Max Hafker", dob: "2005-07-27" },
  { name: "Max Moskowitz", dob: "2000-06-04" },
  { name: "Meera Zucker", dob: "1981-06-05" },
  { name: "Michael Bower", dob: "1962-09-27" },
  { name: "Michael Cserenyi", dob: "1990-03-27" },
  { name: "Michael Neira", dob: "1994-02-18" },
  { name: "Nancy Grossman", dob: "1963-11-24" },
  { name: "Nicholas Bonomi", dob: "1992-05-22" },
  { name: "Nick Dabreu", dob: "1990-09-02" },
  { name: "Nico Luppino", dob: "1992-07-13" },
  { name: "Nicola Marasco", dob: "1994-12-05" },
  { name: "Noah Silverman", dob: "2004-08-28" },
  { name: "Owen Lennon", dob: "2006-02-11" },
  { name: "Paul Benjamin", dob: "1995-09-04" },
  { name: "Richard Hayes", dob: "1964-11-05" },
  { name: "Robert Abbot", dob: "1962-11-29" },
  { name: "Robert Delmond", dob: "1963-01-10" },
  { name: "Ruben Spilberg", dob: "1988-01-18" },
  { name: "Sacha Jones", dob: "1992-09-29" },
  { name: "Sarah Palladino", dob: "1993-08-10" },
  { name: "Sarah Thomas", dob: "1990-03-15" },
  { name: "Sherrifa Hoosein", dob: "1986-12-18" },
  { name: "Steven Deluca", dob: "1996-09-08" },
  { name: "Susan Hannigan", dob: "1990-07-04" },
  { name: "Tom Remy", dob: "1988-05-09" },
  { name: "Trendall Storey", dob: "2006-06-13" },
  { name: "Valentina Gjidoda", dob: "1988-09-01" },
  { name: "Vivian Meador", dob: "1962-04-23" },
];

async function addClients() {
  console.log("Adding clients to TherapyFlow database...\n");

  let added = 0;
  let skipped = 0;

  for (const client of clientData) {
    try {
      const [firstName, ...lastParts] = client.name.split(" ");
      const lastName = lastParts.join(" ");

      await db.insert(clients).values({
        id: uuidv4(),
        therapistId: "dr-jonathan-procter",
        firstName,
        lastName,
        dateOfBirth: new Date(client.dob),
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }).onConflictDoNothing();

      console.log(`✓ Added: ${client.name}`);
      added++;
    } catch (error: any) {
      if (error.code === '23505') {
        console.log(`⊘ Skipped (exists): ${client.name}`);
        skipped++;
      } else {
        console.error(`✗ Error adding ${client.name}:`, error.message);
      }
    }
  }

  console.log(`\n✅ Complete: ${added} added, ${skipped} skipped`);
  process.exit(0);
}

addClients().catch(console.error);
