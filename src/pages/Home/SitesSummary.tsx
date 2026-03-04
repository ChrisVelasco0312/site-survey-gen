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
  const [filterSecurityLevel, setFilterSecurityLevel] = useState<string | null>(null);
  const [filterContractComponent, setFilterContractComponent] = useState<string | null>(null);

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
    const set = new Set(sites.map(s => s.distrito).filter(Boolean));
    return Array.from(set).sort();
  }, [sites]);

  const uniqueMunicipios = useMemo(() => {
    let filteredSites = sites;
    if (filterDistrito) {
      filteredSites = filteredSites.filter(s => s.distrito === filterDistrito);
    }
    const set = new Set(filteredSites.map(s => s.municipio).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, filterDistrito]);

  const clearFilters = () => {
    setFilterDistrito(null);
    setFilterMunicipio(null);
    setFilterSiteType(null);
    setFilterSecurityLevel(null);
    setFilterContractComponent(null);
  };

  const hasActiveFilters = !!(filterDistrito || filterMunicipio || filterSiteType || filterSecurityLevel || filterContractComponent);

  const stats = useMemo(() => {
    // 1. Map site to latest report
    const latestReportBySite = new Map<string, Report>();
    for (const r of reports) {
      const siteId = r.address?.site_id;
      if (siteId) {
        const existing = latestReportBySite.get(siteId);
        if (!existing || r.updated_at > existing.updated_at) {
          latestReportBySite.set(siteId, r);
        }
      }
    }

    // Apply filters
    const filteredSites = sites.filter(site => {
      if (filterDistrito && site.distrito !== filterDistrito) return false;
      if (filterMunicipio && site.municipio !== filterMunicipio) return false;
      if (filterSiteType && site.site_type !== filterSiteType) return false;
      
      const report = latestReportBySite.get(site.id);
      if (filterSecurityLevel) {
        if (!report || report.security_level !== filterSecurityLevel) return false;
      }
      if (filterContractComponent) {
        if (!report || report.contract_component !== filterContractComponent) return false;
      }

      return true;
    });

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
    for (const site of filteredSites) {
      const district = site.distrito || 'Sin Distrito';
      const municipality = site.municipio || 'Sin Municipio';
      const siteType = site.site_type || 'lpr';

      if (!districtStats.has(district)) {
        districtStats.set(district, createCounts());
      }
      if (!municipalityStats.has(district)) {
        municipalityStats.set(district, new Map());
      }
      const munMap = municipalityStats.get(district)!;
      if (!munMap.has(municipality)) {
        munMap.set(municipality, createCounts());
      }
      
      if (!siteTypeStats.has(district)) {
        siteTypeStats.set(district, new Map());
      }
      const stDistMap = siteTypeStats.get(district)!;
      if (!stDistMap.has(municipality)) {
        stDistMap.set(municipality, new Map());
      }
      const stMunMap = stDistMap.get(municipality)!;
      if (!stMunMap.has(siteType)) {
        stMunMap.set(siteType, createCounts());
      }

      const report = latestReportBySite.get(site.id);
      const status: ExtendedStatus = report ? report.status : 'sin_iniciar';

      globalStats.total++;
      globalStats[status]++;

      districtStats.get(district)!.total++;
      districtStats.get(district)![status]++;

      munMap.get(municipality)!.total++;
      munMap.get(municipality)![status]++;

      stMunMap.get(siteType)!.total++;
      stMunMap.get(siteType)![status]++;
    }

    return { globalStats, districtStats, municipalityStats, siteTypeStats };
  }, [sites, reports, filterDistrito, filterMunicipio, filterSiteType, filterSecurityLevel, filterContractComponent]);

  if (loading) {
    return <Loader mt="xl" />;
  }

  const { globalStats, districtStats, municipalityStats, siteTypeStats } = stats;

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
            <Grid.Col span={{ base: 12, md: 4, lg: 2.4 }}>
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
            <Grid.Col span={{ base: 12, md: 4, lg: 2.4 }}>
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
            <Grid.Col span={{ base: 12, md: 4, lg: 2.4 }}>
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
            <Grid.Col span={{ base: 12, md: 4, lg: 2.4 }}>
              <Select
                label="Nivel de Seguridad"
                placeholder="Todos"
                data={[
                  { value: 'alto', label: 'Alto' },
                  { value: 'medio', label: 'Medio' },
                  { value: 'bajo', label: 'Bajo' },
                ]}
                value={filterSecurityLevel}
                onChange={setFilterSecurityLevel}
                clearable
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 4, lg: 2.4 }}>
              <Select
                label="Componente Contrato"
                placeholder="Todos"
                data={[
                  { value: 'valle_seguro', label: 'Valle Seguro' },
                  { value: 'lpr', label: 'LPR' },
                  { value: 'cotejo_facial', label: 'Cotejo Facial' },
                ]}
                value={filterContractComponent}
                onChange={setFilterContractComponent}
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

      <Card shadow="sm" padding="md" radius="md" withBorder>
        <Title order={4} mb="md">Desglose por Distrito, Municipio y Tipo</Title>
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
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
              {Array.from(districtStats.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([district, dStats]) => {
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
                const muns = municipalityStats.get(district);
                if (muns) {
                  const sortedMuns = Array.from(muns.entries()).sort((a, b) => a[0].localeCompare(b[0]));
                  sortedMuns.forEach(([municipality, mStats]) => {
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
                    const sTypes = siteTypeStats.get(district)?.get(municipality);
                    if (sTypes) {
                      const sortedSTypes = Array.from(sTypes.entries()).sort((a, b) => a[0].localeCompare(b[0]));
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
                    }
                  });
                }
                return rows;
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
}
