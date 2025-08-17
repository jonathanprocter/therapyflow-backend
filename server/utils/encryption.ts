import crypto from 'crypto';

// IMPORTANT: Set this in your environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  // Generate a temporary key for development if not set
  console.warn('[ENCRYPTION] No ENCRYPTION_KEY found, generating temporary key for development');
  return crypto.randomBytes(32).toString('hex');
})();

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

/**
 * Clinical Data Encryption Utilities
 * Use these for all sensitive PHI data (notes, client info, etc.)
 */
export class ClinicalEncryption {
  /**
   * Encrypt sensitive clinical data
   */
  static encrypt(text: string): string {
    if (!text) return text;

    try {
      // Simple encryption for development - in production use stronger methods
      const cipher = crypto.createCipher('aes192', ENCRYPTION_KEY);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt clinical data:', error);
      return text; // Return original text if encryption fails
    }
  }

  /**
   * Decrypt sensitive clinical data
   */
  static decrypt(encryptedData: string): string {
    if (!encryptedData) {
      return encryptedData;
    }

    try {
      // Check if it looks like encrypted data (hex string)
      if (/^[0-9a-f]+$/.test(encryptedData) && encryptedData.length > 32) {
        const decipher = crypto.createDecipher('aes192', ENCRYPTION_KEY);
        let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      }
      
      // Return as-is if not encrypted (legacy data)
      return encryptedData;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt clinical data:', error);
      return encryptedData; // Return original data if decryption fails
    }
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