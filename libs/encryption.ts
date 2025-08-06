import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
let cachedKey: Buffer | null = null;

function getEncryptionKey(): Buffer {
  // Skip validation during Next.js build phase
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    return Buffer.alloc(32); // dummy key for build
  }
  
  if (cachedKey) return cachedKey;
  
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be 64 characters (32 bytes hex)');
  }
  
  cachedKey = Buffer.from(key, 'hex');
  return cachedKey;
}

export class EncryptionService {
  
  /**
   * Encrypt API keys object
   */
  static encryptApiKeys(apiKeys: Record<string, string>): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(ALGORITHM, getEncryptionKey());
      
      let encrypted = cipher.update(JSON.stringify(apiKeys), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: iv:authTag:encrypted
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt API keys');
    }
  }

  /**
   * Decrypt API keys object
   */
  static decryptApiKeys(encryptedData: string): Record<string, string> {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(ALGORITHM, getEncryptionKey());
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt API keys');
    }
  }

  /**
   * Encrypt a single value
   */
  static encrypt(text: string): string {
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(ALGORITHM, getEncryptionKey());
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt a single value
   */
  static decrypt(encryptedData: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');
      
      const decipher = crypto.createDecipher(ALGORITHM, getEncryptionKey());
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Generate a new encryption key (for setup)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash sensitive data for logging (one-way)
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}