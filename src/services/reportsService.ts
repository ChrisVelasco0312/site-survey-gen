import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import type { Report, ReportStatus } from '../types/Report';
import {
  saveReportToDB,
  getReportFromDB,
  getAllReportsFromDB,
  addToSyncQueue,
  clearSyncQueueForReport,
  getLatestSyncUpdateForReport,
  deleteReportFromDB,
} from '../utils/indexedDB';
import {
  deleteReportImageUrls,
  getStaleReportImageUrls,
  reportWithStorageUrls,
  reportWithBase64FromStorage,
} from '../utils/reportImagesStorage';

/**
 * Save a report to IndexedDB only (local cache).
 * Use for frequent, low-cost local persistence (e.g. debounced auto-save).
 */
export async function saveReportLocally(report: Report): Promise<void> {
  await saveReportToDB(report);
}

/**
 * Save a report to Firestore (primary) and IndexedDB (cache).
 * - IndexedDB: stores the report as-is (with base64 images for offline).
 * - Firestore: images are uploaded to Firebase Storage; report stores storage URLs only.
 * When offline, saves to IndexedDB + sync queue for later push.
 */
export async function saveReport(report: Report): Promise<void> {
  // Always cache locally with base64 so UI works offline
  await saveReportToDB(report);

  if (navigator.onLine) {
    try {
      const reportRef = doc(db, 'reports', report.id);
      const remoteSnap = await getDoc(reportRef);
      const previousReport = remoteSnap.exists() ? (remoteSnap.data() as Report) : null;
      const reportForFirestore = await reportWithStorageUrls(report, previousReport);
      const staleUrls = getStaleReportImageUrls(previousReport, reportForFirestore);
      await setDoc(reportRef, reportForFirestore);
      await deleteReportImageUrls(staleUrls);
      await clearSyncQueueForReport(report.id, ['create', 'update']).catch(() => {});
    } catch (error) {
      console.error('Firestore save failed, queuing for sync:', error);
      await addToSyncQueue({
        reportId: report.id,
        action: 'update',
        data: report,
        timestamp: Date.now(),
      });
    }
  } else {
    await addToSyncQueue({
      reportId: report.id,
      action: 'update',
      data: report,
      timestamp: Date.now(),
    });
  }
}

/**
 * Get a single report. Tries Firestore first, falls back to IndexedDB.
 * Firestore is the source of truth when online. IndexedDB is updated as cache.
 */
export async function getReport(id: string): Promise<Report | null> {
  if (navigator.onLine) {
    try {
      const reportRef = doc(db, 'reports', id);
      const snap = await getDoc(reportRef);
      if (snap.exists()) {
        const firestoreReport = snap.data() as Report;
        const [cachedReport, queuedUpdate] = await Promise.all([
          getReportFromDB(id).catch(() => null),
          getLatestSyncUpdateForReport(id).catch(() => null),
        ]);
        const queuedReport = queuedUpdate?.data ?? null;
        const newestLocal = [cachedReport, queuedReport]
          .filter((r): r is Report => Boolean(r))
          .sort((a, b) => b.updated_at - a.updated_at)[0] ?? null;

        if (newestLocal && newestLocal.updated_at > firestoreReport.updated_at) {
          return newestLocal;
        }

        const reportForCache = await reportWithBase64FromStorage(firestoreReport);
        await saveReportToDB(reportForCache).catch(() => {});
        return reportForCache;
      }
    } catch (error) {
      console.warn('Firestore read failed, falling back to IndexedDB:', error);
    }
  }

  return getReportFromDB(id);
}

/**
 * Get reports for a specific user. Firestore-primary with IndexedDB fallback.
 * Does NOT download images — only metadata is returned for list views.
 */
export async function getUserReports(userId: string): Promise<Report[]> {
  if (navigator.onLine) {
    try {
      const q = query(
        collection(db, 'reports'),
        where('user_id', '==', userId),
        orderBy('updated_at', 'desc'),
      );
      const snapshot = await getDocs(q);
      const reports: Report[] = [];
      snapshot.forEach((d) => reports.push(d.data() as Report));
      for (const r of reports) {
        saveReportToDB(r).catch(() => {});
      }
      return reports;
    } catch (error) {
      console.warn('Firestore query failed, falling back to IndexedDB:', error);
    }
  }

  const all = await getAllReportsFromDB();
  return all
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.updated_at - a.updated_at);
}

/**
 * Get all reports (admin view). Firestore-primary with IndexedDB fallback.
 * Does NOT download images — only metadata is returned for list views.
 */
export async function getAllReports(): Promise<Report[]> {
  if (navigator.onLine) {
    try {
      const q = query(
        collection(db, 'reports'),
        orderBy('updated_at', 'desc'),
      );
      const snapshot = await getDocs(q);
      const reports: Report[] = [];
      snapshot.forEach((d) => reports.push(d.data() as Report));
      for (const r of reports) {
        saveReportToDB(r).catch(() => {});
      }
      return reports;
    } catch (error) {
      console.warn('Firestore query failed, falling back to IndexedDB:', error);
    }
  }

  const all = await getAllReportsFromDB();
  return all.sort((a, b) => b.updated_at - a.updated_at);
}

/**
 * Update a report's status and persist the change.
 * Returns the updated report object.
 */
export async function updateReportStatus(
  report: Report,
  newStatus: ReportStatus,
): Promise<Report> {
  const updated: Report = {
    ...report,
    status: newStatus,
    updated_at: Date.now(),
  };
  await saveReport(updated);
  return updated;
}

/**
 * Delete a report from Firestore and IndexedDB.
 */
export async function deleteReport(id: string): Promise<void> {
  // Always delete locally first
  await deleteReportFromDB(id);

  if (navigator.onLine) {
    try {
      const reportRef = doc(db, 'reports', id);
      await deleteDoc(reportRef);
    } catch (error) {
      console.error('Firestore delete failed, queuing for sync:', error);
      await addToSyncQueue({
        reportId: id,
        action: 'delete',
        timestamp: Date.now(),
      });
    }
  } else {
    await addToSyncQueue({
      reportId: id,
      action: 'delete',
      timestamp: Date.now(),
    });
  }
}
