import { useEffect, useState } from 'preact/hooks';
import { Title, Table, Badge, Button, Loader, Text, Group, ActionIcon, Tooltip, Card, Stack, Tabs } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { Report } from '../../types/Report';
import { IconEye, IconRefresh } from '@tabler/icons-react';
import { useLocation } from 'preact-iso';
import { getAllReports } from '../../services/reportsService';

export function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('en_campo');
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const data = await getAllReports();
      setReports(data);
    } catch (error) {
      console.error("Error fetching reports:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const getStatusBadge = (status: string) => (
    <Badge 
        color={
        status === 'generado' ? 'green' : 
        status === 'listo_para_generar' ? 'blue' : 
        status === 'en_revision' ? 'orange' : 'gray'
        }
    >
        {status?.replace(/_/g, ' ')}
    </Badge>
  );

  const renderMobileList = (filtered: Report[]) => (
    <Stack>
        {filtered.map((report) => (
            <Card key={report.id} shadow="sm" padding="lg" radius="md" withBorder>
                <Group justify="space-between" mb="xs">
                    <Text fw={500}>{report.address?.site_name || report.address?.full_address || 'Sin dirección'}</Text>
                    {getStatusBadge(report.status)}
                </Group>
                
                <Text size="sm" c="dimmed" mb="xs">
                    {report.date || new Date(report.created_at).toLocaleDateString()} • {report.group?.replace('_', ' ')}
                </Text>

                <Button 
                    variant="light" 
                    color="blue" 
                    fullWidth 
                    mt="md" 
                    radius="md" 
                    onClick={() => location.route(`/reporte/${report.id}`)}
                    leftSection={<IconEye size={16} />}
                >
                    Ver Detalles
                </Button>
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
      <Table striped highlightOnHover withTableBorder verticalSpacing="md" horizontalSpacing="md">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fecha</Table.Th>
            <Table.Th>Dirección</Table.Th>
            <Table.Th>Grupo</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Acciones</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {filtered.map((report) => (
            <Table.Tr key={report.id}>
              <Table.Td>{report.date || new Date(report.created_at).toLocaleDateString()}</Table.Td>
              <Table.Td>{report.address?.site_name || report.address?.full_address || 'Sin dirección'}</Table.Td>
              <Table.Td style={{ textTransform: 'capitalize' }}>{report.group?.replace('_', ' ')}</Table.Td>
              <Table.Td>
                {getStatusBadge(report.status)}
              </Table.Td>
              <Table.Td>
                <Tooltip label="Ver detalles">
                  <ActionIcon variant="subtle" color="blue" onClick={() => location.route(`/reporte/${report.id}`)}>
                    <IconEye size={16} />
                  </ActionIcon>
                </Tooltip>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    );
  };

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Dashboard General</Title>
        <Button onClick={fetchReports} leftSection={<IconRefresh size={16} />} loading={loading}>
          Actualizar
        </Button>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="en_campo">En Campo</Tabs.Tab>
            <Tabs.Tab value="en_revision">En Revisión</Tabs.Tab>
            <Tabs.Tab value="historial">Historial</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="en_campo">
            {renderContent(['en_campo'])}
          </Tabs.Panel>

          <Tabs.Panel value="en_revision">
            {renderContent(['en_revision', 'listo_para_generar'])}
          </Tabs.Panel>

          <Tabs.Panel value="historial">
            {renderContent(['generado'])}
          </Tabs.Panel>
        </Tabs>
      )}
    </div>
  );
}
