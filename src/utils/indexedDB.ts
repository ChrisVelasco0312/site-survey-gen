import { UserProfile } from '../features/auth/AuthContext';

const DB_NAME = 'site_survey_db';
const DB_VERSION = 1;
const USER_STORE_NAME = 'users';

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
