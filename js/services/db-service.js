/**
 * DBService — IndexedDB Wrapper
 * Single Responsibility: database CRUD operations.
 * Open Closed: new stores added via DB_STORES constant.
 */
export class DBService {
  static DB_NAME = 'lumina_db';
  static DB_VERSION = 2;
  static STORES = [
    'settings',       // key-value store for app config
    'vault_images',   // encrypted image blobs
    'symptoms',       // daily symptom logs
    'habits',         // daily habit check-off states
    'notes',          // encrypted doctor notes
    'youtube_links',  // saved YouTube links
    'medications',    // medication reminders (v2)
    'appointments',   // calendar appointments (v2)
    'travel_plans',   // travel plans (v2)
    'custom_habits',  // user-defined custom habits (v2)
  ];

  constructor() {
    /** @type {IDBDatabase|null} */
    this._db = null;
  }

  /**
   * Open (or create) the database with migration support.
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DBService.DB_NAME, DBService.DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const storeName of DBService.STORES) {
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName, { keyPath: 'id' });
          }
        }
      };
      request.onsuccess = (event) => {
        this._db = event.target.result;
        resolve(this._db);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  /** Get a single record by id. */
  async get(storeName, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /** Put (insert or update) a record. */
  async put(storeName, record) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).put(record);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Get all records from a store. */
  async getAll(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /** Delete a record by id. */
  async delete(storeName, id) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Clear all records in a store. */
  async clear(storeName) {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const req = tx.objectStore(storeName).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /** Export entire database as a plain object (for backup). */
  async exportAll() {
    const data = {};
    for (const store of DBService.STORES) {
      data[store] = await this.getAll(store);
    }
    return data;
  }

  /** Import data into all stores (for restore). */
  async importAll(data) {
    for (const store of DBService.STORES) {
      if (data[store]) {
        await this.clear(store);
        for (const record of data[store]) {
          await this.put(store, record);
        }
      }
    }
  }
}
