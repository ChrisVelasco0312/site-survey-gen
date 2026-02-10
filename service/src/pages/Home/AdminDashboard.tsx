import { useEffect, useState } from 'preact/hooks';
import { Title, Table, Badge, Button, Loader, Text, Group, ActionIcon, Tooltip, Card, Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase-config';
import { Report } from '../../types/Report';
import { IconEye, IconRefresh } from '@tabler/icons-react';
import { useLocation } from 'preact-iso';
import { USE_MOCK_DATA, generateMockReports } from '../../utils/mockData';

export function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const fetchReports = async () => {
    setLoading(true);
    try {
      if (USE_MOCK_DATA) {
        console.log("Using Mock Data for AdminDashboard");
        const mocks = generateMockReports(undefined, 15);
        setReports(mocks);
      } else if (navigator.onLine) {
        const q = query(collection(db, 'reports'), orderBy('updated_at', 'desc'));
        const querySnapshot = await getDocs(q);
        const data: Report[] = [];
        querySnapshot.forEach((doc) => {
          data.push(doc.data() as Report);
        });
        setReports(data);
      } else {
        // TODO: Fallback to local DB if offline?
        // For admin dashboard, online is preferred.
        console.warn("Offline: Cannot fetch global reports.");
      }
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

  const renderMobileList = () => (
    <Stack>
        {reports.map((report) => (
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
        <>
            {reports.length === 0 ? (
                <Text ta="center" c="dimmed">No se encontraron reportes.</Text>
            ) : (
                isMobile ? renderMobileList() : (
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
                        {reports.map((report) => (
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
                )
            )}
        </>
      )}
    </div>
  );
}
