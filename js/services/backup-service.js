import { CryptoService } from './crypto-service.js';

/**
 * BackupService — Data portability (export/import encrypted .lumina files).
 * Depends on DBService and CryptoService.
 */
export class BackupService {
  /**
   * @param {import('./db-service.js').DBService} db
   */
  constructor(db) {
    this._db = db;
  }

  /**
   * Export all data as a double-encrypted .lumina file download.
   * @param {string} password — Master password for outer encryption layer
   */
  async exportBackup(password) {
    const allData = await this._db.exportAll();

    // Convert ArrayBuffer fields to base64 for JSON serialization
    const serializable = this._prepareForExport(allData);

    // Double-encrypt the entire payload
    const encrypted = await CryptoService.encryptBackupPayload(password, serializable);

    // Trigger download
    const blob = new Blob([encrypted], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `lumina-backup-${dateStr}.lumina`;
    a.click();
    URL.revokeObjectURL(url);

    // Update last backup date
    await this._db.put('settings', {
      id: 'last_backup',
      date: new Date().toISOString()
    });
  }

  /**
   * Import a .lumina backup file.
   * @param {File} file
   * @param {string} password
   * @returns {Promise<boolean>} success
   */
  async importBackup(file, password) {
    try {
      const buffer = await file.arrayBuffer();
      const data = await CryptoService.decryptBackupPayload(password, buffer);

      // Restore ArrayBuffer fields from base64
      const restored = this._prepareForImport(data);
      await this._db.importAll(restored);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a backup reminder should be shown.
   * @returns {Promise<boolean>} true if > 14 days since last backup and has vault data
   */
  async shouldRemindBackup() {
    const lastBackup = await this._db.get('settings', 'last_backup');
    const images = await this._db.getAll('vault_images');
    if (images.length === 0) return false;

    if (!lastBackup) return true;
    const daysSince = (Date.now() - new Date(lastBackup.date).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince > 14;
  }

  /* ---- Private helpers ---- */

  /**
   * Convert ArrayBuffer fields to base64 strings for JSON serialization.
   */
  _prepareForExport(data) {
    const result = {};
    for (const [store, records] of Object.entries(data)) {
      result[store] = records.map(record => {
        const clone = { ...record };
        for (const [key, val] of Object.entries(clone)) {
          if (val instanceof ArrayBuffer) {
            clone[key] = { __type: 'ArrayBuffer', data: this._arrayBufferToBase64(val) };
          } else if (val instanceof Uint8Array) {
            clone[key] = { __type: 'Uint8Array', data: Array.from(val) };
          } else if (Array.isArray(val) && key === 'ciphertext') {
            // Already serialized as array
            clone[key] = val;
          }
        }
        return clone;
      });
    }
    return result;
  }

  /**
   * Restore ArrayBuffer fields from base64 strings during import.
   */
  _prepareForImport(data) {
    const result = {};
    for (const [store, records] of Object.entries(data)) {
      result[store] = records.map(record => {
        const clone = { ...record };
        for (const [key, val] of Object.entries(clone)) {
          if (val && typeof val === 'object' && val.__type === 'ArrayBuffer') {
            clone[key] = this._base64ToArrayBuffer(val.data);
          } else if (val && typeof val === 'object' && val.__type === 'Uint8Array') {
            clone[key] = new Uint8Array(val.data);
          }
        }
        return clone;
      });
    }
    return result;
  }

  _arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  _base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes.buffer;
  }
}
