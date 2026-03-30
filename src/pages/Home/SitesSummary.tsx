import { useEffect, useState, useMemo } from 'preact/hooks';
import { Title, Card, Grid, Text, Group, RingProgress, Table, Loader, Badge, ScrollArea, Select, Button, Collapse, Stack, MultiSelect, Tabs, Modal, Tooltip, ActionIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFilter, IconX, IconCamera, IconFileSpreadsheet, IconTable, IconMapPin, IconEye } from '@tabler/icons-react';
import * as XLSX from 'xlsx';
import type { SiteRecord, Report, ReportStatus, HardwareInventory } from '../../types/Report';
import { getAllReports } from '../../services/reportsService';
import { fetchSitesAndPersist } from '../../services/sitesService';

type ExtendedStatus = ReportStatus | 'sin_iniciar';

const SITE_TYPE_LABELS: Record<string, string> = {
  lpr: 'LPR',
  cotejo_facial: 'Facial',
  ptz: 'PTZ',
};

const DISTRICT_BREAKDOWN_LABELS: Record<string, string> = {
  ptz: 'Componente 1',
  lpr: 'Componente 2',
  cotejo_facial: 'Componente 3',
};

type CameraFieldKey = keyof Pick<HardwareInventory, 'cameras_multisensor' | 'cameras_ptz' | 'cameras_fixed' | 'cameras_facial' | 'cameras_lpr'>;
type ComponentKey = 'componente_1' | 'componente_2' | 'componente_3';

const COMPONENT_CAMERA_LIMITS: Record<ComponentKey, { title: string; siteLimit: number; cameras: { label: string; key: CameraFieldKey; limit: number }[] }> = {
  componente_1: {
    title: 'Componente 1',
    siteLimit: 161,
    cameras: [
      { label: 'PTZ', key: 'cameras_ptz', limit: 161 },
      { label: 'Fijas', key: 'cameras_fixed', limit: 305 },
    ],
  },
  componente_2: {
    title: 'Componente 2',
    siteLimit: 29,
    cameras: [
      { label: 'LPR', key: 'cameras_lpr', limit: 54 },
    ],
  },
  componente_3: {
    title: 'Componente 3',
    siteLimit: 32,
    cameras: [
      { label: 'Facial', key: 'cameras_facial', limit: 32 },
    ],
  },
};

const CAMERA_FIELDS_BY_SITE_TYPE: Record<string, { key: CameraFieldKey; label: string }[]> = {
  ptz: [
    { key: 'cameras_multisensor', label: 'Multisensor' },
    { key: 'cameras_ptz', label: 'PTZ' },
    { key: 'cameras_fixed', label: 'Fijas' },
  ],
  cotejo_facial: [
    { key: 'cameras_facial', label: 'Facial' },
  ],
  lpr: [
    { key: 'cameras_lpr', label: 'LPR' },
    { key: 'cameras_ptz', label: 'PTZ' },
  ],
};

type SummaryCounts = Record<ExtendedStatus, number> & { total: number };

