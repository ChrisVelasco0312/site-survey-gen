import { UserProfile } from '../types/User';
import { Report } from '../types/Report';
import type { SiteRecord } from '../types/Report';

const DB_NAME = 'site_survey_db';
const DB_VERSION = 5;
const USER_STORE_NAME = 'users';
const REPORT_STORE_NAME = 'reports';
const SYNC_QUEUE_STORE_NAME = 'sync_queue';
const SITES_STORE_NAME = 'sites';
const DISTRITO_MUNICIPIO_STORE_NAME = 'distrito_municipio';

export interface SyncItem {
  id?: number;
  reportId: string;
  action: 'create' | 'update' | 'delete';
  data?: Report;
  timestamp: number;
}

/** Cached connection – reused across calls, closed on version change. */
let cachedDB: IDBDatabase | null = null;

function createStoresIfNeeded(db: IDBDatabase): void {
  if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
    db.createObjectStore(USER_STORE_NAME, { keyPath: 'uid' });
  }
  if (!db.objectStoreNames.contains(REPORT_STORE_NAME)) {
    db.createObjectStore(REPORT_STORE_NAME, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE_NAME)) {
    db.createObjectStore(SYNC_QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
  }
  if (!db.objectStoreNames.contains(SITES_STORE_NAME)) {
    db.createObjectStore(SITES_STORE_NAME, { keyPath: 'id' });
  }
  if (!db.objectStoreNames.contains(DISTRITO_MUNICIPIO_STORE_NAME)) {
    db.createObjectStore(DISTRITO_MUNICIPIO_STORE_NAME, { keyPath: 'distrito' });
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error?.message ?? 'unknown');
      reject(request.error ?? new Error('Error opening IndexedDB'));
    };

    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked – close other tabs and reload.');
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      createStoresIfNeeded(db);
    };

    request.onsuccess = () => {
      const db = request.result;
      // If another tab triggers an upgrade, close this connection so it isn't blocked.
      db.onversionchange = () => {
        db.close();
        cachedDB = null;
      };
      cachedDB = db;
      resolve(db);
    };
  });
}

/**
 * Returns a ready IDBDatabase. Reuses the cached connection when possible;
 * if the upgrade is blocked by other tabs it will log a warning.
 * If the DB is corrupt / stuck, it deletes and recreates it.
 */
export const initDB = async (): Promise<IDBDatabase> => {
  if (cachedDB) {
    try {
      // Quick health-check: if the db was closed we'll get an error.
      cachedDB.transaction([USER_STORE_NAME], 'readonly');
      return cachedDB;
    } catch {
      cachedDB = null;
    }
  }

  try {
    return await openDB();
  } catch (firstErr) {
    // If the open failed (corrupt / stuck upgrade), delete and retry once.
    console.warn('IndexedDB open failed, deleting database and retrying...', firstErr);
    await new Promise<void>((res, rej) => {
      const del = indexedDB.deleteDatabase(DB_NAME);
      del.onsuccess = () => res();
      del.onerror = () => rej(del.error);
      del.onblocked = () => {
        console.warn('Delete blocked – close other tabs.');
        res(); // resolve anyway so we at least try to reopen
      };
    });
    return openDB();
  }
};

export const saveUserToDB = async (user: UserProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([USER_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(USER_STORE_NAME);
    const request = store.put(user);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      console.error('Error saving user to IndexedDB:', event);
      reject('Error saving user');
    };
  });
};

export const getUserFromDB = async (uid: string): Promise<UserProfile | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([USER_STORE_NAME], 'readonly');
    const store = transaction.objectStore(USER_STORE_NAME);
    const request = store.get(uid);

    request.onsuccess = (event) => {
      const result = (event.target as IDBRequest).result;
      resolve(result || null);
    };

    request.onerror = (event) => {
      console.error('Error retrieving user from IndexedDB:', event);
      reject('Error retrieving user');
    };
  });
};

export const getAllUsersFromDB = async (): Promise<UserProfile[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([USER_STORE_NAME], 'readonly');
        const store = transaction.objectStore(USER_STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const result = (event.target as IDBRequest).result;
            resolve(result || []);
        };

        request.onerror = (event) => {
            console.error('Error retrieving all users from IndexedDB:', event);
            reject('Error retrieving all users');
        };
    });
};

// Report CRUD
export const saveReportToDB = async (report: Report): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(REPORT_STORE_NAME);
    const request = store.put(report);

    request.onsuccess = () => resolve();
    request.onerror = (event) => {
      console.error('Error saving report to DB:', event);
      reject('Error saving report');
    };
  });
};

export const getReportFromDB = async (id: string): Promise<Report | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(REPORT_STORE_NAME);
    const request = store.get(id);

    request.onsuccess = (event) => {
      const result = (event.target as IDBRequest).result;
      resolve(result || null);
    };
    request.onerror = (event) => reject(event);
  });
};

export const getAllReportsFromDB = async (): Promise<Report[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE_NAME], 'readonly');
    const store = transaction.objectStore(REPORT_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
      const result = (event.target as IDBRequest).result;
      resolve(result || []);
    };
    request.onerror = (event) => reject(event);
  });
};

export const deleteReportFromDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([REPORT_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(REPORT_STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event);
  });
};

// Sync Queue
export const addToSyncQueue = async (item: SyncItem): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SYNC_QUEUE_STORE_NAME);
    const { id, ...itemWithoutId } = item;
    const request = store.add(itemWithoutId);

    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event);
  });
};

export const getSyncQueue = async (): Promise<SyncItem[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SYNC_QUEUE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SYNC_QUEUE_STORE_NAME);
    const request = store.getAll();

    request.onsuccess = (event) => {
        const result = (event.target as IDBRequest).result;
        resolve(result || []);
    };
    request.onerror = (event) => reject(event);
  });
};

export const clearSyncQueueItem = async (id: number): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([SYNC_QUEUE_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(SYNC_QUEUE_STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (event) => reject(event);
    });
};

// Sites (catalog for address selector – offline first)
export const saveSitesToDB = async (sites: SiteRecord[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SITES_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(SITES_STORE_NAME);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    store.clear();
    for (const site of sites) {
      store.put(site);
    }
  });
};

export const getAllSitesFromDB = async (): Promise<SiteRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([SITES_STORE_NAME], 'readonly');
    const store = transaction.objectStore(SITES_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
};

// Distrito → Municipio mapping (pre-computed in Firestore)
export interface DistritoMunicipioEntry {
  distrito: string;
  municipios: string[];
}

export const saveDistritoMunicipioToDB = async (entries: DistritoMunicipioEntry[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DISTRITO_MUNICIPIO_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(DISTRITO_MUNICIPIO_STORE_NAME);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    store.clear();
    for (const entry of entries) {
      store.put(entry);
    }
  });
};

export const getDistritoMunicipioFromDB = async (): Promise<DistritoMunicipioEntry[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([DISTRITO_MUNICIPIO_STORE_NAME], 'readonly');
    const store = transaction.objectStore(DISTRITO_MUNICIPIO_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
  });
};
