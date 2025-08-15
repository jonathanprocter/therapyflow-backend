import crypto from 'crypto';

// IMPORTANT: Set this in your environment variables
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || (() => {
  throw new Error('ENCRYPTION_KEY environment variable is required for PHI protection');
})();

const ALGORITHM = 'aes-256-gcm';
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
      const iv = crypto.randomBytes(IV_LENGTH);
      const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
      cipher.setAAD(Buffer.from('clinical-data')); // Additional authenticated data

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine IV + tag + encrypted data
      return iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to encrypt clinical data:', error);
      throw new Error('Data encryption failed');
    }
  }

  /**
   * Decrypt sensitive clinical data
   */
  static decrypt(encryptedData: string): string {
    if (!encryptedData || !encryptedData.includes(':')) {
      return encryptedData; // Assume unencrypted legacy data
    }

    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const tag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
      decipher.setAAD(Buffer.from('clinical-data'));
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[ENCRYPTION] Failed to decrypt clinical data:', error);
      throw new Error('Data decryption failed');
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