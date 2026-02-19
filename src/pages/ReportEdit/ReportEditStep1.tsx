import { useMemo, useState, useEffect } from 'preact/hooks';
import {
  TextInput,
  Select,
  Stack,
  Text,
  Modal,
  Button,
  Box,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { Report, AddressData, InstallationType, SiteRecord } from '../../types/Report';
import { getAllSitesFromDB, getDistritoMunicipioFromDB, type DistritoMunicipioEntry } from '../../utils/indexedDB';
import { fetchSitesAndPersist, fetchDistritoMunicipioAndPersist } from '../../services/sitesService';

const INSTALLATION_TYPE_OPTIONS: { value: InstallationType; label: string }[] = [
  { value: 'fachada_mastil', label: 'Fachada / Mástil' },
  { value: 'poste', label: 'Poste' },
  { value: 'torre', label: 'Torre' },
];

const SITE_TYPE_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'lpr', label: 'LPR' },
  { value: 'cotejo_facial', label: 'Cotejo Facial' },
  { value: 'ptz', label: 'PTZ' },
];

interface ReportEditStep1Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

/** Parses stored date string (DD/MM/YYYY or YYYY-MM-DD) to Date, or null if invalid. */
function parseStoredDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null;
  const ymd = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date(ymd + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = ymd.split(/[/.-]/).map(Number);
  if (parts.length !== 3) return null;
  const date = ymd.includes('-')
    ? new Date(parts[0], parts[1] - 1, parts[2]) // YYYY-MM-DD
    : new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalizes to YYYY-MM-DD (Mantine's DateStringValue). Accepts Date, dayjs, or string. */
function toStoredDateValue(value: Date | { toDate?: () => Date } | string): string {
  if (typeof value === 'string') {
    const parsed = parseStoredDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : '';
  }
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    return '';
  }
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function siteToAddressData(site: SiteRecord): AddressData {
  const lat = site.location?.latitude ?? 0;
  const lng = site.location?.longitude ?? 0;
  return {
    pm_number: site.site_code,
    latitude: lat,
    longitude: lng,
    site_name: site.name,
    full_address: site.address,
    site_id: site.id,
    site_type: site.site_type,
    distrito: site.distrito,
    municipio: site.municipio,
  };
}

/** Format a site/address for display (search by name, code or address). */
function formatSiteOption(addr: AddressData): string {
  const parts = [addr.site_name, addr.pm_number, addr.full_address];
  if (addr.distrito) parts.push(addr.distrito);
  if (addr.municipio) parts.push(addr.municipio);
  return parts.filter(Boolean).join(' — ');
}

function filterAndSearchSites(
  sites: SiteRecord[],
  filterType: string,
  filterDistrito: string,
  filterMunicipio: string,
  searchQuery: string
): SiteRecord[] {
  let list = sites;
  if (filterType) {
    list = list.filter((s) => s.site_type === filterType);
  }
  if (filterDistrito) {
    list = list.filter((s) => s.distrito === filterDistrito);
  }
  if (filterMunicipio) {
    list = list.filter((s) => s.municipio === filterMunicipio);
  }
  const q = searchQuery.trim().toLowerCase();
  if (q) {
    list = list.filter(
      (s) =>
        s.site_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.distrito.toLowerCase().includes(q) ||
        s.municipio.toLowerCase().includes(q)
    );
  }
  return list;
}

export function ReportEditStep1({ report, setReport, readOnly }: ReportEditStep1Props) {
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDistrito, setFilterDistrito] = useState('');
  const [filterMunicipio, setFilterMunicipio] = useState('');
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [distritoMunicipioMap, setDistritoMunicipioMap] = useState<DistritoMunicipioEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    const finish = () => { if (!cancelled) setSitesLoading(false); };
    getAllSitesFromDB()
      .then((cached) => {
        if (cancelled) return;
        if (cached.length > 0) {
          setSites(cached);
          finish();
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchSitesAndPersist()
            .then((fresh) => { if (!cancelled) setSites(fresh); })
            .catch(() => {})
            .finally(finish);
        } else {
          finish();
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSites([]);
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchSitesAndPersist()
            .then((fresh) => { if (!cancelled) setSites(fresh); })
            .catch(() => {})
            .finally(finish);
        } else {
          finish();
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getDistritoMunicipioFromDB()
      .then((cached) => {
        if (cancelled) return;
        if (cached.length > 0) {
          setDistritoMunicipioMap(cached);
          return;
        }
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchDistritoMunicipioAndPersist()
            .then((fresh) => { if (!cancelled) setDistritoMunicipioMap(fresh); })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          fetchDistritoMunicipioAndPersist()
            .then((fresh) => { if (!cancelled) setDistritoMunicipioMap(fresh); })
            .catch(() => {});
        }
      });
    return () => { cancelled = true; };
  }, []);

  const dateDisplayText = useMemo(() => {
    if (!report.date) return '—';
    const d = parseStoredDate(report.date);
    return d ? d.toLocaleDateString('es-CO') : report.date;
  }, [report.date]);

  const hasAddressSelected = useMemo(() => {
    const a = report.address;
    return !!(a?.site_name || a?.pm_number || a?.full_address);
  }, [report.address]);

  const addressDisplayValue = useMemo(() => {
    const a = report.address;
    if (!a?.site_name && !a?.pm_number && !a?.full_address) return '';
    return formatSiteOption(a);
  }, [report.address]);

  const uniqueDistritos = useMemo(() => {
    if (distritoMunicipioMap.length > 0) {
      return distritoMunicipioMap.map((e) => e.distrito).sort();
    }
    const set = new Set(sites.map((s) => s.distrito).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, distritoMunicipioMap]);

  const availableMunicipios = useMemo(() => {
    if (distritoMunicipioMap.length > 0) {
      if (filterDistrito) {
        const entry = distritoMunicipioMap.find((e) => e.distrito === filterDistrito);
        return entry ? entry.municipios : [];
      }
      const all = new Set<string>();
      distritoMunicipioMap.forEach((e) => e.municipios.forEach((m) => all.add(m)));
      return Array.from(all).sort();
    }
    const source = filterDistrito
      ? sites.filter((s) => s.distrito === filterDistrito)
      : sites;
    const set = new Set(source.map((s) => s.municipio).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, distritoMunicipioMap, filterDistrito]);

  const filteredSites = useMemo(
    () =>
      filterAndSearchSites(
        sites,
        filterType,
        filterDistrito,
        filterMunicipio,
        siteSearchQuery
      ),
    [sites, filterType, filterDistrito, filterMunicipio, siteSearchQuery]
  );

  const onDateChange = (value: string | Date | null | unknown) => {
    if (value == null) {
      setReport({ ...report, date: '', updated_at: Date.now() });
      return;
    }
    const dateStr =
      typeof value === 'string'
        ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toStoredDateValue(value))
        : toStoredDateValue(value as Date | { toDate: () => Date });
    setReport({ ...report, date: dateStr, updated_at: Date.now() });
  };

  const onInstallationTypeChange = (value: string | null) => {
    setReport({
      ...report,
      installation_type: value ? [value as InstallationType] : [],
      updated_at: Date.now(),
    });
  };

  const onSelectSite = (site: SiteRecord) => {
    setReport({
      ...report,
      address: siteToAddressData(site),
      updated_at: Date.now(),
    });
    setSiteModalOpen(false);
    setSiteSearchQuery('');
  };

  const closeModal = () => {
    setSiteModalOpen(false);
    setSiteSearchQuery('');
    setFilterType('');
    setFilterDistrito('');
    setFilterMunicipio('');
  };

  if (readOnly) {
    return (
      <Stack gap="md">
        <Text size="sm" fw={500} c="dimmed">Fecha</Text>
        <Text>{dateDisplayText}</Text>
        <Text size="sm" fw={500} c="dimmed">Tipo de instalación</Text>
        <Text>
          {report.installation_type.length
            ? report.installation_type
                .map((t) => INSTALLATION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t)
                .join(', ')
            : '—'}
        </Text>
        <Text size="sm" fw={500} c="dimmed">Dirección / Sitio</Text>
        <Text>{addressDisplayValue || '—'}</Text>
        {report.address.latitude !== 0 && report.address.longitude !== 0 && (
          <Text size="xs" c="dimmed">
            Coordenadas: {report.address.latitude.toFixed(5)}, {report.address.longitude.toFixed(5)}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <DateInput
        label="Fecha"
        value={
          report.date
            ? parseStoredDate(report.date)?.toISOString().slice(0, 10) ?? report.date
            : null
        }
        onChange={onDateChange}
        placeholder="Seleccione la fecha"
        valueFormat="DD/MM/YYYY"
        dateParser={(input) => {
          const parsed = parseStoredDate(input);
          return parsed ?? null;
        }}
        clearable
      />
      <Select
        label="Tipo de instalación"
        placeholder="Seleccione uno"
        data={INSTALLATION_TYPE_OPTIONS}
        value={report.installation_type[0] || null}
        onChange={onInstallationTypeChange}
      />
      <Box>
        <Text size="sm" fw={500} mb="xs" component="label" display="block">
          Dirección / Sitio
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Seleccione un sitio de la lista (filtrable por tipo, distrito y municipio). La información quedará fija.
        </Text>
        {hasAddressSelected ? (
          <Stack gap="xs">
            <Box
              py="sm"
              px="md"
              style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)' }}
            >
              <Text size="sm" fw={500}>{report.address.site_name}</Text>
              <Text size="xs" c="dimmed">{report.address.full_address}</Text>
              {(report.address.distrito || report.address.municipio) && (
                <Text size="xs" c="dimmed">{report.address.distrito} / {report.address.municipio}</Text>
              )}
              <Text size="xs" c="dimmed" mt={4}>
                Lat: {report.address.latitude.toFixed(5)}, Long: {report.address.longitude.toFixed(5)}
              </Text>
            </Box>
            <Button variant="light" size="xs" onClick={() => setSiteModalOpen(true)}>
              Cambiar sitio
            </Button>
          </Stack>
        ) : (
          <Button onClick={() => setSiteModalOpen(true)} loading={sitesLoading}>
            Seleccionar sitio
          </Button>
        )}
      </Box>

      <Modal
        title="Seleccionar sitio"
        opened={siteModalOpen}
        onClose={closeModal}
        size="lg"
        styles={{
          content: { maxHeight: 'min(680px, calc(100vh - 40px))', display: 'flex', flexDirection: 'column' },
          header: { flex: '0 0 auto' },
          body: { flex: '1 1 auto', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 },
        }}
      >
        <Stack gap="md" style={{ flex: '0 0 auto' }}>
          <Select
            label="Tipo"
            placeholder="Todos"
            data={SITE_TYPE_OPTIONS}
            value={filterType || null}
            onChange={(v) => setFilterType(v ?? '')}
            clearable
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            label="Distrito"
            placeholder="Todos"
            data={uniqueDistritos.map((d) => ({ value: d, label: d }))}
            value={filterDistrito || null}
            onChange={(v) => {
              setFilterDistrito(v ?? '');
              setFilterMunicipio('');
            }}
            clearable
            searchable
            comboboxProps={{ withinPortal: false }}
          />
          <Select
            label="Municipio"
            placeholder="Todos"
            data={availableMunicipios.map((m) => ({ value: m, label: m }))}
            value={filterMunicipio || null}
            onChange={(v) => {
              const mun = v ?? '';
              setFilterMunicipio(mun);
              if (mun && !filterDistrito) {
                const parent = distritoMunicipioMap.find((e) => e.municipios.includes(mun));
                if (parent) {
                  setFilterDistrito(parent.distrito);
                } else {
                  const match = sites.find((s) => s.municipio === mun && s.distrito);
                  if (match) setFilterDistrito(match.distrito);
                }
              }
            }}
            clearable
            searchable
            comboboxProps={{ withinPortal: false }}
          />
          <TextInput
            placeholder="Buscar por código, nombre, dirección, distrito o municipio..."
            value={siteSearchQuery}
            onInput={(e) => setSiteSearchQuery((e.target as HTMLInputElement).value)}
          />
        </Stack>
        <div
          style={{
            flex: '1 1 auto',
            overflowY: 'auto',
            marginTop: 12,
            minHeight: 0,
          }}
        >
          <Stack gap="xs">
            {filteredSites.length === 0 ? (
              <Text size="sm" c="dimmed">
                {sites.length === 0
                  ? 'No hay sitios en caché. Inicia sesión con conexión para cargarlos.'
                  : 'Ningún sitio coincide con los filtros.'}
              </Text>
            ) : (
              filteredSites.map((site) => (
                <Box
                  key={site.id}
                  py="sm"
                  px="md"
                  style={{
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectSite(site)}
                  role="button"
                >
                  <Text size="sm" fw={500}>{site.site_code}</Text>
                  <Text size="xs" c="dimmed">{site.address}</Text>
                  <Text size="xs" c="dimmed">{site.distrito} / {site.municipio}</Text>
                  {site.location && (
                    <Text size="xs" c="dimmed">
                      {site.location.latitude.toFixed(5)}, {site.location.longitude.toFixed(5)}
                    </Text>
                  )}
                </Box>
              ))
            )}
          </Stack>
        </div>
      </Modal>
    </Stack>
  );
}
