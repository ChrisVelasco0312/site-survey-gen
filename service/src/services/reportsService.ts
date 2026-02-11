import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase-config';
import type { Report, ReportStatus } from '../types/Report';
import {
  saveReportToDB,
  getReportFromDB,
  getAllReportsFromDB,
  addToSyncQueue,
} from '../utils/indexedDB';

/**
 * Save a report to Firestore (primary) and IndexedDB (cache).
 * When offline, saves to IndexedDB + sync queue for later push.
 */
export async function saveReport(report: Report): Promise<void> {
  // Always cache locally
  await saveReportToDB(report);

  if (navigator.onLine) {
    try {
      const reportRef = doc(db, 'reports', report.id);
      await setDoc(reportRef, report, { merge: true });
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
 */
export async function getReport(id: string): Promise<Report | null> {
  if (navigator.onLine) {
    try {
      const reportRef = doc(db, 'reports', id);
      const snap = await getDoc(reportRef);
      if (snap.exists()) {
        const report = snap.data() as Report;
        // Update local cache
        await saveReportToDB(report).catch(() => {});
        return report;
      }
    } catch (error) {
      console.warn('Firestore read failed, falling back to IndexedDB:', error);
    }
  }

  // Fallback to IndexedDB
  return getReportFromDB(id);
}

/**
 * Get reports for a specific user. Firestore-primary with IndexedDB fallback.
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
      // Update local cache
      for (const r of reports) {
        saveReportToDB(r).catch(() => {});
      }
      return reports;
    } catch (error) {
      console.warn('Firestore query failed, falling back to IndexedDB:', error);
    }
  }

  // Fallback: filter locally
  const all = await getAllReportsFromDB();
  return all
    .filter((r) => r.user_id === userId)
    .sort((a, b) => b.updated_at - a.updated_at);
}

/**
 * Get all reports (admin view). Firestore-primary with IndexedDB fallback.
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
