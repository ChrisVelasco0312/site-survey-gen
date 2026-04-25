import type { FirebaseStorage, StorageReference } from 'firebase/storage';
import { getStorage, ref } from 'firebase/storage';
import app, { firebaseConfig, storage } from '../firebase-config';

const storageByBucketGs = new Map<string, FirebaseStorage>();

function defaultBucketId(): string {
  const b = firebaseConfig.storageBucket;
  if (!b) throw new Error('storageBucket is not configured');
  return b;
}

/**
 * Firebase Storage instance for a bucket id (e.g. project.appspot.com or project.firebasestorage.app).
 * URLs in Firestore may point at a different bucket than the one in current env — using the wrong
 * instance causes getDownloadURL / getBlob to fail with permission or wrong-object errors.
 */
export function getStorageForBucketId(bucketId: string): FirebaseStorage {
  const id = bucketId.replace(/^gs:\/\//, '');
  if (id === defaultBucketId()) return storage;
  const gs = `gs://${id}`;
  let inst = storageByBucketGs.get(gs);
  if (!inst) {
    inst = getStorage(app, gs);
    storageByBucketGs.set(gs, inst);
  }
  return inst;
}

/** Parse gs://bucket/path/to/object */
export function parseGsUrl(value: string): { bucket: string; fullPath: string } | null {
  const v = value.trim();
  if (!v.startsWith('gs://')) return null;
  const rest = v.slice(5);
  const i = rest.indexOf('/');
  if (i === -1) return null;
  const bucket = rest.slice(0, i);
  const fullPath = rest.slice(i + 1);
  if (!bucket || !fullPath) return null;
  return { bucket, fullPath };
}

/**
 * Parse https://firebasestorage.googleapis.com/v0/b/BUCKET/o/ENCODED_PATH?...
 */
export function parseFirebaseStorageHttpUrl(
  value: string,
): { bucket: string; fullPath: string } | null {
  try {
    const u = new URL(value.trim());
    if (!u.hostname.includes('firebasestorage.googleapis.com')) return null;
    const m = u.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    if (!m) return null;
    const bucket = decodeURIComponent(m[1]);
    const fullPath = decodeURIComponent(m[2].replace(/\+/g, '%20'));
    if (!bucket || !fullPath) return null;
    return { bucket, fullPath };
  } catch {
    return null;
  }
}

/**
 * Build a {@link StorageReference} from a Storage path or any supported URL shape.
 * Always use this instead of ref(storage, rawString) when the string may be a full download URL.
 */
export function storageRefFromUrlOrPath(value: string): StorageReference {
  const v = value.trim();
  if (!v) throw new Error('Empty storage path or URL');

  const gs = parseGsUrl(v);
  if (gs) return ref(getStorageForBucketId(gs.bucket), gs.fullPath);

  const http = parseFirebaseStorageHttpUrl(v);
  if (http) return ref(getStorageForBucketId(http.bucket), http.fullPath);

  return ref(storage, v);
}
