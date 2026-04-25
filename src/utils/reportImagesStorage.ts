import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob } from 'firebase/storage';
import type { UploadMetadata } from 'firebase/storage';
import { storage } from '../firebase-config';
import type { Report } from '../types/Report';
import { storageRefFromUrlOrPath } from './firebaseStorageRef';
import { invalidateResolvedStorageUrlCache } from '../hooks/useStorageUrl';

/** Report fields that may hold image data (base64 data URL or Storage URL). */
export const REPORT_IMAGE_FIELDS = [
  'map_image_url',
  'edited_map_image_url',
  'camera_view_photo_url',
  'camera_view_photo_original_url',
  'service_entrance_photo_url',
  'service_entrance_photo_original_url',
  'signature_img_director_url',
  'signature_img_coordinator_url',
  'signature_img_interventoria_url',
] as const;

const imageCache = new Map<string, string>();

export function invalidateImageCache(url: string) {
  imageCache.delete(url);
  invalidateResolvedStorageUrlCache(url);
}

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

const STORAGE_UPLOAD_METADATA: UploadMetadata = {
  cacheControl: 'public, max-age=31536000, immutable',
};

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
  await uploadBytes(storageRef, blob, STORAGE_UPLOAD_METADATA);
  const downloadUrl = await getDownloadURL(storageRef);
  invalidateImageCache(path);
  imageCache.set(path, dataUrl);
  return downloadUrl;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetch an image from Firebase Storage and return as base64 data URL.
 * Uses fetch() with the download URL so the request benefits from
 * browser cache, service worker (CacheFirst), and CDN Cache-Control headers.
 * Falls back to resolving a download URL via the SDK for non-HTTP paths.
 * Results are cached in-memory to avoid repeated fetches within a session.
 */
export async function storageUrlToDataUrl(url: string): Promise<string> {
  const cached = imageCache.get(url);
  if (cached) return cached;

  let blob: Blob;
  try {
    if (!url.startsWith('http') || url.includes('firebasestorage.googleapis.com') || url.startsWith('gs://')) {
      blob = await getBlob(storageRefFromUrlOrPath(url));
    } else {
      const response = await fetch(url, { mode: 'cors', cache: 'no-cache' });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      blob = await response.blob();
    }
  } catch (error) {
    console.warn(`getBlob failed for ${url}, falling back to fresh download URL:`, error);
    let fetchUrl = url;
    if (!url.startsWith('http') || url.includes('firebasestorage.googleapis.com') || url.startsWith('gs://')) {
      fetchUrl = await getDownloadURL(storageRefFromUrlOrPath(url));
    }
    const response = await fetch(fetchUrl, { mode: 'cors', cache: 'no-cache' });
    if (!response.ok) throw new Error(`Storage fetch failed: ${response.status}`);
    blob = await response.blob();
  }

  const dataUrl = await blobToDataUrl(blob);
  imageCache.set(url, dataUrl);
  return dataUrl;
}

/**
 * When IndexedDB cache is newer or equal to Firestore, we still must re-hydrate if:
 * - Any image field is still a bare http(s) URL (last hydration failed), or
 * - Firestore image URLs drifted from what we tracked in _image_source_urls.
 */
export function shouldSkipImageRehydration(cached: Report | null, remote: Report): boolean {
  if (!cached) return false;
  if (cached.updated_at < remote.updated_at) return false;

  for (const field of REPORT_IMAGE_FIELDS) {
    const val = cached[field];
    if (typeof val === 'string' && val.startsWith('http')) return false;
  }

  for (const field of REPORT_IMAGE_FIELDS) {
    const r = remote[field];
    if (!r || typeof r !== 'string') continue;
    if (r.startsWith('data:')) continue;
    const tracked = cached._image_source_urls?.[field];
    if (tracked !== r) return false;
  }

  return true;
}

/**
 * Recursively remove undefined fields from an object
 * to prevent Firestore "Unsupported field value: undefined" errors.
 */
function removeUndefinedFields(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedFields);
  }
  if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      if (obj[key] !== undefined) {
        newObj[key] = removeUndefinedFields(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export type SignatureType = 'director' | 'coordinator' | 'interventoria';

/**
 * Upload a signature image file to Firebase Storage.
 * Path: reports/{reportId}/signature_{type}
 * Returns the download URL.
 */
export async function uploadSignatureImage(
  reportId: string,
  type: SignatureType,
  file: File,
): Promise<string> {
  const path = `reports/${reportId}/signature_${type}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file, STORAGE_UPLOAD_METADATA);
  invalidateImageCache(path);
  return getDownloadURL(storageRef);
}

/**
 * Delete a signature image from Firebase Storage.
 * Silently ignores "not found" errors.
 */
export async function deleteSignatureImage(
  reportId: string,
  type: SignatureType,
): Promise<void> {
  const path = `reports/${reportId}/signature_${type}`;
  const storageRef = ref(storage, path);
  invalidateImageCache(path);
  try {
    await deleteObject(storageRef);
  } catch (e: any) {
    if (e?.code !== 'storage/object-not-found') throw e;
  }
}

/**
 * Returns a copy of the report with all image fields that are currently base64
 * uploaded to Firebase Storage and replaced by their download URLs.
 * Use this before saving the report to Firestore.
 */
export async function reportWithStorageUrls(report: Report): Promise<Report> {
  const out = { ...report };

  delete out._image_source_urls;

  for (const field of REPORT_IMAGE_FIELDS) {
    const value = out[field];
    if (value && isDataUrl(value)) {
      out[field] = await uploadReportImage(report.id, field, value);
    }
  }

  return removeUndefinedFields(out) as Report;
}

/**
 * Returns a copy of the report with all image fields that are Storage URLs
 * fetched and converted to base64 data URLs. Use this before saving the report
 * to IndexedDB so the app can show images offline.
 *
 * When a `cachedReport` is provided, fields whose Storage URL hasn't changed
 * reuse the cached base64 value instead of re-fetching from Storage.
 */
export async function reportWithBase64FromStorage(
  report: Report,
  cachedReport?: Report | null,
): Promise<Report> {
  const out = { ...report };

  await Promise.all(
    REPORT_IMAGE_FIELDS.map(async (field) => {
      const value = out[field];
      if (!value || isDataUrl(value)) return;

      if (cachedReport) {
        const cachedValue = cachedReport[field];
        const cachedUrl = cachedReport._image_source_urls?.[field];
        if (cachedValue && isDataUrl(cachedValue) && cachedUrl === value) {
          out[field] = cachedValue;
          return;
        }
      }

      try {
        out[field] = await storageUrlToDataUrl(value);
      } catch (e) {
        console.warn(`Failed to fetch report image ${field}:`, e);
      }
    }),
  );

  out._image_source_urls = {} as Record<string, string>;
  for (const field of REPORT_IMAGE_FIELDS) {
    const original = report[field];
    if (original && !isDataUrl(original)) {
      out._image_source_urls[field] = original;
    }
  }

  return out;
}
