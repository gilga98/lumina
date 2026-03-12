/**
 * CryptoService — Zero-Knowledge Encryption Engine
 * Uses Web Crypto API for PBKDF2 key derivation and AES-GCM encryption.
 * Single Responsibility: cryptographic operations only.
 */
export class CryptoService {
  static ALGORITHM = 'AES-GCM';
  static KEY_LENGTH = 256;
  static PBKDF2_ITERATIONS = 600000;
  static SALT_LENGTH = 16;
  static IV_LENGTH = 12;
  static TEST_STRING = 'vault_setup_complete';

  /**
   * Derive an AES-GCM CryptoKey from a password and salt using PBKDF2.
   * @param {string} password
   * @param {Uint8Array} salt
   * @returns {Promise<CryptoKey>}
   */
  static async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: CryptoService.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: CryptoService.ALGORITHM, length: CryptoService.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt arbitrary data (string or ArrayBuffer) with AES-GCM.
   * @param {CryptoKey} key
   * @param {string|ArrayBuffer} data
   * @returns {Promise<{iv: Uint8Array, ciphertext: ArrayBuffer}>}
   */
  static async encrypt(key, data) {
    const iv = crypto.getRandomValues(new Uint8Array(CryptoService.IV_LENGTH));
    const encoded = typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data;
    const ciphertext = await crypto.subtle.encrypt(
      { name: CryptoService.ALGORITHM, iv },
      key,
      encoded
    );
    return { iv, ciphertext };
  }

  /**
   * Decrypt AES-GCM ciphertext. Returns ArrayBuffer.
   * @param {CryptoKey} key
   * @param {Uint8Array} iv
   * @param {ArrayBuffer} ciphertext
   * @returns {Promise<ArrayBuffer>}
   */
  static async decrypt(key, iv, ciphertext) {
    return crypto.subtle.decrypt(
      { name: CryptoService.ALGORITHM, iv },
      key,
      ciphertext
    );
  }

  static async decryptToString(key, iv, ciphertext) {
    const buffer = await CryptoService.decrypt(key, iv, ciphertext);
    return new TextDecoder().decode(buffer);
  }

  /**
   * Export key to Raw format for session storage
   * @param {CryptoKey} key
   * @returns {Promise<Array<number>>}
   */
  static async exportKey(key) {
    const exported = await crypto.subtle.exportKey('raw', key);
    return Array.from(new Uint8Array(exported));
  }

  /**
   * Import key from Raw format from session storage
   * @param {Array<number>} keyData
   * @returns {Promise<CryptoKey>}
   */
  static async importKey(keyData) {
    return crypto.subtle.importKey(
      'raw',
      new Uint8Array(keyData),
      { name: CryptoService.ALGORITHM },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random salt.
   * @returns {Uint8Array}
   */
  static generateSalt() {
    return crypto.getRandomValues(new Uint8Array(CryptoService.SALT_LENGTH));
  }

  /**
   * Encrypt the entire backup payload (double encryption).
   * @param {string} password
   * @param {object} data
   * @returns {Promise<ArrayBuffer>}
   */
  static async encryptBackupPayload(password, data) {
    const salt = CryptoService.generateSalt();
    const key = await CryptoService.deriveKey(password, salt);
    const jsonStr = JSON.stringify(data);
    const { iv, ciphertext } = await CryptoService.encrypt(key, jsonStr);
    // Pack: [salt(16)] [iv(12)] [ciphertext(...)]
    const packed = new Uint8Array(salt.length + iv.length + new Uint8Array(ciphertext).length);
    packed.set(salt, 0);
    packed.set(iv, salt.length);
    packed.set(new Uint8Array(ciphertext), salt.length + iv.length);
    return packed.buffer;
  }

  /**
   * Decrypt a backup payload.
   * @param {string} password
   * @param {ArrayBuffer} packed
   * @returns {Promise<object>}
   */
  static async decryptBackupPayload(password, packed) {
    const bytes = new Uint8Array(packed);
    const salt = bytes.slice(0, CryptoService.SALT_LENGTH);
    const iv = bytes.slice(CryptoService.SALT_LENGTH, CryptoService.SALT_LENGTH + CryptoService.IV_LENGTH);
    const ciphertext = bytes.slice(CryptoService.SALT_LENGTH + CryptoService.IV_LENGTH);
    const key = await CryptoService.deriveKey(password, salt);
    const jsonStr = await CryptoService.decryptToString(key, iv, ciphertext.buffer);
    return JSON.parse(jsonStr);
  }
}
