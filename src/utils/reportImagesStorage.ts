import { ref, uploadBytes, getDownloadURL, deleteObject, getBlob, getMetadata } from 'firebase/storage';
import type { UploadMetadata } from 'firebase/storage';
import { storage } from '../firebase-config';
import type { Report } from '../types/Report';
import { parseFirebaseStorageHttpUrl, storageRefFromUrlOrPath } from './firebaseStorageRef';
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

export function invalidateImageCache(url: string) {
  invalidateResolvedStorageUrlCache(url);
}

/**
 * Returns a copy of the report with _image_source_urls cleared for the given
 * fields. Call this when an image field is set to a new base64 value so the
 * next save knows to upload the new image instead of reusing the old URL.
 */
export function clearImageSourceUrls(report: Report, ...fields: string[]): Report {
  const sourceUrls = report._image_source_urls;
  if (!sourceUrls || fields.length === 0) return report;
  const next = { ...sourceUrls };
  let changed = false;
  for (const f of fields) {
    if (f in next) {
      delete next[f];
      changed = true;
    }
  }
  if (!changed) return report;
  return { ...report, _image_source_urls: next };
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
  cacheControl: 'no-cache, no-store, max-age=0, must-revalidate',
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
  _versionTag?: number,
): Promise<string> {
  const ext = getExtensionFromDataUrl(dataUrl);
  const path = `reports/${reportId}/${field}.${ext}`;
  const storageRef = ref(storage, path);
  const blob = await dataUrlToBlob(dataUrl);
  await uploadBytes(storageRef, blob, STORAGE_UPLOAD_METADATA);
  const downloadUrl = await getDownloadURL(storageRef);
  invalidateImageCache(path);
  invalidateImageCache(downloadUrl);
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
  let blob: Blob;
  const isFirebaseSource =
    !url.startsWith('http') ||
    url.startsWith('gs://') ||
    parseFirebaseStorageHttpUrl(url) !== null;
  try {
    if (isFirebaseSource) {
      blob = await getBlob(storageRefFromUrlOrPath(url));
    } else {
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      blob = await response.blob();
    }
  } catch (error) {
    if (!isStorageNotFoundError(error)) {
      console.warn(`getBlob failed for ${url}, falling back to fresh download URL:`, error);
    }
    if (!isFirebaseSource) {
      throw error;
    }
    const fetchUrl = await getDownloadURL(storageRefFromUrlOrPath(url));
    const response = await fetch(fetchUrl, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error(`Storage fetch failed: ${response.status}`);
    blob = await response.blob();
  }

  const dataUrl = await blobToDataUrl(blob);
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

function isStorageNotFoundError(error: any): boolean {
  if (!error) return false;
  const code = error.code;
  const message = String(error.message ?? '');
  return (
    code === 'storage/object-not-found' ||
    code === 404 ||
    error.status === 404 ||
    message.includes('Not Found') ||
    message.includes('object-not-found')
  );
}

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
  const downloadUrl = await getDownloadURL(storageRef);
  invalidateImageCache(path);
  invalidateImageCache(downloadUrl);
  return downloadUrl;
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
    if (!isStorageNotFoundError(e)) throw e;
  }
}

async function deleteStorageObjectByUrl(urlOrPath: string): Promise<void> {
  if (!urlOrPath || isDataUrl(urlOrPath)) return;
  const storageRef = storageRefFromUrlOrPath(urlOrPath);
  try {
    await getMetadata(storageRef);
  } catch (e: any) {
    if (isStorageNotFoundError(e)) return;
    throw e;
  }

  try {
    await deleteObject(storageRef);
  } catch (e: any) {
    if (!isStorageNotFoundError(e)) throw e;
  }
}

function toStorageUrl(value?: string): string | null {
  if (!value || typeof value !== 'string' || isDataUrl(value)) return null;
  return value;
}

function getStorageObjectKey(urlOrPath: string): string {
  const parsed = parseFirebaseStorageHttpUrl(urlOrPath);
  if (parsed) return `${parsed.bucket}/${parsed.fullPath}`;
  return urlOrPath.trim();
}

export function getStaleReportImageUrls(
  previousReport: Report | null | undefined,
  nextReport: Report,
): string[] {
  if (!previousReport) return [];
  const stale = new Set<string>();

  for (const field of REPORT_IMAGE_FIELDS) {
    const prevUrl = toStorageUrl(previousReport[field]);
    if (!prevUrl) continue;
    const nextUrl = toStorageUrl(nextReport[field]);
    const prevKey = getStorageObjectKey(prevUrl);
    const nextKey = nextUrl ? getStorageObjectKey(nextUrl) : null;
    if (prevKey !== nextKey) {
      stale.add(prevUrl);
    }
  }

  return [...stale];
}

export async function deleteReportImageUrls(urls: string[]): Promise<void> {
  for (const url of urls) {
    await deleteStorageObjectByUrl(url);
  }
}

/**
 * Returns a copy of the report with all image fields that are currently base64
 * uploaded to Firebase Storage and replaced by their download URLs.
 * Use this before saving the report to Firestore.
 */
export async function reportWithStorageUrls(
  report: Report,
  _previousReport?: Report | null,
): Promise<Report> {
  const out = { ...report };

  delete out._image_source_urls;

  for (const field of REPORT_IMAGE_FIELDS) {
    const value = out[field];
    if (!value) {
      continue;
    }
    if (!isDataUrl(value)) {
      continue;
    }

    // Reuse existing Storage URL if the image hasn't changed since last fetch
    const previousUrl = report._image_source_urls?.[field];
    if (previousUrl && typeof previousUrl === 'string') {
      out[field] = previousUrl;
      continue;
    }

    out[field] = await uploadReportImage(report.id, field, value, report.updated_at);
  }

  return removeUndefinedFields(out) as Report;
}

/**
 * Returns a copy of the report with all image fields that are Storage URLs
 * fetched and converted to base64 data URLs. Use this before saving the report
 * to IndexedDB so the app can show images offline.
 *
 * When a `cachedReport` is provided, fields whose Storage URL hasn't changed
 * reuse the cached base64 value only when cache and remote refer to the same
 * report version (`updated_at`) and the source is not an HTTP download URL,
 * to avoid stale images when Storage objects are overwritten in-place.
 */
export async function reportWithBase64FromStorage(
  report: Report,
  _cachedReport?: Report | null,
): Promise<Report> {
  const out = { ...report };

  await Promise.all(
    REPORT_IMAGE_FIELDS.map(async (field) => {
      const value = out[field];
      if (!value || isDataUrl(value)) return;

      try {
        out[field] = await storageUrlToDataUrl(value);
      } catch (e) {
        if (isStorageNotFoundError(e)) {
          out[field] = '';
          return;
        }
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
