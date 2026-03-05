import { useEffect, useState, useMemo } from 'preact/hooks';
import { Title, Card, Grid, Text, Group, RingProgress, Table, Loader, Badge, ScrollArea, Select, Button, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconFilter, IconX } from '@tabler/icons-react';
import type { SiteRecord, Report, ReportStatus } from '../../types/Report';
import { getAllReports } from '../../services/reportsService';
import { fetchSitesAndPersist } from '../../services/sitesService';

type ExtendedStatus = ReportStatus | 'sin_iniciar';

const SITE_TYPE_LABELS: Record<string, string> = {
  lpr: 'LPR',
  cotejo_facial: 'Cotejo Facial',
  ptz: 'PTZ',
};

export function SitesSummary() {
  const [reports, setReports] = useState<Report[]>([]);
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filtersOpened, { toggle: toggleFilters }] = useDisclosure(false);
  const [filterDistrito, setFilterDistrito] = useState<string | null>(null);
  const [filterMunicipio, setFilterMunicipio] = useState<string | null>(null);
  const [filterSiteType, setFilterSiteType] = useState<string | null>(null);

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
    type Counts = Record<ExtendedStatus, number> & { total: number };
    const createCounts = (): Counts => ({
      total: 0,
      sin_iniciar: 0,
      en_campo: 0,
      en_revision: 0,
      listo_para_generar: 0,
      generado: 0,
    });

    const globalStats = createCounts();
    const districtStats = new Map<string, Counts>();
    const municipalityStats = new Map<string, Map<string, Counts>>();
    const siteTypeStats = new Map<string, Map<string, Map<string, Counts>>>();

    // Process each site
    for (let i = 0; i < filteredSites.length; i++) {
      const site = filteredSites[i];
      const district = site.distrito || 'Sin Distrito';
      const municipality = site.municipio || 'Sin Municipio';
      const siteType = site.site_type || 'lpr';

      let dStats = districtStats.get(district);
      if (!dStats) {
        dStats = createCounts();
        districtStats.set(district, dStats);
      }

      let munMap = municipalityStats.get(district);
      if (!munMap) {
        munMap = new Map();
        municipalityStats.set(district, munMap);
      }
      
      let mStats = munMap.get(municipality);
      if (!mStats) {
        mStats = createCounts();
        munMap.set(municipality, mStats);
      }
      
      let stDistMap = siteTypeStats.get(district);
      if (!stDistMap) {
        stDistMap = new Map();
        siteTypeStats.set(district, stDistMap);
      }

      let stMunMap = stDistMap.get(municipality);
      if (!stMunMap) {
        stMunMap = new Map();
        stDistMap.set(municipality, stMunMap);
      }

      let stStats = stMunMap.get(siteType);
      if (!stStats) {
        stStats = createCounts();
        stMunMap.set(siteType, stStats);
      }

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
                  : [];
                return { municipality, mStats, sortedSTypes };
              })
          : [];
        return { district, dStats, sortedMuns };
      });

    return { globalStats, sortedDistricts };
  }, [sites, latestReportBySite, filterDistrito, filterMunicipio, filterSiteType]);

  if (loading) {
    return <Loader mt="xl" />;
  }

  const { globalStats, sortedDistricts } = stats;

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

  return (
    <div style={{ paddingTop: '1rem' }}>
      <Group justify="space-between" mb="md">
        <Title order={4}>Resumen de Sitios</Title>
        <Button 
          variant={hasActiveFilters ? "light" : "subtle"} 
          leftSection={<IconFilter size={16} />} 
          onClick={toggleFilters}
        >
          {hasActiveFilters ? 'Filtros Activos' : 'Filtros'}
        </Button>
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

      <div>
        <Title order={4} mb="md">Desglose por Distrito, Municipio y Tipo</Title>
        <ScrollArea>
          <Table highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nivel</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Sin Iniciar</Table.Th>
                <Table.Th>En Campo</Table.Th>
                <Table.Th>En Revisión</Table.Th>
                <Table.Th>Listos</Table.Th>
                <Table.Th>Generados</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedDistricts.map(({ district, dStats, sortedMuns }) => {
                const rows = [];
                // District row
                rows.push(
                  <Table.Tr key={`d-${district}`} bg="var(--mantine-color-gray-2)">
                    <Table.Td>
                      <Text fw={700}>{district}</Text>
                    </Table.Td>
                    <Table.Td><Text fw={700}>{dStats.total}</Text></Table.Td>
                    <Table.Td>{renderStatusCount(dStats.sin_iniciar, dStats.total)}</Table.Td>
                    <Table.Td>{renderStatusCount(dStats.en_campo, dStats.total)}</Table.Td>
                    <Table.Td>{renderStatusCount(dStats.en_revision, dStats.total)}</Table.Td>
                    <Table.Td>{renderStatusCount(dStats.listo_para_generar, dStats.total)}</Table.Td>
                    <Table.Td>{renderStatusCount(dStats.generado, dStats.total)}</Table.Td>
                  </Table.Tr>
                );

                // Municipality rows
                sortedMuns.forEach(({ municipality, mStats, sortedSTypes }) => {
                  rows.push(
                    <Table.Tr key={`m-${district}-${municipality}`} bg="var(--mantine-color-gray-0)">
                      <Table.Td style={{ paddingLeft: '2rem' }}>
                        <Text fw={600} size="sm">{municipality}</Text>
                      </Table.Td>
                      <Table.Td fw={600}>{mStats.total}</Table.Td>
                      <Table.Td>{renderStatusCount(mStats.sin_iniciar, mStats.total)}</Table.Td>
                      <Table.Td>{renderStatusCount(mStats.en_campo, mStats.total)}</Table.Td>
                      <Table.Td>{renderStatusCount(mStats.en_revision, mStats.total)}</Table.Td>
                      <Table.Td>{renderStatusCount(mStats.listo_para_generar, mStats.total)}</Table.Td>
                      <Table.Td>{renderStatusCount(mStats.generado, mStats.total)}</Table.Td>
                    </Table.Tr>
                  );

                  // Site Type rows
                  sortedSTypes.forEach(([siteType, stStats]) => {
                    rows.push(
                      <Table.Tr key={`st-${district}-${municipality}-${siteType}`}>
                        <Table.Td style={{ paddingLeft: '4rem' }}>
                          <Text size="sm" c="dimmed">{SITE_TYPE_LABELS[siteType] || siteType}</Text>
                        </Table.Td>
                        <Table.Td fw={500}>
                          <Text size="sm" fw={500}>{stStats.total}</Text>
                        </Table.Td>
                        <Table.Td>{renderStatusCount(stStats.sin_iniciar, stStats.total)}</Table.Td>
                        <Table.Td>{renderStatusCount(stStats.en_campo, stStats.total)}</Table.Td>
                        <Table.Td>{renderStatusCount(stStats.en_revision, stStats.total)}</Table.Td>
                        <Table.Td>{renderStatusCount(stStats.listo_para_generar, stStats.total)}</Table.Td>
                        <Table.Td>{renderStatusCount(stStats.generado, stStats.total)}</Table.Td>
                      </Table.Tr>
                    );
                  });
                });
                return rows;
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </div>
    </div>
  );
}