export function SitesSummary() {
  const [reports, setReports] = useState<Report[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtersOpened, { toggle: toggleFilters }] = useDisclosure(false);
  const [filterDistrito, setFilterDistrito] = useState<string | null>(null);
  const [filterMunicipio, setFilterMunicipio] = useState<string | null>(null);
  const [filterSiteType, setFilterSiteType] = useState<string | null>(null);
  const [hiddenColumns, setHiddenColumns] = useState<Array<'total' | ExtendedStatus>>([]);

  // Detail modal
  type ModalSite = {
    siteCode: string;
    name: string;
    address: string;
    siteType: string;
    distrito: string;
    municipio: string;
    camerasCount: number;
    status: ExtendedStatus;
    updatedAt: number | null;
    description: string;
    hasReport: boolean;
    cameras: { label: string; count: number }[];
  };
  const [modalOpened, setModalOpened] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalSites, setModalSites] = useState<ModalSite[]>([]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getAllReports(),
      fetchSitesAndPersist()
    ]).then(([reportsData, sitesData]) => {
      if (mounted) {
        setReports(reportsData);
        setSites(sitesData);
        setLoading(false);
      }
    }).catch(error => {
      console.error("Error loading summary data:", error);
      if (mounted) setLoading(false);
    });

    return () => { mounted = false; };
  }, []);

  const uniqueDistritos = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < sites.length; i++) {
      if (sites[i].distrito) set.add(sites[i].distrito);
    }
    return Array.from(set).sort();
  }, [sites]);

  const uniqueMunicipios = useMemo(() => {
    const set = new Set<string>();
    for (let i = 0; i < sites.length; i++) {
      if (filterDistrito && sites[i].distrito !== filterDistrito) continue;
      if (sites[i].municipio) set.add(sites[i].municipio);
    }
    return Array.from(set).sort();
  }, [sites, filterDistrito]);

  const latestReportBySite = useMemo(() => {
    const map = new Map<string, Report>();
    for (let i = 0; i < reports.length; i++) {
      const r = reports[i];
      const siteId = r.address?.site_id;
      if (siteId) {
        const existing = map.get(siteId);
        if (!existing || r.updated_at > existing.updated_at) {
          map.set(siteId, r);
        }
      }
    }
    return map;
  }, [reports]);

  const clearFilters = () => {
    setFilterDistrito(null);
    setFilterMunicipio(null);
    setFilterSiteType(null);
  };

  const hasActiveFilters = !!(filterDistrito || filterMunicipio || filterSiteType);

  const openSitesModal = (title: string, matchDistrict?: string, matchMunicipality?: string, matchSiteType?: string) => {
    const result: ModalSite[] = [];
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (filterDistrito && site.distrito !== filterDistrito) continue;
      if (filterMunicipio && site.municipio !== filterMunicipio) continue;
      if (filterSiteType && site.site_type !== filterSiteType) continue;

      const district = site.distrito || 'Sin Distrito';
      const municipality = site.municipio || 'Sin Municipio';
      const siteType = site.site_type || 'lpr';

      if (matchDistrict && district !== matchDistrict) continue;
      if (matchMunicipality && municipality !== matchMunicipality) continue;
      if (matchSiteType && siteType !== matchSiteType) continue;

      const report = latestReportBySite.get(site.id);
      result.push({
        siteCode: site.site_code,
        name: site.name,
        address: site.address,
        siteType,
        distrito: district,
        municipio: municipality,
        camerasCount: site.cameras_count,
        status: report ? report.status : 'sin_iniciar',
        updatedAt: report ? report.updated_at : null,
        description: site.description,
        hasReport: !!report,
        cameras: (() => {
          if (!report?.hardware) return [];
          const fields = CAMERA_FIELDS_BY_SITE_TYPE[siteType];
          if (!fields) return [];
          const details: { label: string; count: number }[] = [];
          for (let f = 0; f < fields.length; f++) {
            const value = report.hardware[fields[f].key] || 0;
            if (value > 0) {
              details.push({ label: fields[f].label, count: value });
            }
          }
          return details;
        })(),
      });
    }
    result.sort((a, b) => a.siteCode.localeCompare(b.siteCode));
    setModalTitle(title);
    setModalSites(result);
    setModalOpened(true);
  };

  const stats = useMemo(() => {
    // Apply filters
    const filteredSites = [];
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (filterDistrito && site.distrito !== filterDistrito) continue;
      if (filterMunicipio && site.municipio !== filterMunicipio) continue;
      if (filterSiteType && site.site_type !== filterSiteType) continue;
      filteredSites.push(site);
    }

    // Initialize counts
    const createCounts = (): SummaryCounts => ({
      total: 0,
      sin_iniciar: 0,
      en_campo: 0,
      en_revision: 0,
      listo_para_generar: 0,
      generado: 0,
    });

    const globalStats = createCounts();
    const districtStats = new Map<string, SummaryCounts>();
    const municipalityStats = new Map<string, Map<string, SummaryCounts>>();
    const siteTypeStats = new Map<string, Map<string, Map<string, SummaryCounts>>>();

    type CameraInventoryRow = {
      siteCode: string;
      siteName: string;
      distrito: string;
      municipio: string;
      siteType: string;
      cameras: { label: string; count: number }[];
    };
    const cameraInventory: CameraInventoryRow[] = [];
    const cameraTypesByComponent: Record<ComponentKey, {
      title: string;
      siteCount: number;
      siteLimit: number;
      cameras: { label: string; count: number; limit: number }[];
    }> = {
      componente_1: {
        title: COMPONENT_CAMERA_LIMITS.componente_1.title,
        siteCount: 0,
        siteLimit: COMPONENT_CAMERA_LIMITS.componente_1.siteLimit,
        cameras: COMPONENT_CAMERA_LIMITS.componente_1.cameras.map((cam) => ({ label: cam.label, count: 0, limit: cam.limit })),
      },
      componente_2: {
        title: COMPONENT_CAMERA_LIMITS.componente_2.title,
        siteCount: 0,
        siteLimit: COMPONENT_CAMERA_LIMITS.componente_2.siteLimit,
        cameras: COMPONENT_CAMERA_LIMITS.componente_2.cameras.map((cam) => ({ label: cam.label, count: 0, limit: cam.limit })),
      },
      componente_3: {
        title: COMPONENT_CAMERA_LIMITS.componente_3.title,
        siteCount: 0,
        siteLimit: COMPONENT_CAMERA_LIMITS.componente_3.siteLimit,
        cameras: COMPONENT_CAMERA_LIMITS.componente_3.cameras.map((cam) => ({ label: cam.label, count: 0, limit: cam.limit })),
      },
    };

    const getOrCreate = <V,>(map: Map<string, V>, key: string, factory: () => V): V => {
      let v = map.get(key);
      if (!v) { v = factory(); map.set(key, v); }
      return v;
    };

    const getOrCreateNested = <V,>(
      outer: Map<string, Map<string, V>>, k1: string, k2: string, factory: () => V
    ): V => {
      const inner = getOrCreate(outer, k1, () => new Map<string, V>());
      return getOrCreate(inner, k2, factory);
    };

    // Process each site
    for (let i = 0; i < filteredSites.length; i++) {
      const site = filteredSites[i];
      const district = site.distrito || 'Sin Distrito';
      const municipality = site.municipio || 'Sin Municipio';
      const siteType = site.site_type || 'lpr';

      const dStats = getOrCreate(districtStats, district, createCounts);
      const mStats = getOrCreateNested(municipalityStats, district, municipality, createCounts);

      const stDistMap = getOrCreate(siteTypeStats, district, () => new Map<string, Map<string, SummaryCounts>>());
      const stStats = getOrCreateNested(stDistMap, municipality, siteType, createCounts);

      const report = latestReportBySite.get(site.id);
      const status: ExtendedStatus = report ? report.status : 'sin_iniciar';

      globalStats.total++;
      globalStats[status]++;

      dStats.total++;
      dStats[status]++;

      mStats.total++;
      mStats[status]++;

      stStats.total++;
      stStats[status]++;

      if (report) {
        if (siteType === 'ptz') {
          cameraTypesByComponent.componente_1.siteCount++;
        } else if (siteType === 'lpr') {
          cameraTypesByComponent.componente_2.siteCount++;
        } else if (siteType === 'cotejo_facial') {
          cameraTypesByComponent.componente_3.siteCount++;
        }
      }

      if (report?.hardware) {
        if (siteType === 'ptz') {
          cameraTypesByComponent.componente_1.cameras[0].count += report.hardware.cameras_ptz || 0;
          cameraTypesByComponent.componente_1.cameras[1].count += report.hardware.cameras_fixed || 0;
        } else if (siteType === 'lpr') {
          cameraTypesByComponent.componente_2.cameras[0].count += report.hardware.cameras_lpr || 0;
        } else if (siteType === 'cotejo_facial') {
          cameraTypesByComponent.componente_3.cameras[0].count += report.hardware.cameras_facial || 0;
        }

        const fields = CAMERA_FIELDS_BY_SITE_TYPE[siteType];
        if (fields) {
          const cameras: { label: string; count: number }[] = [];
          for (let f = 0; f < fields.length; f++) {
            const val = report.hardware[fields[f].key] || 0;
            if (val > 0) {
              cameras.push({ label: fields[f].label, count: val });
            }
          }
          if (cameras.length > 0) {
            cameraInventory.push({
              siteCode: site.site_code,
              siteName: site.name,
              distrito: district,
              municipio: municipality,
              siteType,
              cameras,
            });
          }
        }
      }
    }

    const sortedDistricts = Array.from(districtStats.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([district, dStats]) => {
        const munsMap = municipalityStats.get(district);
        const sortedMuns = munsMap 
          ? Array.from(munsMap.entries())
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([municipality, mStats]) => {
                const sTypesMap = siteTypeStats.get(district)?.get(municipality);
                const sortedSTypes = sTypesMap
                  ? Array.from(sTypesMap.entries())
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([siteType, stStats]) => ({ siteType, stStats }))
                  : [];
                return { municipality, mStats, sortedSTypes };
              })
          : [];
        return { district, dStats, sortedMuns };
      });

    cameraInventory.sort((a, b) =>
      a.distrito.localeCompare(b.distrito)
      || a.municipio.localeCompare(b.municipio)
      || a.siteType.localeCompare(b.siteType)
      || a.siteCode.localeCompare(b.siteCode),
    );

    return { globalStats, sortedDistricts, cameraInventory, cameraTypesByComponent };
  }, [sites, latestReportBySite, filterDistrito, filterMunicipio, filterSiteType]);

  if (loading) {
    return (
      <Stack align="center" mt="xl" gap="sm">
        <Loader size="md" />
        <Text size="sm" c="dimmed">Cargando sitios y reportes…</Text>
      </Stack>
    );
  }

  const { globalStats, sortedDistricts, cameraInventory, cameraTypesByComponent } = stats;

  const renderStatusCount = (count: number, total: number) => {
    if (total === 0) return '-';
    const percent = Math.round((count / total) * 100);
    return (
      <Group gap={4} wrap="nowrap">
        <Text fw={500}>{count}</Text>
        <Text size="xs" c="dimmed">({percent}%)</Text>
      </Group>
    );
  };

  const statusColors: Record<ExtendedStatus, string> = {
    sin_iniciar: 'gray',
    en_campo: 'blue',
    en_revision: 'orange',
    listo_para_generar: 'teal',
    generado: 'green',
  };

  const statusLabels: Record<ExtendedStatus, string> = {
    sin_iniciar: 'Sin Iniciar',
    en_campo: 'En Campo',
    en_revision: 'En Revisión',
    listo_para_generar: 'Listos',
    generado: 'Generados',
  };

  const statusList: ExtendedStatus[] = ['sin_iniciar', 'en_campo', 'en_revision', 'listo_para_generar', 'generado'];
  const noTruncateBadgeStyles = {
    root: {
      maxWidth: 'none',
      width: 'fit-content',
      flex: '0 0 auto',
    },
    label: {
      overflow: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'nowrap',
      maxWidth: 'none',
    },
  };
  const wrapBadgeStyles = {
    root: {
      maxWidth: 'none',
      width: 'fit-content',
      flex: '0 0 auto',
      height: 'auto',
      minHeight: 'var(--badge-height)',
    },
    label: {
      overflow: 'visible',
      textOverflow: 'clip',
      whiteSpace: 'nowrap',
      maxWidth: 'none',
      lineHeight: 1.2,
    },
  };
  const metricColumns: Array<{ key: 'total' | ExtendedStatus; label: string }> = [
    { key: 'total', label: 'Total' },
    { key: 'sin_iniciar', label: 'Sin Iniciar' },
    { key: 'en_campo', label: 'En Campo' },
    { key: 'en_revision', label: 'En Revisión' },
    { key: 'listo_para_generar', label: 'Listos' },
    { key: 'generado', label: 'Generados' },
  ];
  const visibleMetricColumns = metricColumns.filter((col) => !hiddenColumns.includes(col.key));

  const renderMetricCell = (counts: SummaryCounts, metricKey: 'total' | ExtendedStatus, emphasized = false) => {
    if (metricKey === 'total') {
      return <Text fw={emphasized ? 700 : 500} size={emphasized ? undefined : 'sm'}>{counts.total}</Text>;
    }
    return renderStatusCount(counts[metricKey], counts.total);
  };

  const handleExportExcel = () => {
    const filtersText = [
      `Distrito: ${filterDistrito || 'Todos'}`,
      `Municipio: ${filterMunicipio || 'Todos'}`,
      `Tipo de sitio: ${filterSiteType ? (SITE_TYPE_LABELS[filterSiteType] || filterSiteType) : 'Todos'}`,
    ].join(' | ');

    const overviewRows: (string | number)[][] = [
      ['Resumen de Sitios'],
      ['Generado', new Date().toLocaleString('es-CO')],
      ['Filtros aplicados', filtersText],
      [],
      ['Métrica', 'Cantidad', 'Porcentaje'],
      ...(visibleMetricColumns.length > 0
        ? visibleMetricColumns.map((metric) => {
            if (metric.key === 'total') {
              return [metric.label, globalStats.total, '100%'];
            }
            const percent = globalStats.total ? Math.round((globalStats[metric.key] / globalStats.total) * 100) : 0;
            return [metric.label, globalStats[metric.key], `${percent}%`];
          })
        : [['Sin métricas visibles', '', '']]),
    ];

    const detailHeader = [
      'Nivel',
      'Distrito',
      'Municipio',
      'Tipo de Sitio',
      ...visibleMetricColumns.map((metric) => metric.label),
    ];
    const detailRows: (string | number)[][] = [detailHeader];
    const getMetricValues = (counts: SummaryCounts): (string | number)[] =>
      visibleMetricColumns.map((metric) => (metric.key === 'total' ? counts.total : counts[metric.key]));

    for (let d = 0; d < sortedDistricts.length; d++) {
      const { district, dStats, sortedMuns } = sortedDistricts[d];
      detailRows.push([
        'Distrito',
        district,
        '',
        '',
        ...getMetricValues(dStats),
      ]);

      for (let m = 0; m < sortedMuns.length; m++) {
        const { municipality, mStats, sortedSTypes } = sortedMuns[m];
        detailRows.push([
          'Municipio',
          district,
          municipality,
          '',
          ...getMetricValues(mStats),
        ]);

        for (let s = 0; s < sortedSTypes.length; s++) {
          const { siteType, stStats } = sortedSTypes[s];
          detailRows.push([
            'Tipo de Sitio',
            district,
            municipality,
            DISTRICT_BREAKDOWN_LABELS[siteType] || siteType,
            ...getMetricValues(stStats),
          ]);
        }
      }
    }

    const wb = XLSX.utils.book_new();
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
    wsOverview['!cols'] = [{ wch: 26 }, { wch: 22 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Resumen');

    const wsDetail = XLSX.utils.aoa_to_sheet(detailRows);
    const baseCols = [
      { wch: 15 },
      { wch: 24 },
      { wch: 24 },
      { wch: 16 },
    ];
    const metricCols = visibleMetricColumns.map((metric) => ({ wch: metric.key === 'en_revision' ? 12 : 11 }));
    wsDetail['!cols'] = [...baseCols, ...metricCols];
    const colToLetter = (index: number) => {
      let value = '';
      let n = index + 1;
      while (n > 0) {
        const rem = (n - 1) % 26;
        value = String.fromCharCode(65 + rem) + value;
        n = Math.floor((n - 1) / 26);
      }
      return value;
    };
    wsDetail['!autofilter'] = { ref: `A1:${colToLetter(detailHeader.length - 1)}1` };
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Desglose');

    if (cameraInventory.length > 0) {
      const camHeader = ['Código', 'Nombre del Sitio', 'Distrito', 'Municipio', 'Tipo de Sitio', 'Cámaras (tipo: cantidad)'];
      const camRows: (string | number)[][] = [camHeader];
      for (let i = 0; i < cameraInventory.length; i++) {
        const row = cameraInventory[i];
        const camSummary = row.cameras.map((c) => `${c.label}: ${c.count}`).join(', ');
        camRows.push([
          row.siteCode,
          row.siteName,
          row.distrito,
          row.municipio,
          SITE_TYPE_LABELS[row.siteType] || row.siteType,
          camSummary,
        ]);
      }
      const wsCam = XLSX.utils.aoa_to_sheet(camRows);
      wsCam['!cols'] = [
        { wch: 14 },
        { wch: 30 },
        { wch: 22 },
        { wch: 22 },
        { wch: 16 },
        { wch: 40 },
      ];
      wsCam['!autofilter'] = { ref: 'A1:F1' };
      XLSX.utils.book_append_sheet(wb, wsCam, 'Cámaras por Sitio');
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `resumen_sitios_${today}.xlsx`);
  };

  return (
    <div style={{ paddingTop: '1rem' }}>
      <Group justify="space-between" mb="md">
        <Title order={4}>Resumen de Sitios</Title>
        <Group gap="sm">
          <Button
            variant="light"
            color="green"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={handleExportExcel}
          >
            Exportar Excel
          </Button>
          <Button 
            variant={hasActiveFilters ? "light" : "subtle"} 
            leftSection={<IconFilter size={16} />} 
            onClick={toggleFilters}
          >
            {hasActiveFilters ? 'Filtros Activos' : 'Filtros'}
          </Button>
        </Group>
      </Group>

      <Collapse in={filtersOpened} mb="xl">
        <Card shadow="xs" padding="md" radius="md" withBorder>
          <Grid>
            <Grid.Col span={{ base: 12, md: 4, lg: 4 }}>
              <Select
                label="Distrito"
                placeholder="Todos"
                data={uniqueDistritos.map(d => ({ value: d, label: d }))}
                value={filterDistrito}
                onChange={(val) => {
                  setFilterDistrito(val);
                  setFilterMunicipio(null); // reset dependent filter
                }}
                clearable
                searchable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4, lg: 4 }}>
              <Select
                label="Municipio"
                placeholder="Todos"
                data={uniqueMunicipios.map(m => ({ value: m, label: m }))}
                value={filterMunicipio}
                onChange={setFilterMunicipio}
                clearable
                searchable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4, lg: 4 }}>
              <Select
                label="Tipo de Sitio"
                placeholder="Todos"
                data={[
                  { value: 'lpr', label: 'LPR' },
                  { value: 'cotejo_facial', label: 'Cotejo Facial' },
                  { value: 'ptz', label: 'PTZ' },
                ]}
                value={filterSiteType}
                onChange={setFilterSiteType}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 12, lg: 12 }}>
              <MultiSelect
                label="Columnas a ocultar (tabla y Excel)"
                placeholder="Selecciona columnas"
                data={metricColumns.map((metric) => ({ value: metric.key, label: metric.label }))}
                value={hiddenColumns}
                onChange={(values) => setHiddenColumns(values as Array<'total' | ExtendedStatus>)}
                clearable
              />
            </Grid.Col>
          </Grid>
          {hasActiveFilters && (
            <Group justify="flex-end" mt="md">
              <Button variant="subtle" color="red" leftSection={<IconX size={16} />} onClick={clearFilters} size="sm">
                Limpiar Filtros
              </Button>
            </Group>
          )}
        </Card>
      </Collapse>

      <Grid mb="xl">
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: '100%' }}>
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="lg">Total Sitios Mostrados</Text>
              <Badge size="xl" variant="filled" color="indigo">{globalStats.total}</Badge>
            </Group>
            <Text size="sm" c="dimmed">
              El total de sitios disponibles según los filtros aplicados.
            </Text>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg" radius="md" withBorder style={{ height: '100%' }}>
            <Group justify="space-between" mb="xs">
              <Text fw={500} size="lg">Cámaras por componente</Text>
            </Group>
            <Stack gap="sm" mt="xs">
              {(Object.keys(cameraTypesByComponent) as ComponentKey[]).map((componentKey) => {
                const component = cameraTypesByComponent[componentKey];
                return (
                  <div key={componentKey}>
                    <Text size="sm" fw={600} c="dimmed" mb={2}>{component.title}</Text>
                    <Text size="xs" c="dimmed" mb={4}>
                      Sitios: {component.siteCount} / {component.siteLimit}
                    </Text>
                    <Group gap={6}>
                      {component.cameras.map((cam) => (
                        <Badge key={`${componentKey}-${cam.label}`} size="sm" variant="light" color="violet" styles={wrapBadgeStyles}>
                          {cam.label}: {cam.count} / {cam.limit}
                        </Badge>
                      ))}
                    </Group>
                  </div>
                );
              })}
            </Stack>
          </Card>
        </Grid.Col>

        {statusList.map(status => (
          <Grid.Col span={{ base: 6, md: 4, lg: 1.6 }} key={status}>
            <Card shadow="sm" padding="sm" radius="md" withBorder style={{ height: '100%' }}>
              <Text fw={500} size="sm" mb="xs" ta="center">{statusLabels[status]}</Text>
              <Group justify="center" gap="sm">
                <RingProgress
                  size={60}
                  thickness={6}
                  roundCaps
                  sections={[{ value: globalStats.total ? (globalStats[status] / globalStats.total) * 100 : 0, color: statusColors[status] }]}
                  label={<Text c={statusColors[status]} fw={700} ta="center" size="sm">{globalStats.total ? Math.round((globalStats[status] / globalStats.total) * 100) : 0}%</Text>}
                />
                <div style={{ textAlign: 'center' }}>
                  <Text fw={700} size="xl">{globalStats[status]}</Text>
                  <Text size="xs" c="dimmed" style={{ marginTop: '-4px' }}>sitios</Text>
                </div>
              </Group>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      <Tabs defaultValue="desglose" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="desglose" leftSection={<IconTable size={16} />}>
            Desglose por Distrito
          </Tabs.Tab>
          <Tabs.Tab
            value="camaras"
            leftSection={<IconCamera size={16} />}
            rightSection={
              cameraInventory.length > 0
                ? <Badge size="sm" variant="filled" color="violet" circle>{cameraInventory.length}</Badge>
                : undefined
            }
          >
            Cámaras por Sitio
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="desglose">
          <ScrollArea>
            <Table highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nivel</Table.Th>
                  {visibleMetricColumns.map((metric) => (
                    <Table.Th key={`header-${metric.key}`}>{metric.label}</Table.Th>
                  ))}
                  <Table.Th w={50} />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {sortedDistricts.map(({ district, dStats, sortedMuns }) => {
                  const rows = [];
                  rows.push(
                    <Table.Tr key={`d-${district}`} bg="var(--mantine-color-gray-2)">
                      <Table.Td>
                        <Text fw={700}>{district}</Text>
                      </Table.Td>
                      {visibleMetricColumns.map((metric) => (
                        <Table.Td key={`d-${district}-${metric.key}`}>{renderMetricCell(dStats, metric.key, true)}</Table.Td>
                      ))}
                      <Table.Td>
                        <Tooltip label="Ver sitios" withArrow>
                          <ActionIcon variant="subtle" size="sm" onClick={() => openSitesModal(district, district)}>
                            <IconEye size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  );

                  sortedMuns.forEach(({ municipality, mStats, sortedSTypes }) => {
                    rows.push(
                      <Table.Tr key={`m-${district}-${municipality}`} bg="var(--mantine-color-gray-0)">
                        <Table.Td style={{ paddingLeft: '2rem' }}>
                          <Text fw={600} size="sm">{municipality}</Text>
                        </Table.Td>
                        {visibleMetricColumns.map((metric) => (
                          <Table.Td key={`m-${district}-${municipality}-${metric.key}`}>{renderMetricCell(mStats, metric.key)}</Table.Td>
                        ))}
                        <Table.Td>
                          <Tooltip label="Ver sitios" withArrow>
                            <ActionIcon variant="subtle" size="sm" onClick={() => openSitesModal(`${district} › ${municipality}`, district, municipality)}>
                              <IconEye size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Table.Td>
                      </Table.Tr>
                    );

                    sortedSTypes.forEach(({ siteType, stStats }) => {
                      rows.push(
                        <Table.Tr key={`st-${district}-${municipality}-${siteType}`}>
                          <Table.Td style={{ paddingLeft: '4rem' }}>
                            <Text size="sm" c="dimmed">{DISTRICT_BREAKDOWN_LABELS[siteType] || siteType}</Text>
                          </Table.Td>
                          {visibleMetricColumns.map((metric) => (
                            <Table.Td key={`st-${district}-${municipality}-${siteType}-${metric.key}`}>
                              {renderMetricCell(stStats, metric.key)}
                            </Table.Td>
                          ))}
                          <Table.Td>
                            <Tooltip label="Ver sitios" withArrow>
                              <ActionIcon variant="subtle" size="sm" onClick={() => openSitesModal(
                                `${district} › ${municipality} › ${DISTRICT_BREAKDOWN_LABELS[siteType] || siteType}`,
                                district, municipality, siteType,
                              )}>
                                <IconEye size={16} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      );
                    });
                  });
                  return rows;
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Tabs.Panel>

        <Tabs.Panel value="camaras">
          {cameraInventory.length === 0 ? (
            <Text c="dimmed" ta="center" py="xl">No hay datos de cámaras para los filtros seleccionados.</Text>
          ) : (
            <>
              <Text size="sm" c="dimmed" mb="sm">
                Cámaras reportadas en cada sitio (según su último reporte). Solo se muestran sitios con datos de hardware.
              </Text>
              <ScrollArea>
                <Table highlightOnHover withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Código</Table.Th>
                      <Table.Th>Nombre del Sitio</Table.Th>
                      <Table.Th>Distrito</Table.Th>
                      <Table.Th>Municipio</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Cámaras</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {cameraInventory.map((row) => (
                      <Table.Tr key={row.siteCode}>
                        <Table.Td>
                          <Text size="sm" fw={600}>{row.siteCode}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.siteName}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.distrito}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm">{row.municipio}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge size="sm" variant="light" styles={noTruncateBadgeStyles}>{SITE_TYPE_LABELS[row.siteType] || row.siteType}</Badge>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6} wrap="wrap">
                            {row.cameras.map((cam) => (
                              <Badge key={cam.label} size="sm" variant="light" color="violet" styles={wrapBadgeStyles}>
                                {cam.label}: {cam.count}
                              </Badge>
                            ))}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            </>
          )}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        title={<Group gap={8}><IconMapPin size={18} /><Text fw={600}>{modalTitle}</Text><Badge size="sm" variant="light">{modalSites.length} sitios</Badge></Group>}
        size="xl"
        centered
      >
        <ScrollArea.Autosize mah="70vh">
          <Table highlightOnHover withTableBorder striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nombre</Table.Th>
                <Table.Th>Dirección</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Estado</Table.Th>
                <Table.Th>Últ. Actualización</Table.Th>
                <Table.Th>Cámaras</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {modalSites.map((s) => (
                <Table.Tr key={s.siteCode}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{s.siteCode}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Tooltip label={s.description || s.name} multiline w={260} withArrow disabled={!s.description}>
                      <Text size="sm" lineClamp={1}>{s.name}</Text>
                    </Tooltip>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" lineClamp={1}>{s.address}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" variant="light" styles={noTruncateBadgeStyles}>{DISTRICT_BREAKDOWN_LABELS[s.siteType] || s.siteType}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge size="sm" color={statusColors[s.status]} variant="filled" styles={noTruncateBadgeStyles}>{statusLabels[s.status]}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed">
                      {s.updatedAt ? new Date(s.updatedAt).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {s.cameras.length > 0 ? (
                      <Group gap={6} wrap="wrap">
                        {s.cameras.map((cam) => (
                          <Badge key={`${s.siteCode}-${cam.label}`} size="sm" variant="light" color="violet" styles={wrapBadgeStyles}>
                            {cam.label}: {cam.count}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <Text size="xs" c="dimmed">—</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>
      </Modal>
    </div>
  );
}
