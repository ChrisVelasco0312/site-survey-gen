import { useEffect, useState } from 'preact/hooks';
import { Title, Tabs, Table, Badge, Button, Group, Text, Loader, Container, ActionIcon, Tooltip, Center, Card, Stack, Modal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEdit, IconEye, IconPlus, IconCopy, IconTrash } from '@tabler/icons-react';
import { useLocation } from 'preact-iso';
import { useAuth } from '../../features/auth/AuthContext';
import { Report, ReportStatus, createInitialReport } from '../../types/Report';
import { getUserReports, saveReport, deleteReport } from '../../services/reportsService';

export function MisReportes() {
  const { user, userData, loading: authLoading } = useAuth();
  const location = useLocation();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>('en_campo');
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<Report | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Usar uid de Auth si el perfil Firestore no cargó (ej. documento no existe)
  const effectiveUid = userData?.uid ?? user?.uid ?? null;
  const effectiveGroup = userData?.group_assignment ?? 'grupo_a';

  const fetchReports = async () => {
    if (!effectiveUid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const myReports = await getUserReports(effectiveUid);
      setReports(myReports);
    } catch (error) {
      console.error("Error fetching reports:", error);
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

  const handleCreateNew = async () => {
    if (!effectiveUid) return;

    try {
      setLoading(true);
      const newReport = createInitialReport(effectiveUid, effectiveGroup);
      await saveReport(newReport);
      location.route(`/reporte/${newReport.id}`);
    } catch (error) {
      console.error("Error creating report:", error);
      setLoading(false);
    }
  };

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
        console.error("Error duplicating report:", error);
        setLoading(false);
    }
  };

  const confirmDelete = (report: Report) => {
    setReportToDelete(report);
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!reportToDelete) return;
    try {
      setIsDeleting(true);
      await deleteReport(reportToDelete.id);
      setReports((prev) => prev.filter((r) => r.id !== reportToDelete.id));
      setDeleteModalOpen(false);
      setReportToDelete(null);
    } catch (error) {
      console.error("Error deleting report:", error);
    } finally {
      setIsDeleting(false);
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

                <Group mt="md" grow>
                  {report.status === 'en_campo' ? (
                    <>
                      <Button 
                        variant="light" 
                        color="blue" 
                        onClick={() => location.route(`/reporte/${report.id}`)}
                        leftSection={<IconEdit size={16} />}
                      >
                          Editar
                      </Button>
                      <Button 
                        variant="light" 
                        color="red" 
                        onClick={() => confirmDelete(report)}
                        leftSection={<IconTrash size={16} />}
                      >
                          Eliminar
                      </Button>
                    </>
                  ) : (
                    <>
                        <Button 
                            variant="light" 
                            color="gray" 
                            onClick={() => location.route(`/reporte/${report.id}`)}
                            leftSection={<IconEye size={16} />}
                        >
                            Ver
                        </Button>
                        <Button 
                            variant="subtle" 
                            color="grape" 
                            onClick={() => handleDuplicate(report)}
                            leftSection={<IconCopy size={16} />}
                        >
                            Duplicar
                        </Button>
                    </>
                  )}
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
              <Table.Td>
                <Badge color={getStatusColor(report.status)}>
                  {report.status.replace(/_/g, ' ')}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {report.status === 'en_campo' ? (
                    <>
                      <Tooltip label="Editar">
                        <ActionIcon variant="light" color="blue" onClick={() => location.route(`/reporte/${report.id}`)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Eliminar">
                        <ActionIcon variant="light" color="red" onClick={() => confirmDelete(report)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                        <Tooltip label="Ver detalles">
                        <ActionIcon variant="subtle" color="gray" onClick={() => location.route(`/reporte/${report.id}`)}>
                            <IconEye size={16} />
                        </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Duplicar">
                            <ActionIcon variant="subtle" color="grape" onClick={() => handleDuplicate(report)}>
                                <IconCopy size={16} />
                            </ActionIcon>
                        </Tooltip>
                    </>
                  )}
                </Group>
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
        <Title order={2}>Mis Reportes</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={handleCreateNew}>
          Nuevo Reporte
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="en_campo">En Campo</Tabs.Tab>
          <Tabs.Tab value="en_revision">En Revisión</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="en_campo">
          {renderContent(['en_campo'])}
        </Tabs.Panel>

        <Tabs.Panel value="en_revision">
          {renderContent(['en_revision'])}
        </Tabs.Panel>
      </Tabs>

      <Modal
        opened={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        title="Confirmar Eliminación"
        centered
      >
        <Text size="sm" mb="lg">
          ¿Está seguro que desea eliminar este reporte? Esta acción no se puede deshacer.
        </Text>
        <Group justify="flex-end">
          <Button variant="light" onClick={() => setDeleteModalOpen(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button color="red" onClick={handleDelete} loading={isDeleting}>
            Eliminar
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
