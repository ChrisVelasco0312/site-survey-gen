import { SiteRecord } from '../types/Report';

export interface DistritoMunicipioMap {
  [distrito: string]: string[];
}

/**
 * Extracts the relationship between Distrito and Municipio from a list of sites.
 * Returns an object where keys are Distritos and values are arrays of unique Municipios belonging to that Distrito.
 * Also includes a special key '' (empty string) that contains all unique municipios across all districts.
 */
export function extractDistritoMunicipioRelation(sites: SiteRecord[]): DistritoMunicipioMap {
  const relation: DistritoMunicipioMap = {};
  const allMunicipios = new Set<string>();

  sites.forEach((site) => {
    // Skip if missing critical data
    if (!site.distrito || !site.municipio) return;

    const dist = site.distrito;
    const mun = site.municipio;

    // Initialize array for this district if not exists
    if (!relation[dist]) {
      relation[dist] = [];
    }

    // Add municipio if not already in the district's list
    if (!relation[dist].includes(mun)) {
      relation[dist].push(mun);
    }
    
    // Add to global set
    allMunicipios.add(mun);
  });

  // Sort municipios for consistent display
  Object.keys(relation).forEach((dist) => {
    relation[dist].sort();
  });

  // Add global list of all municipios (sorted)
  relation[''] = Array.from(allMunicipios).sort();

  return relation;
}

/**
 * Get all unique distritos sorted.
 */
export function getUniqueDistritos(sites: SiteRecord[]): string[] {
  const distritos = new Set<string>();
  sites.forEach((site) => {
    if (site.distrito) {
      distritos.add(site.distrito);
    }
  });
  return Array.from(distritos).sort();
}
