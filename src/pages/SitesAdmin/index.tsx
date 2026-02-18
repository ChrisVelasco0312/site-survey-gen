import { useEffect, useMemo, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import {
  Title, Table, Button, Loader, Text, Group, ActionIcon, Tooltip,
  Card, Stack, Badge, Modal, TextInput, Select, NumberInput, Textarea,
  Pagination,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery, useDisclosure } from '@mantine/hooks';
import { IconEdit, IconTrash, IconPlus, IconRefresh, IconSearch } from '@tabler/icons-react';
import { useAuth } from '../../features/auth/AuthContext';
import { fetchSitesAndPersist, createSite, updateSite, deleteSite } from '../../services/sitesService';
import type { SiteRecord } from '../../types/Report';

const EMPTY_FORM: Omit<SiteRecord, 'id'> = {
  site_code: '',
  site_type: 'lpr',
  distrito: '',
  municipio: '',
  name: '',
  address: '',
  location: null,
  cameras_count: 0,
  description: '',
};

export function SitesAdmin() {
  const { userData } = useAuth();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 768px)');

  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formOpened, { open: openForm, close: closeForm }] = useDisclosure(false);
  const [deleteOpened, { open: openDelete, close: closeDelete }] = useDisclosure(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SiteRecord, 'id'>>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return sites;
    return sites.filter(
      (s) =>
        s.site_code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.distrito.toLowerCase().includes(q) ||
        s.municipio.toLowerCase().includes(q) ||
        s.site_type.toLowerCase().includes(q)
    );
  }, [sites, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [debouncedSearch]);

  useEffect(() => {
    if (userData && userData.role !== 'admin') {
      location.route('/mis-reportes');
    }
  }, [userData]);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const data = await fetchSitesAndPersist();
      setSites(data);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSites(); }, []);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    openForm();
  };

  const handleOpenEdit = (site: SiteRecord) => {
    setEditingId(site.id);
    const { id, ...rest } = site;
    setForm(rest);
    openForm();
  };

  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    openDelete();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateSite(editingId, form);
      } else {
        await createSite(form);
      }
      closeForm();
      await fetchSites();
    } catch (error) {
      console.error('Error saving site:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    try {
      await deleteSite(deletingId);
      closeDelete();
      setDeletingId(null);
      await fetchSites();
    } catch (error) {
      console.error('Error deleting site:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateField = <K extends keyof Omit<SiteRecord, 'id'>>(key: K, value: Omit<SiteRecord, 'id'>[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const siteTypeBadge = (type: string) => {
    const config = type === 'lpr'
      ? { color: 'blue', label: 'LPR' }
      : type === 'ptz'
        ? { color: 'teal', label: 'PTZ' }
        : { color: 'grape', label: 'Cotejo Facial' };
    return <Badge color={config.color}>{config.label}</Badge>;
  };

  const renderFormModal = () => (
    <Modal
      opened={formOpened}
      onClose={closeForm}
      title={editingId ? 'Editar Sitio' : 'Crear Sitio'}
      size="lg"
    >
      <Stack gap="sm">
        <TextInput
          label="Código del sitio"
          placeholder="LPR 1"
          value={form.site_code}
          onChange={(e) => updateField('site_code', (e.target as HTMLInputElement).value)}
          required
        />
        <Select
          label="Tipo de sitio"
          data={[
            { value: 'lpr', label: 'LPR' },
            { value: 'cotejo_facial', label: 'Cotejo Facial' },
            { value: 'ptz', label: 'PTZ' },
          ]}
          value={form.site_type}
          onChange={(val) => updateField('site_type', (val as 'lpr' | 'cotejo_facial' | 'ptz') ?? 'lpr')}
          required
        />
        <TextInput
          label="Distrito"
          placeholder="DISTRITO PALMIRA"
          value={form.distrito}
          onChange={(e) => updateField('distrito', (e.target as HTMLInputElement).value)}
          required
        />
        <TextInput
          label="Municipio"
          placeholder="PALMIRA"
          value={form.municipio}
          onChange={(e) => updateField('municipio', (e.target as HTMLInputElement).value)}
          required
        />
        <TextInput
          label="Nombre"
          placeholder="Nombre del sitio"
          value={form.name}
          onChange={(e) => updateField('name', (e.target as HTMLInputElement).value)}
          required
        />
        <TextInput
          label="Dirección"
          placeholder="Dirección completa"
          value={form.address}
          onChange={(e) => updateField('address', (e.target as HTMLInputElement).value)}
          required
        />
        <Group grow>
          <NumberInput
            label="Latitud"
            placeholder="3.4516"
            value={form.location?.latitude ?? ''}
            onChange={(val) =>
              updateField('location', {
                latitude: typeof val === 'number' ? val : 0,
                longitude: form.location?.longitude ?? 0,
              })
            }
            decimalScale={6}
          />
          <NumberInput
            label="Longitud"
            placeholder="-76.5319"
            value={form.location?.longitude ?? ''}
            onChange={(val) =>
              updateField('location', {
                latitude: form.location?.latitude ?? 0,
                longitude: typeof val === 'number' ? val : 0,
              })
            }
            decimalScale={6}
          />
        </Group>
        <NumberInput
          label="Cantidad de cámaras"
          placeholder="0"
          value={form.cameras_count}
          onChange={(val) => updateField('cameras_count', typeof val === 'number' ? val : 0)}
          min={0}
        />
        <Textarea
          label="Descripción"
          placeholder="Descripción opcional"
          value={form.description}
          onChange={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
          autosize
          minRows={2}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={closeForm}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving}>
            {editingId ? 'Guardar Cambios' : 'Crear Sitio'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );

  const renderDeleteModal = () => (
    <Modal opened={deleteOpened} onClose={closeDelete} title="Confirmar Eliminación" size="sm">
      <Text mb="lg">¿Está seguro de que desea eliminar este sitio? Esta acción no se puede deshacer.</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={closeDelete}>Cancelar</Button>
        <Button color="red" onClick={handleDelete} loading={saving}>Eliminar</Button>
      </Group>
    </Modal>
  );

  const renderMobileList = () => (
    <Stack>
      {paged.map((site) => (
        <Card key={site.id} shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text fw={500}>{site.name || site.site_code}</Text>
            {siteTypeBadge(site.site_type)}
          </Group>
          <Text size="sm" c="dimmed" mb={4}>{site.address}</Text>
          <Text size="xs" c="dimmed" mb="xs">
            {site.distrito} • {site.municipio} • {site.cameras_count} cámaras
          </Text>
          <Group mt="md">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => handleOpenEdit(site)}
              style={{ flex: 1 }}
            >
              Editar
            </Button>
            <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => handleOpenDelete(site.id)}
              style={{ flex: 1 }}
            >
              Eliminar
            </Button>
          </Group>
        </Card>
      ))}
    </Stack>
  );

  const renderTable = () => (
    <Table striped highlightOnHover withTableBorder verticalSpacing="md" horizontalSpacing="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Código</Table.Th>
          <Table.Th>Tipo</Table.Th>
          <Table.Th>Nombre</Table.Th>
          <Table.Th>Distrito</Table.Th>
          <Table.Th>Municipio</Table.Th>
          <Table.Th>Dirección</Table.Th>
          <Table.Th>Cámaras</Table.Th>
          <Table.Th>Acciones</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {paged.map((site) => (
          <Table.Tr key={site.id}>
            <Table.Td>{site.site_code}</Table.Td>
            <Table.Td>{siteTypeBadge(site.site_type)}</Table.Td>
            <Table.Td>{site.name}</Table.Td>
            <Table.Td>{site.distrito}</Table.Td>
            <Table.Td>{site.municipio}</Table.Td>
            <Table.Td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {site.address}
            </Table.Td>
            <Table.Td>{site.cameras_count}</Table.Td>
            <Table.Td>
              <Group gap="xs">
                <Tooltip label="Editar">
                  <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEdit(site)}>
                    <IconEdit size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Eliminar">
                  <ActionIcon variant="subtle" color="red" onClick={() => handleOpenDelete(site.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );

  if (userData?.role !== 'admin') return null;

  return (
    <div style={{ padding: '20px' }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Administrar Sitios</Title>
        <Group>
          <Button onClick={fetchSites} leftSection={<IconRefresh size={16} />} loading={loading} variant="default">
            Actualizar
          </Button>
          <Button onClick={handleOpenCreate} leftSection={<IconPlus size={16} />}>
            Nuevo Sitio
          </Button>
        </Group>
      </Group>

      {!loading && sites.length > 0 && (
        <TextInput
          placeholder="Buscar por código, nombre, dirección, distrito, municipio..."
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
          mb="md"
        />
      )}

      {loading ? (
        <Loader />
      ) : sites.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No hay sitios registrados.</Text>
      ) : filtered.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">No se encontraron sitios para "{debouncedSearch}".</Text>
      ) : (
        <>
          <Text size="sm" c="dimmed" mb="sm">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} sitios
          </Text>
          {isMobile ? renderMobileList() : renderTable()}
          {totalPages > 1 && (
            <Group justify="center" mt="lg">
              <Pagination value={page} onChange={setPage} total={totalPages} />
            </Group>
          )}
        </>
      )}

      {renderFormModal()}
      {renderDeleteModal()}
    </div>
  );
}
