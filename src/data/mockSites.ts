import type { AddressData } from '../types/Report';

/**
 * Mock list of sites for the address selector (Paso 1 - HU-12).
 * In production this could come from a real API or Firestore collection.
 */
export const MOCK_SITES: AddressData[] = [
  {
    pm_number: 'PM-101',
    latitude: 4.6097,
    longitude: -74.0817,
    site_name: 'Torre Norte - Bogotá',
    full_address: 'Carrera 15 # 32-45, Bogotá D.C.',
  },
  {
    pm_number: 'PM-102',
    latitude: 4.6351,
    longitude: -74.0836,
    site_name: 'Fachada Centro',
    full_address: 'Calle 80 # 12-30, Bogotá D.C.',
  },
  {
    pm_number: 'PM-103',
    latitude: 4.6486,
    longitude: -74.0577,
    site_name: 'Poste Sur - Chapinero',
    full_address: 'Avenida Chile # 45-20, Bogotá D.C.',
  },
  {
    pm_number: 'PM-104',
    latitude: 4.7110,
    longitude: -74.0721,
    site_name: 'Torre Suba',
    full_address: 'Calle 145 # 90-10, Bogotá D.C.',
  },
  {
    pm_number: 'PM-105',
    latitude: 4.5981,
    longitude: -74.0758,
    site_name: 'Mastil Kennedy',
    full_address: 'Diagonal 38 Sur # 78-15, Bogotá D.C.',
  },
];

/** Format a site for Autocomplete display (search by name, PM or address). */
export function formatSiteOption(site: AddressData): string {
  return `${site.site_name} (${site.pm_number}) — ${site.full_address}`;
}

/** Find sites matching a query (by name, PM number or address). */
export function searchMockSites(query: string): AddressData[] {
  const q = query.trim().toLowerCase();
  if (!q) return MOCK_SITES;
  return MOCK_SITES.filter(
    (s) =>
      s.site_name.toLowerCase().includes(q) ||
      s.pm_number.toLowerCase().includes(q) ||
      s.full_address.toLowerCase().includes(q)
  );
}
