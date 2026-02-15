import {
  doc,
  setDoc,
  getDocs,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase-config';
import type { GeneratedReport } from '../types/GeneratedReport';

/**
 * Upload a generated PDF to Firebase Storage.
 * Path: generated_reports/{reportId}/report.pdf
 * Returns the download URL.
 */
export async function uploadGeneratedPdf(
  reportId: string,
  pdfBytes: Uint8Array,
): Promise<string> {
  const path = `generated_reports/${reportId}/report.pdf`;
  const storageRef = ref(storage, path);
  const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/**
 * Create a generated_reports document linking a report to its generated PDF.
 */
export async function createGeneratedReport(
  reportId: string,
  pdfUrl: string,
  adminUid: string,
): Promise<GeneratedReport> {
  const generatedReport: GeneratedReport = {
    id: crypto.randomUUID(),
    report_id: reportId,
    pdf_url: pdfUrl,
    generated_at: Date.now(),
    generated_by: adminUid,
  };

  const docRef = doc(db, 'generated_reports', generatedReport.id);
  await setDoc(docRef, generatedReport);
  return generatedReport;
}

/**
 * Get the generated_reports document for a given report ID.
 * Returns null if no generated report exists for this report.
 */
export async function getGeneratedReportByReportId(
  reportId: string,
): Promise<GeneratedReport | null> {
  const q = query(
    collection(db, 'generated_reports'),
    where('report_id', '==', reportId),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return snapshot.docs[0].data() as GeneratedReport;
}
