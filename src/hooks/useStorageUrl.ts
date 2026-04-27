import { useState, useEffect } from 'preact/hooks';
import { getDownloadURL } from 'firebase/storage';
import { storageRefFromUrlOrPath } from '../utils/firebaseStorageRef';

export async function resolveStorageUrl(urlOrPath: string): Promise<string> {
  if (urlOrPath.startsWith('data:')) return urlOrPath;

  let resolvedUrl = urlOrPath;
  if (!urlOrPath.startsWith('http')) {
    try {
      resolvedUrl = await getDownloadURL(storageRefFromUrlOrPath(urlOrPath));
    } catch (e) {
      console.warn('Error resolving storage URL, using original', e);
    }
  }
  return resolvedUrl;
}

export function invalidateResolvedStorageUrlCache(_urlOrPath: string) {
  // No-op: URL cache was intentionally removed.
}

export function useStorageUrl(urlOrPath?: string | null) {
  const [url, setUrl] = useState<string | undefined>(() => {
    if (!urlOrPath) return undefined;
    if (urlOrPath.startsWith('data:')) return urlOrPath;
    return undefined;
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
