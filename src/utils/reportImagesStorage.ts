import { ref, uploadBytes, getDownloadURL, getBlob } from 'firebase/storage';
import { storage } from '../firebase-config';
import type { Report } from '../types/Report';

/** Report fields that may hold image data (base64 data URL or Storage URL). */
export const REPORT_IMAGE_FIELDS = [
  'map_image_url',
  'edited_map_image_url',
  'camera_view_photo_url',
  'service_entrance_photo_url',
] as const;

export type ReportImageField = (typeof REPORT_IMAGE_FIELDS)[number];

function isDataUrl(value: string): boolean {
  return value.startsWith('data:');
}

/**
 * Convert a data URL to a Blob (for upload).
 */
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/**
 * Infer file extension from data URL (e.g. data:image/png;base64,... -> 'png').
 */
function getExtensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/(\w+);/);
  return match ? match[1] : 'jpg';
}

/**
 * Upload one report image (base64 data URL) to Firebase Storage.
 * Path: reports/{reportId}/{field}.{ext}
 * Returns the download URL.
 */
export async function uploadReportImage(
  reportId: string,
  field: ReportImageField,
  dataUrl: string,
): Promise<string> {
  const ext = getExtensionFromDataUrl(dataUrl);
  const path = `reports/${reportId}/${field}.${ext}`;
  const storageRef = ref(storage, path);
  const blob = await dataUrlToBlob(dataUrl);
  await uploadBytes(storageRef, blob);
  return getDownloadURL(storageRef);
}

/**
 * Fetch an image from Firebase Storage and return as base64 data URL.
 * Uses the SDK's getBlob() which handles auth and CORS internally,
 * unlike a raw fetch() against the download URL.
 */
export async function storageUrlToDataUrl(url: string): Promise<string> {
  const storageRef = ref(storage, url);
  const blob = await getBlob(storageRef);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Returns a copy of the report with all image fields that are currently base64
 * uploaded to Firebase Storage and replaced by their download URLs.
 * Use this before saving the report to Firestore.
 */
export async function reportWithStorageUrls(report: Report): Promise<Report> {
  const out = { ...report };

  for (const field of REPORT_IMAGE_FIELDS) {
    const value = out[field];
    if (value && isDataUrl(value)) {
      out[field] = await uploadReportImage(report.id, field, value);
    }
  }

  return out;
}

/**
 * Returns a copy of the report with all image fields that are Storage URLs
 * fetched and converted to base64 data URLs. Use this before saving the report
 * to IndexedDB so the app can show images offline.
 */
export async function reportWithBase64FromStorage(report: Report): Promise<Report> {
  const out = { ...report };

  for (const field of REPORT_IMAGE_FIELDS) {
    const value = out[field];
    if (value && !isDataUrl(value)) {
      try {
        out[field] = await storageUrlToDataUrl(value);
      } catch (e) {
        console.warn(`Failed to fetch report image ${field}:`, e);
        // Leave URL as-is so at least online the img src can work
      }
    }
  }

  return out;
}
