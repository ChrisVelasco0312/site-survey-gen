import * as XLSX from 'xlsx';
import type { SiteRecord } from '../types/Report';

const HEADERS = [
  'site_code',
  'site_type',
  'distrito',
  'municipio',
  'name',
  'address',
  'gms',
  'latitude',
  'longitude',
  'cameras_count',
  'description',
] as const;

const VALID_SITE_TYPES = ['lpr', 'cotejo_facial', 'ptz'] as const;

type SiteType = (typeof VALID_SITE_TYPES)[number];

const GMS_REGEX = /^(\d+)°(\d+)'(\d+)"([NSns])\s+(\d+)°(\d+)'(\d+)"([EWew])$/;

function parseGMS(gms: string): { latitude: number; longitude: number } | null {
  const match = gms.trim().match(GMS_REGEX);
  if (!match) return null;
  const [, latDeg, latMin, latSec, latDir, lonDeg, lonMin, lonSec, lonDir] = match;
  let latitude = parseInt(latDeg) + parseInt(latMin) / 60 + parseInt(latSec) / 3600;
  let longitude = parseInt(lonDeg) + parseInt(lonMin) / 60 + parseInt(lonSec) / 3600;
  if (latDir.toUpperCase() === 'S') latitude = -latitude;
  if (lonDir.toUpperCase() === 'W') longitude = -longitude;
  return { latitude, longitude };
}

function formatToGMS(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';
  const absLat = Math.abs(latitude);
  const absLon = Math.abs(longitude);
  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = Math.round((absLat - latDeg - latMin / 60) * 3600);
  const lonDeg = Math.floor(absLon);
  const lonMin = Math.floor((absLon - lonDeg) * 60);
  const lonSec = Math.round((absLon - lonDeg - lonMin / 60) * 3600);
  return `${latDeg}°${latMin}'${latSec}"${latDir} ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
}

export interface ParsedSiteRow {
  site_code: string;
  site_type: SiteType;
  distrito: string;
  municipio: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  cameras_count: number;
  description: string;
}

export interface FailedRow {
  rowNumber: number;
  site_code: string;
  reasons: string[];
}

export interface ParseResult {
  rows: ParsedSiteRow[];
  failed: FailedRow[];
}

function siteToRow(site: SiteRecord): Record<string, unknown> {
  const lat = site.location?.latitude;
  const lon = site.location?.longitude;
  return {
    site_code: site.site_code,
    site_type: site.site_type,
    distrito: site.distrito,
    municipio: site.municipio,
    name: site.name,
    address: site.address,
    gms: lat != null && lon != null ? formatToGMS(lat, lon) : '',
    latitude: lat ?? '',
    longitude: lon ?? '',
    cameras_count: site.cameras_count,
    description: site.description,
  };
}

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([HEADERS as unknown as string[]]);
  ws['!cols'] = [15, 15, 20, 20, 25, 35, 28, 14, 14, 14, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Sitios');
  XLSX.writeFile(wb, 'plantilla_sitios.xlsx');
}

export function exportSitesToExcel(sites: SiteRecord[], filename = 'sitios.xlsx'): void {
  const rows = sites.map(siteToRow);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows, { header: [...HEADERS] });
  ws['!cols'] = [15, 15, 20, 20, 25, 35, 28, 14, 14, 14, 30].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Sitios');
  XLSX.writeFile(wb, filename);
}

export function parseExcelFile(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target!.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

        const rows: ParsedSiteRow[] = [];
        const failed: FailedRow[] = [];

        json.forEach((raw, idx) => {
          const rowNumber = idx + 2; // 1-indexed header + 1
          const reasons: string[] = [];

          const siteCode = String(raw['site_code'] ?? '').trim();
          if (!siteCode) {
            reasons.push('site_code vacío');
          }

          const rawType = String(raw['site_type'] ?? '').trim().toLowerCase();
          if (!rawType) {
            reasons.push('site_type vacío');
          } else if (!VALID_SITE_TYPES.includes(rawType as SiteType)) {
            reasons.push(`site_type inválido: "${rawType}" (debe ser lpr, cotejo_facial o ptz)`);
          }
          const siteType: SiteType = VALID_SITE_TYPES.includes(rawType as SiteType)
            ? (rawType as SiteType)
            : 'lpr';

          const distrito = String(raw['distrito'] ?? '').trim();
          if (!distrito) reasons.push('distrito vacío');

          const municipio = String(raw['municipio'] ?? '').trim();
          if (!municipio) reasons.push('municipio vacío');

          const name = String(raw['name'] ?? '').trim();
          if (!name) reasons.push('name vacío');

          const address = String(raw['address'] ?? '').trim();
          if (!address) reasons.push('address vacío');

          // --- Location resolution: GMS takes priority ---
          let latitude: number | null = null;
          let longitude: number | null = null;

          const rawGms = String(raw['gms'] ?? '').trim();
          if (rawGms) {
            const parsed = parseGMS(rawGms);
            if (parsed) {
              latitude = parsed.latitude;
              longitude = parsed.longitude;
            } else {
              reasons.push(`gms inválido: "${rawGms}" (formato: 3°48'44"N 76°37'18"W)`);
            }
          } else {
            const rawLat = raw['latitude'];
            const rawLon = raw['longitude'];
            const hasLat = rawLat != null && rawLat !== '';
            const hasLon = rawLon != null && rawLon !== '';

            if (hasLat && hasLon) {
              const lat = Number(rawLat);
              const lon = Number(rawLon);
              if (isNaN(lat)) reasons.push(`latitude no es un número válido: "${rawLat}"`);
              else latitude = lat;
              if (isNaN(lon)) reasons.push(`longitude no es un número válido: "${rawLon}"`);
              else longitude = lon;
            } else if (hasLat && !hasLon) {
              reasons.push('longitude vacío (si latitude está presente, longitude es obligatorio)');
            } else if (!hasLat && hasLon) {
              reasons.push('latitude vacío (si longitude está presente, latitude es obligatorio)');
            } else {
              reasons.push('ubicación requerida: llene gms, o tanto latitude como longitude');
            }
          }

          if (reasons.length > 0) {
            failed.push({ rowNumber, site_code: siteCode || `(fila ${rowNumber})`, reasons });
            return;
          }

          rows.push({
            site_code: siteCode,
            site_type: siteType,
            distrito,
            municipio,
            name,
            address,
            latitude: latitude!,
            longitude: longitude!,
            cameras_count: Math.max(0, Math.floor(Number(raw['cameras_count'] ?? 0)) || 0),
            description: String(raw['description'] ?? '').trim(),
          });
        });

        resolve({ rows, failed });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export interface UpsertPlan {
  toCreate: ParsedSiteRow[];
  toUpdate: { id: string; data: ParsedSiteRow }[];
  unchanged: number;
  failed: FailedRow[];
}

