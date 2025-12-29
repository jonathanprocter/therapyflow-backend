/**
 * Setup Database User Script
 * 
 * This script creates the required therapist user in the database
 * that is hardcoded in the authentication middleware.
 * 
 * Usage:
 *   tsx scripts/setup-database-user.ts <password>
 * 
 * Example:
 *   tsx scripts/setup-database-user.ts "MySecurePassword123"
 */

import { db } from '../server/db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const THERAPIST_ID = 'dr-jonathan-procter';
const THERAPIST_USERNAME = 'jonathan.procter';
const THERAPIST_NAME = 'Dr. Jonathan Procter';
const THERAPIST_EMAIL = 'jonathan.procter@gmail.com';

async function setupDatabaseUser() {
  const password = process.argv[2];
  
  if (!password) {
    console.error('❌ Error: Please provide a password as an argument');
    console.error('Usage: tsx scripts/setup-database-user.ts "your-password-here"');
    process.exit(1);
  }
  
  try {
    console.log('🔍 Checking if user already exists...');
    
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.id, THERAPIST_ID))
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log('✅ User already exists!');
      console.log('   ID:', existingUser[0].id);
      console.log('   Username:', existingUser[0].username);
      console.log('   Name:', existingUser[0].name);
      console.log('   Email:', existingUser[0].email);
      console.log('   Role:', existingUser[0].role);
      console.log('\n💡 If you want to update the password, delete this user first and run the script again.');
      return;
    }
    
    console.log('🔐 Generating password hash...');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('📝 Creating user in database...');
    const [newUser] = await db
      .insert(users)
      .values({
        id: THERAPIST_ID,
        username: THERAPIST_USERNAME,
        password: hashedPassword,
        name: THERAPIST_NAME,
        email: THERAPIST_EMAIL,
        role: 'therapist',
      })
      .returning();
    
    console.log('\n✅ User created successfully!');
    console.log('   ID:', newUser.id);
    console.log('   Username:', newUser.username);
    console.log('   Name:', newUser.name);
    console.log('   Email:', newUser.email);
    console.log('   Role:', newUser.role);
    console.log('   Created:', newUser.createdAt);
    
    console.log('\n🎉 Database setup complete! Your app should now work properly.');
    console.log('\n⚠️  IMPORTANT: Keep your password secure and do not commit it to version control.');
    
  } catch (error) {
    console.error('\n❌ Error setting up database user:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('unique constraint')) {
        console.error('\n💡 The user already exists. If you need to update it, delete it first.');
      } else if (error.message.includes('DATABASE_URL')) {
        console.error('\n💡 Make sure your DATABASE_URL environment variable is set correctly.');
      }
    }
    
    process.exit(1);
  }
}

setupDatabaseUser();
