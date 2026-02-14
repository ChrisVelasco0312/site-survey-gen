import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase-config';
import { getSyncQueue, clearSyncQueueItem, SyncItem } from '../utils/indexedDB';
import { reportWithStorageUrls } from '../utils/reportImagesStorage';

class SyncService {
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    window.addEventListener('online', () => {
      console.log('Online detected. Triggering sync...');
      this.syncPendingChanges();
    });

    // Optional: Periodic sync check if the app stays open long
    this.syncInterval = setInterval(() => {
        if (navigator.onLine) {
            this.syncPendingChanges();
        }
    }, 60000 * 5); // Check every 5 minutes
  }

  async syncPendingChanges(): Promise<void> {
    if (this.isSyncing) {
        console.log('Sync already in progress.');
        return;
    }

    if (!navigator.onLine) {
      console.log('Offline. Skipping sync.');
      return;
    }

    try {
      this.isSyncing = true;
      const queue: SyncItem[] = await getSyncQueue();

      if (queue.length === 0) {
        // Nothing to sync
        this.isSyncing = false;
        return;
      }

      console.log(`Starting sync for ${queue.length} pending items...`);

      for (const item of queue) {
        // Skip items without ID (should not happen if fetched from IDB)
        if (item.id === undefined) continue;

        try {
          await this.processSyncItem(item);
          // If successful, remove from queue
          await clearSyncQueueItem(item.id);
          console.log(`Synced item ${item.id} (Report: ${item.reportId})`);
        } catch (error) {
          console.error(`Failed to sync item ${item.id} (Report: ${item.reportId}):`, error);
          // TODO: Implement retry logic or move to dead-letter queue
          // For now, we leave it in the queue to retry later
        }
      }

      console.log('Sync batch completed.');
    } catch (error) {
      console.error('Error during synchronization:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  private async processSyncItem(item: SyncItem): Promise<void> {
    const reportRef = doc(db, 'reports', item.reportId);

    switch (item.action) {
      case 'create':
      case 'update':
        if (!item.data) {
          throw new Error('Missing data for create/update operation');
        }
        // Upload base64 images to Storage and get report with storage URLs for Firestore
        const reportForFirestore = await reportWithStorageUrls(item.data);
        await setDoc(reportRef, reportForFirestore, { merge: true });
        break;

      case 'delete':
        await deleteDoc(reportRef);
        break;

      default:
        console.warn(`Unknown sync action: ${item.action as string}`);
    }
  }
}

export const syncService = new SyncService();
