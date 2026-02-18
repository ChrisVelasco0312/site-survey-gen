import { collection, getDocs, type GeoPoint } from 'firebase/firestore';
import { db } from '../firebase-config';
import type { SiteRecord } from '../types/Report';
import { saveSitesToDB, saveDistritoMunicipioToDB, type DistritoMunicipioEntry } from '../utils/indexedDB';

const SITES_COLLECTION = 'sites';

function mapFirestoreDocToSiteRecord(
  id: string,
  data: Record<string, unknown>
): SiteRecord {
  const loc = data.location as GeoPoint | undefined;
  return {
    id,
    site_code: (data.site_code as string) ?? '',
    site_type: (data.site_type as 'lpr' | 'cotejo_facial') ?? 'lpr',
    distrito: (data.distrito as string) ?? '',
    municipio: (data.municipio as string) ?? '',
    name: (data.name as string) ?? '',
    address: (data.address as string) ?? '',
    location:
      loc != null && typeof loc.latitude === 'number' && typeof loc.longitude === 'number'
        ? { latitude: loc.latitude, longitude: loc.longitude }
        : null,
    cameras_count: typeof data.cameras_count === 'number' ? data.cameras_count : 0,
    description: (data.description as string) ?? '',
  };
}

/**
 * Fetches all sites from Firestore and saves them to IndexedDB.
 * Call when user is logged in and online (e.g. after login) so data is available offline.
 */
export async function fetchSitesAndPersist(): Promise<SiteRecord[]> {
  const snapshot = await getDocs(collection(db, SITES_COLLECTION));
  const sites: SiteRecord[] = [];
  snapshot.forEach((doc) => {
    sites.push(mapFirestoreDocToSiteRecord(doc.id, doc.data() as Record<string, unknown>));
  });
  await saveSitesToDB(sites);
  return sites;
}

const DISTRITO_MUNICIPIO_COLLECTION = 'distrito_municipio';

export async function fetchDistritoMunicipioAndPersist(): Promise<DistritoMunicipioEntry[]> {
  const snapshot = await getDocs(collection(db, DISTRITO_MUNICIPIO_COLLECTION));
  const entries: DistritoMunicipioEntry[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    if (data.distrito && Array.isArray(data.municipios)) {
      entries.push({ distrito: data.distrito as string, municipios: data.municipios as string[] });
    }
  });
  await saveDistritoMunicipioToDB(entries);
  return entries;
}