export function buildUpsertPlan(
  parseResult: ParseResult,
  existingSites: SiteRecord[],
): UpsertPlan {
  const byCode = new Map<string, SiteRecord>();
  for (const site of existingSites) {
    byCode.set(site.site_code.trim().toLowerCase(), site);
  }

  const toCreate: ParsedSiteRow[] = [];
  const toUpdate: { id: string; data: ParsedSiteRow }[] = [];
  let unchanged = 0;

  for (const row of parseResult.rows) {
    const key = row.site_code.trim().toLowerCase();
    const existing = byCode.get(key);

    if (!existing) {
      toCreate.push(row);
    } else {
      const hasChanges =
        existing.site_type !== row.site_type ||
        existing.distrito !== row.distrito ||
        existing.municipio !== row.municipio ||
        existing.name !== row.name ||
        existing.address !== row.address ||
        existing.cameras_count !== row.cameras_count ||
        existing.description !== row.description ||
        (existing.location?.latitude ?? null) !== row.latitude ||
        (existing.location?.longitude ?? null) !== row.longitude;

      if (hasChanges) {
        toUpdate.push({ id: existing.id, data: row });
      } else {
        unchanged++;
      }
    }
  }

  return { toCreate, toUpdate, unchanged, failed: parseResult.failed };
}

export function parsedRowToSitePayload(row: ParsedSiteRow): Omit<SiteRecord, 'id'> {
  return {
    site_code: row.site_code,
    site_type: row.site_type,
    distrito: row.distrito,
    municipio: row.municipio,
    name: row.name,
    address: row.address,
    location: { latitude: row.latitude, longitude: row.longitude },
    cameras_count: row.cameras_count,
    description: row.description,
  };
}
