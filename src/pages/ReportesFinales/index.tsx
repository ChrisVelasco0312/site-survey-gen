import { useEffect, useState } from 'preact/hooks';
import {
  Title,
  Tabs,
  Table,
  Badge,
  Button,
  Group,
  Text,
  Loader,
  Container,
  ActionIcon,
  Tooltip,
  Center,
  Card,
  Stack,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEye, IconCopy, IconRefresh } from '@tabler/icons-react';
import { useLocation } from 'preact-iso';
import { useAuth } from '../../features/auth/AuthContext';
import type { Report, ReportStatus } from '../../types/Report';
import { getUserReports, getAllReports, saveReport } from '../../services/reportsService';

export function ReportesFinales() {
  const { user, userData, loading: authLoading } = useAuth();
  const location = useLocation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('listo_para_generar');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const isAdmin = userData?.role === 'admin';
  const effectiveUid = userData?.uid ?? user?.uid ?? null;

  const fetchReports = async () => {
    setLoading(true);
    try {
      let data: Report[];
      if (isAdmin) {
        data = await getAllReports();
      } else {
        if (!effectiveUid) { setLoading(false); return; }
        data = await getUserReports(effectiveUid);
      }
      // Only keep reports in the two relevant states
      setReports(data.filter(r => r.status === 'listo_para_generar' || r.status === 'generado'));
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      fetchReports();
    } else {
      setLoading(false);
    }
  }, [user, userData, authLoading]);

  const handleDuplicate = async (report: Report) => {
    if (!effectiveUid) return;
    if (!confirm('¿Desea duplicar este reporte como base para uno nuevo?')) return;

    try {
      setLoading(true);
      const { map_image_url, edited_map_image_url, camera_view_photo_url, service_entrance_photo_url, ...rest } = report;
      const newReport: Report = {
        ...rest,
        id: crypto.randomUUID(),
        user_id: effectiveUid,
        status: 'en_campo',
        created_at: Date.now(),
        updated_at: Date.now(),
        date: new Date().toLocaleDateString('es-CO'),
      };

      await saveReport(newReport);
      location.route(`/reporte/${newReport.id}`);
    } catch (error) {
      console.error('Error duplicating report:', error);
      setLoading(false);
    }
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'en_campo': return 'blue';
      case 'en_revision': return 'orange';
      case 'listo_para_generar': return 'cyan';
      case 'generado': return 'green';
      default: return 'gray';
    }
  };

  const renderActions = (report: Report) => {
    const isGenerado = report.status === 'generado';

    // Generados: view only for everyone
    if (isGenerado) {
      return (
        <Tooltip label="Ver detalles">
          <ActionIcon variant="subtle" color="gray" onClick={() => location.route(`/reporte/${report.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
      );
    }

    // Listo para generar: view always, duplicate only for workers
    return (
      <Group gap="xs">
        <Tooltip label="Ver detalles">
          <ActionIcon variant="subtle" color="gray" onClick={() => location.route(`/reporte/${report.id}`)}>
            <IconEye size={16} />
          </ActionIcon>
        </Tooltip>
        {!isAdmin && (
          <Tooltip label="Duplicar">
            <ActionIcon variant="subtle" color="grape" onClick={() => handleDuplicate(report)}>
              <IconCopy size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </Group>
    );
  };

  const renderMobileActions = (report: Report) => {
    const isGenerado = report.status === 'generado';

    if (isGenerado) {
      return (
        <Button
          variant="light"
          color="gray"
          fullWidth
          onClick={() => location.route(`/reporte/${report.id}`)}
          leftSection={<IconEye size={16} />}
        >
          Ver
        </Button>
      );
    }

    return (
      <Group grow>
        <Button
          variant="light"
          color="gray"
          onClick={() => location.route(`/reporte/${report.id}`)}
          leftSection={<IconEye size={16} />}
        >
          Ver
        </Button>
        {!isAdmin && (
          <Button
            variant="subtle"
            color="grape"
            onClick={() => handleDuplicate(report)}
            leftSection={<IconCopy size={16} />}
          >
            Duplicar
          </Button>
        )}
      </Group>
    );
  };

  const renderMobileList = (filteredReports: Report[]) => (
    <Stack>
      {filteredReports.map((report) => (
        <Card key={report.id} shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={500}>{report.address?.site_name || 'Sin punto'}</Text>
            <Badge color={getStatusColor(report.status)}>
              {report.status.replace(/_/g, ' ')}
            </Badge>
          </Group>

          <Text size="sm" c="dimmed" mb="xs">
            {[report.date, report.address?.municipio, report.address?.distrito].filter(Boolean).join(' · ')}
          </Text>
          {report.address?.full_address && (
            <Text size="xs" c="dimmed" mb="xs">{report.address.full_address}</Text>
          )}

          <Group mt="md">
            {renderMobileActions(report)}
          </Group>
        </Card>
      ))}
    </Stack>
  );

  const renderContent = (filterStatus: string[]) => {
    const filtered = reports.filter(r => filterStatus.includes(r.status));

    if (filtered.length === 0) {
      return <Text c="dimmed" ta="center" py="xl">No hay reportes en este estado.</Text>;
    }

    if (isMobile) {
      return renderMobileList(filtered);
    }

    return (
      <Table striped highlightOnHover verticalSpacing="md" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Sitio / Dirección</Table.Th>
            {isAdmin && <Table.Th>Grupo</Table.Th>}
            <Table.Th>Estado</Table.Th>
            <Table.Th>Acciones</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map((report) => (
            <Table.Tr key={report.id}>
              <Table.Td>{report.date}</Table.Td>
              <Table.Td>
                <Text size="sm" fw={500}>{report.address?.site_name || 'Sin punto'}</Text>
                {(report.address?.municipio || report.address?.distrito) && (
                  <Text size="xs" c="dimmed">
                    {[report.address?.municipio, report.address?.distrito].filter(Boolean).join(' · ')}
                  </Text>
                )}
                {report.address?.full_address && (
                  <Text size="xs" c="dimmed">{report.address.full_address}</Text>
                )}
              </Table.Td>
              {isAdmin && (
                <Table.Td style={{ textTransform: 'capitalize' }}>
                  {report.group?.replace('_', ' ')}
                </Table.Td>
              )}
              <Table.Td>
                <Badge color={getStatusColor(report.status)}>
                  {report.status.replace(/_/g, ' ')}
                </Badge>
              </Table.Td>
              <Table.Td>
                {renderActions(report)}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  if (authLoading || loading) {
    return <Center h="50vh"><Loader /></Center>;
  }

  return (
    <Container size="lg" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Reportes Finales</Title>
        <Button onClick={fetchReports} leftSection={<IconRefresh size={16} />} loading={loading}>
          Actualizar
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="listo_para_generar">Listos para Generar</Tabs.Tab>
          <Tabs.Tab value="generado">Generados</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="listo_para_generar">
          {renderContent(['listo_para_generar'])}
        </Tabs.Panel>

        <Tabs.Panel value="generado">
          {renderContent(['generado'])}
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
