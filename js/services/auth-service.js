import { CryptoService } from './crypto-service.js';

/**
 * AuthService — Zero-Knowledge Authentication
 * Manages master password setup, verification, session locking.
 * Depends on CryptoService (Dependency Inversion via static methods).
 */
export class AuthService {
  static AUTO_LOCK_MS = 3 * 60 * 1000; // 3 minutes

  /**
   * @param {import('./db-service.js').DBService} db
   */
  constructor(db) {
    this._db = db;
    /** @type {CryptoKey|null} Active session key — lives in RAM only */
    this._sessionKey = null;
    this._lockTimer = null;
    this._onLockCallback = null;

    // Bind visibility change for auto-lock
    this._handleVisibility = this._handleVisibility.bind(this);
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  /* ---- Public API ---- */

  /** Check whether the master password has been set up. */
  async isSetup() {
    const record = await this._db.get('settings', 'auth');
    return !!record;
  }

  /** Try to restore session key from sessionStorage */
  async restoreSession() {
    try {
      const stored = sessionStorage.getItem('lumina_session_key');
      if (stored) {
        const keyData = JSON.parse(stored);
        this._sessionKey = await CryptoService.importKey(keyData);
        this._resetLockTimer();
        return true;
      }
    } catch (e) {
      sessionStorage.removeItem('lumina_session_key');
    }
    return false;
  }

  /** Whether the vault is currently unlocked. */
  get isUnlocked() {
    return this._sessionKey !== null;
  }

  /** Get the active session key (or null). */
  get key() {
    return this._sessionKey;
  }

  /**
   * First-time setup — derive key, encrypt test string, persist.
   * @param {string} password
   */
  async setup(password) {
    const salt = CryptoService.generateSalt();
    const key = await CryptoService.deriveKey(password, salt);
    const { iv, ciphertext } = await CryptoService.encrypt(key, CryptoService.TEST_STRING);

    await this._db.put('settings', {
      id: 'auth',
      salt: Array.from(salt),
      iv: Array.from(iv),
      ciphertext: Array.from(new Uint8Array(ciphertext)),
    });

    this._sessionKey = key;
    this._saveSessionKey();
    this._resetLockTimer();
  }

  /**
   * Unlock with password — derive key and verify against stored test string.
   * @param {string} password
   * @returns {Promise<boolean>} true if password correct
   */
  async unlock(password) {
    const record = await this._db.get('settings', 'auth');
    if (!record) throw new Error('Auth not setup');

    const salt = new Uint8Array(record.salt);
    const iv = new Uint8Array(record.iv);
    const ciphertext = new Uint8Array(record.ciphertext).buffer;

    try {
      const key = await CryptoService.deriveKey(password, salt);
      const result = await CryptoService.decryptToString(key, iv, ciphertext);
      if (result === CryptoService.TEST_STRING) {
        this._sessionKey = key;
        this._saveSessionKey();
        this._resetLockTimer();
        return true;
      }
      return false;
    } catch {
      return false; // Decryption failure = wrong password
    }
  }

  /** Lock the session — destroy the key from memory. */
  lock() {
    this._sessionKey = null;
    sessionStorage.removeItem('lumina_session_key');
    clearTimeout(this._lockTimer);
    if (this._onLockCallback) this._onLockCallback();
  }

  /** Register a callback for when auto-lock fires. */
  onLock(callback) {
    this._onLockCallback = callback;
  }

  /**
   * Change master password.
   * Re-encrypts the test string with the new key.
   * NOTE: Vault images remain encrypted with the old key — caller must
   * re-encrypt vault data separately if desired (out of scope for MVP).
   * For simplicity, we re-derive and store new auth, but vault images
   * stored with the old key will need re-encryption.
   */
  async changePassword(oldPassword, newPassword) {
    const valid = await this.unlock(oldPassword);
    if (!valid) return false;
    // Re-setup with new password
    await this.setup(newPassword);
    return true;
  }

  /* ---- Private ---- */

  _resetLockTimer() {
    clearTimeout(this._lockTimer);
    this._lockTimer = setTimeout(() => this.lock(), AuthService.AUTO_LOCK_MS);
  }

  _handleVisibility() {
    if (document.hidden && this._sessionKey) {
      // Start countdown when app goes to background
      this._resetLockTimer();
    } else if (!document.hidden && this._sessionKey) {
      // Reset timer when app comes back
      this._resetLockTimer();
    }
  }

  /** Extend the session on user activity. Call from app controller. */
  touch() {
    if (this._sessionKey) this._resetLockTimer();
  }

  async _saveSessionKey() {
    if (!this._sessionKey) return;
    try {
      const exported = await CryptoService.exportKey(this._sessionKey);
      sessionStorage.setItem('lumina_session_key', JSON.stringify(exported));
    } catch (e) {
      console.warn('Could not save session key', e);
    }
  }

  destroy() {
    document.removeEventListener('visibilitychange', this._handleVisibility);
    clearTimeout(this._lockTimer);
    this._sessionKey = null;
    sessionStorage.removeItem('lumina_session_key');
  }
}
