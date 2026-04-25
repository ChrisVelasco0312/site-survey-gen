import { useState, useEffect } from 'preact/hooks';
import { getDownloadURL } from 'firebase/storage';
import { storageRefFromUrlOrPath } from '../utils/firebaseStorageRef';

const urlCache = new Map<string, string>();

export async function resolveStorageUrl(urlOrPath: string): Promise<string> {
  if (urlOrPath.startsWith('data:')) return urlOrPath;
  if (urlCache.has(urlOrPath)) return urlCache.get(urlOrPath)!;

  let resolvedUrl = urlOrPath;
  if (!urlOrPath.startsWith('http') || urlOrPath.includes('firebasestorage.googleapis.com') || urlOrPath.startsWith('gs://')) {
    try {
      resolvedUrl = await getDownloadURL(storageRefFromUrlOrPath(urlOrPath));
      urlCache.set(urlOrPath, resolvedUrl);
    } catch (e) {
      console.warn('Error resolving storage URL, using original', e);
    }
  } else {
    urlCache.set(urlOrPath, resolvedUrl);
  }
  return resolvedUrl;
}

export function invalidateResolvedStorageUrlCache(urlOrPath: string) {
  urlCache.delete(urlOrPath);
}

export function useStorageUrl(urlOrPath?: string | null) {
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!urlOrPath) return undefined;
    if (urlOrPath.startsWith('data:')) return urlOrPath;
    return urlCache.get(urlOrPath) || undefined;
  });

  useEffect(() => {
    if (!urlOrPath) {
      setUrl(undefined);
      return;
    }
    if (urlOrPath.startsWith('data:')) {
      setUrl(urlOrPath);
      return;
    }
    
    let isMounted = true;
    resolveStorageUrl(urlOrPath).then(resolved => {
      if (isMounted) setUrl(resolved);
    });
    return () => { isMounted = false; };
  }, [urlOrPath]);

  return url || urlOrPath || undefined;
}
