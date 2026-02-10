import { UserProfile } from '../types/User';
import { Report } from '../types/Report';

const DB_NAME = 'site_survey_db';
const DB_VERSION = 2;
const USER_STORE_NAME = 'users';
const REPORT_STORE_NAME = 'reports';
const SYNC_QUEUE_STORE_NAME = 'sync_queue';

export interface SyncItem {
  id?: number;
  reportId: string;
  action: 'create' | 'update' | 'delete';
  data?: Report;
  timestamp: number;
}

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event);
      reject('Error opening database');
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains(USER_STORE_NAME)) {
        db.createObjectStore(USER_STORE_NAME, { keyPath: 'uid' });
      }

      if (!db.objectStoreNames.contains(REPORT_STORE_NAME)) {
        db.createObjectStore(REPORT_STORE_NAME, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(SYNC_QUEUE_STORE_NAME)) {
        db.createObjectStore(SYNC_QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
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
