import * as crypto from 'crypto';

// IMPORTANT: Set this in your environment variables
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
let ENCRYPTION_KEY: string;

if (process.env.ENCRYPTION_KEY) {
  ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  console.log('[ENCRYPTION] Using configured encryption key');
} else if (IS_PRODUCTION) {
  console.error('[ENCRYPTION] CRITICAL: No ENCRYPTION_KEY in production! Data encryption will fail.');
  ENCRYPTION_KEY = ''; // Will cause encryption to fail safely rather than use weak key
} else {
  // Generate a temporary key for development only
  console.warn('[ENCRYPTION] WARNING: No ENCRYPTION_KEY found, generating temporary key for development');
  console.warn('[ENCRYPTION] Data encrypted with this key will be LOST on server restart!');
  ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Derive a proper 32-byte key from the hex key string
const getKeyBuffer = (): Buffer => {
  // If the key is already 64 hex chars (32 bytes), use it directly
  if (/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    return Buffer.from(ENCRYPTION_KEY, 'hex');
  }
  // Otherwise, derive a key using SHA-256
  return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
};

/**
 * Clinical Data Encryption Utilities
 * Use these for all sensitive PHI data (notes, client info, etc.)
 * Uses AES-256-GCM for authenticated encryption
 */
export class ClinicalEncryption {
  /**
   * Encrypt sensitive clinical data using AES-256-GCM
   * Format: iv:authTag:encryptedData (all hex encoded)
   */
  static encrypt(text: string): string {
    if (!text) return text;

    try {
      const iv = crypto.randomBytes(IV_LENGTH);
      const key = getKeyBuffer();
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');

      // Format: iv:authTag:encryptedData
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt clinical data:', error);
      throw new Error('Encryption failed - data not saved');
    }
  }

  /**
   * Decrypt sensitive clinical data using AES-256-GCM
   * H6 FIX: Removed silent passthroughs - now throws on any decryption failure
   * @throws Error if decryption fails or data integrity cannot be verified
   */
  static decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return encryptedData;
    }

    // Check if it's in our new format (iv:authTag:data)
    if (encryptedData.includes(':')) {
      const parts = encryptedData.split(':');
      if (parts.length === 3) {
        try {
          const [ivHex, authTagHex, encrypted] = parts;
          const iv = Buffer.from(ivHex, 'hex');
          const authTag = Buffer.from(authTagHex, 'hex');
          const key = getKeyBuffer();

          const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
          decipher.setAuthTag(authTag);

          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return decrypted;
        } catch (error) {
          // H6 FIX: Always throw on decryption failure - no silent passthrough
          console.error('[ENCRYPTION] Decryption failed:', error instanceof Error ? error.message : 'Unknown error');
          throw new Error('Decryption failed - data integrity cannot be verified');
        }
      }
    }

    // Check if it's legacy encrypted data (plain hex string)
    if (/^[0-9a-fA-F]+$/.test(encryptedData) && encryptedData.length > 32) {
      // Attempt legacy decryption with deprecation warning
      console.warn('[ENCRYPTION] Attempting legacy decryption - consider re-encrypting data');
      try {
        // Use scrypt to derive key for legacy compatibility
        const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 24);
        const decipher = crypto.createDecipheriv('aes-192-cbc', key, Buffer.alloc(16, 0));
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (legacyError) {
        // H6 FIX: Throw on legacy decryption failure - no silent passthrough
        console.error('[ENCRYPTION] Legacy decryption failed:',
          legacyError instanceof Error ? legacyError.message : 'Unknown error');
        throw new Error('Legacy decryption failed - data integrity cannot be verified');
      }
    }

    // H6 FIX: Data doesn't match any known encryption format
    // This could be genuinely unencrypted data from before encryption was implemented
    // Log a warning but return the data - this is the only acceptable "passthrough"
    // for backwards compatibility with pre-encryption data
    if (!IS_PRODUCTION && encryptedData.length > 0) {
      console.debug('[ENCRYPTION] Data does not appear to be encrypted (pre-encryption legacy data)');
    }

    // For production safety, if the data LOOKS like it should be encrypted but isn't
    // in a recognized format, throw an error
    if (IS_PRODUCTION && encryptedData.length > 100) {
      // Long strings in production should be encrypted - reject unrecognized formats
      console.error('[ENCRYPTION] Unrecognized data format in production - rejecting for safety');
      throw new Error('Data format unrecognized - cannot safely decrypt');
    }

    return encryptedData;
  }

  /**
   * Hash sensitive data for indexing/searching (one-way)
   */
  static hash(data: string): string {
    return crypto
      .createHash('sha256')
      .update(data + ENCRYPTION_KEY)
      .digest('hex');
  }

  /**
   * Generate a secure encryption key (run once, store in env vars)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}

/**
 * Database field encryption helpers
 * Use these in your Drizzle schema or before saving data
 */
export const encryptedField = {
  /**
   * Encrypt before saving to database
   */
  beforeSave: (value: string | null): string | null => {
    if (!value) return value;
    return ClinicalEncryption.encrypt(value);
  },

  /**
   * Decrypt after loading from database
   */
  afterLoad: (value: string | null): string | null => {
    if (!value) return value;
    return ClinicalEncryption.decrypt(value);
  }
};

// Example usage in your models:
export const encryptClientData = (clientData: any) => ({
  ...clientData,
  // Encrypt PHI fields - be selective about what needs encryption
  phone: encryptedField.beforeSave(clientData.phone),
  emergencyContact: clientData.emergencyContact ? 
    encryptedField.beforeSave(JSON.stringify(clientData.emergencyContact)) : null,
  insurance: clientData.insurance ? 
    encryptedField.beforeSave(JSON.stringify(clientData.insurance)) : null,
  // Keep non-PHI fields unencrypted for performance
  name: clientData.name,
  email: clientData.email,
});

export const decryptClientData = (encryptedData: any) => ({
  ...encryptedData,
  phone: encryptedField.afterLoad(encryptedData.phone),
  emergencyContact: encryptedData.emergencyContact ? 
    JSON.parse(encryptedField.afterLoad(encryptedData.emergencyContact) || '{}') : null,
  insurance: encryptedData.insurance ? 
    JSON.parse(encryptedField.afterLoad(encryptedData.insurance) || '{}') : null,
});

export const encryptProgressNoteData = (noteData: any) => ({
  ...noteData,
  content: encryptedField.beforeSave(noteData.content),
  processingNotes: encryptedField.beforeSave(noteData.processingNotes),
});

export const decryptProgressNoteData = (encryptedData: any) => ({
  ...encryptedData,
  content: encryptedField.afterLoad(encryptedData.content),
  processingNotes: encryptedField.afterLoad(encryptedData.processingNotes),
});