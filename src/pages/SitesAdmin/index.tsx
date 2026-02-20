import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import {
  Title, Table, Button, Loader, Text, Group, ActionIcon, Tooltip,
  Card, Stack, Badge, Modal, TextInput, Select, NumberInput, Textarea,
  Pagination, Divider, Grid, Checkbox, Menu, FileButton, Alert, List, ScrollArea,
} from '@mantine/core';
import { useDebouncedValue, useMediaQuery, useDisclosure } from '@mantine/hooks';
import {
  IconEdit, IconTrash, IconPlus, IconRefresh, IconSearch,
  IconLink, IconLinkOff, IconEye, IconMapPin,
  IconFileSpreadsheet, IconDownload, IconUpload, IconTemplate,
} from '@tabler/icons-react';
import { useAuth } from '../../features/auth/AuthContext';
import { fetchSitesAndPersist, createSite, updateSite, deleteSite, fetchDistritoMunicipioAndPersist } from '../../services/sitesService';
import { getDistritoMunicipioFromDB, type DistritoMunicipioEntry } from '../../utils/indexedDB';
import type { SiteRecord } from '../../types/Report';
import {
  downloadTemplate, exportSitesToExcel, parseExcelFile,
  buildUpsertPlan, parsedRowToSitePayload,
  type UpsertPlan, type FailedRow,
} from '../../utils/sitesExcel';

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

const GMS_REGEX = /^(\d+)°(\d+)'(\d+)"([NSns])\s+(\d+)°(\d+)'(\d+)"([EWew])$/;

function parseGMS(gms: string): { latitude: number; longitude: number } | null {
  const match = gms.trim().match(GMS_REGEX);
  if (!match) return null;

  const [, latDeg, latMin, latSec, latDir, lonDeg, lonMin, lonSec, lonDir] = match;

  let latitude = parseInt(latDeg) + parseInt(latMin) / 60 + parseInt(latSec) / 3600;
  let longitude = parseInt(lonDeg) + parseInt(lonMin) / 60 + parseInt(lonSec) / 3600;

  if (latDir.toUpperCase() === 'S') latitude = -latitude;
  if (lonDir.toUpperCase() === 'W') longitude = -longitude;

  return { latitude, longitude };
}

function formatToGMS(latitude: number, longitude: number): string {
  const latDir = latitude >= 0 ? 'N' : 'S';
  const lonDir = longitude >= 0 ? 'E' : 'W';

  const absLat = Math.abs(latitude);
  const absLon = Math.abs(longitude);

  const latDeg = Math.floor(absLat);
  const latMin = Math.floor((absLat - latDeg) * 60);
  const latSec = Math.round((absLat - latDeg - latMin / 60) * 3600);

  const lonDeg = Math.floor(absLon);
  const lonMin = Math.floor((absLon - lonDeg) * 60);
  const lonSec = Math.round((absLon - lonDeg - lonMin / 60) * 3600);

  return `${latDeg}°${latMin}'${latSec}"${latDir} ${lonDeg}°${lonMin}'${lonSec}"${lonDir}`;
}

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
  const [gmsInput, setGmsInput] = useState('');
  const [gmsError, setGmsError] = useState<string | null>(null);
  const [gmsMode, setGmsMode] = useState(false);

  const [viewOpened, { open: openView, close: closeView }] = useDisclosure(false);
  const [viewingSite, setViewingSite] = useState<SiteRecord | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [importOpened, { open: openImport, close: closeImport }] = useDisclosure(false);
  const [importPlan, setImportPlan] = useState<UpsertPlan | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const resetFileRef = useRef<() => void>(null);

  const [distritoMunicipioMap, setDistritoMunicipioMap] = useState<DistritoMunicipioEntry[]>([]);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

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

  useEffect(() => {
    let cancelled = false;
    getDistritoMunicipioFromDB()
      .then((cached) => {
        if (cancelled) return;
        if (cached.length > 0) { setDistritoMunicipioMap(cached); return; }
        if (navigator.onLine) {
          fetchDistritoMunicipioAndPersist()
            .then((fresh) => { if (!cancelled) setDistritoMunicipioMap(fresh); })
            .catch(() => {});
        }
      })
      .catch(() => {
        if (cancelled || !navigator.onLine) return;
        fetchDistritoMunicipioAndPersist()
          .then((fresh) => { if (!cancelled) setDistritoMunicipioMap(fresh); })
          .catch(() => {});
      });
    return () => { cancelled = true; };
  }, []);

  const uniqueDistritos = useMemo(() => {
    if (distritoMunicipioMap.length > 0) {
      return distritoMunicipioMap.map((e) => e.distrito).sort();
    }
    const set = new Set(sites.map((s) => s.distrito).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, distritoMunicipioMap]);

  const availableMunicipios = useMemo(() => {
    if (distritoMunicipioMap.length > 0) {
      if (form.distrito) {
        const entry = distritoMunicipioMap.find((e) => e.distrito === form.distrito);
        return entry ? entry.municipios.sort() : [];
      }
      const all = new Set<string>();
      distritoMunicipioMap.forEach((e) => e.municipios.forEach((m) => all.add(m)));
      return Array.from(all).sort();
    }
    const source = form.distrito ? sites.filter((s) => s.distrito === form.distrito) : sites;
    const set = new Set(source.map((s) => s.municipio).filter(Boolean));
    return Array.from(set).sort();
  }, [sites, distritoMunicipioMap, form.distrito]);

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setGmsInput('');
    setGmsError(null);
    setGmsMode(false);
    openForm();
  };

  const handleOpenEdit = (site: SiteRecord) => {
    setEditingId(site.id);
    const { id, ...rest } = site;
    setForm(rest);
    if (site.location?.latitude && site.location?.longitude) {
      setGmsInput(formatToGMS(site.location.latitude, site.location.longitude));
      setGmsMode(true);
    } else {
      setGmsInput('');
      setGmsMode(false);
    }
    setGmsError(null);
    openForm();
  };

  const handleOpenDelete = (id: string) => {
    setDeletingId(id);
    openDelete();
  };

  const handleOpenView = (site: SiteRecord) => {
    setViewingSite(site);
    openView();
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

  const handleGmsChange = (value: string) => {
    setGmsInput(value);
    if (!value.trim()) {
      setGmsError(null);
      return;
    }
    const parsed = parseGMS(value);
    if (!parsed) {
      setGmsError('Formato inválido. Ejemplo: 3°48\'44"N 76°37\'18"W');
      return;
    }
    setGmsError(null);
    updateField('location', { latitude: parsed.latitude, longitude: parsed.longitude });
  };

  useEffect(() => {
    if (gmsMode && form.location?.latitude && form.location?.longitude) {
      setGmsInput(formatToGMS(form.location.latitude, form.location.longitude));
    }
  }, [form.location?.latitude, form.location?.longitude, gmsMode]);

  const handleToggleGmsMode = () => {
    if (!gmsMode) {
      setGmsMode(true);
      if (form.location?.latitude && form.location?.longitude) {
        setGmsInput(formatToGMS(form.location.latitude, form.location.longitude));
      }
    } else {
      setGmsMode(false);
      setGmsInput('');
      setGmsError(null);
    }
  };

  // --- Selection helpers ---
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;

  // --- Excel handlers ---
  const handleExport = () => {
    const toExport = selectedIds.size > 0
      ? sites.filter((s) => selectedIds.has(s.id))
      : sites;
    exportSitesToExcel(toExport);
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setImportError(null);
    setImportPlan(null);
    try {
      const parseResult = await parseExcelFile(file);
      if (parseResult.rows.length === 0 && parseResult.failed.length === 0) {
        setImportError('El archivo no contiene filas con datos.');
        openImport();
        return;
      }
      const plan = buildUpsertPlan(parseResult, sites);
      setImportPlan(plan);
      openImport();
    } catch {
      setImportError('No se pudo leer el archivo. Asegúrese de que sea un Excel válido.');
      openImport();
    } finally {
      resetFileRef.current?.();
    }
  };

  const handleConfirmImport = async () => {
    if (!importPlan) return;
    setImporting(true);
    try {
      for (const row of importPlan.toCreate) {
        await createSite(parsedRowToSitePayload(row));
      }
      for (const { id, data } of importPlan.toUpdate) {
        await updateSite(id, parsedRowToSitePayload(data));
      }
      closeImport();
      setImportPlan(null);
      await fetchSites();
    } catch (error) {
      console.error('Error importing sites:', error);
      setImportError('Error al importar. Algunos registros pudieron haberse guardado.');
    } finally {
      setImporting(false);
    }
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
          comboboxProps={{ withinPortal: false }}
          required
        />
        <Select
          label="Distrito"
          placeholder="Seleccione distrito"
          data={uniqueDistritos.map((d) => ({ value: d, label: d }))}
          value={form.distrito || null}
          onChange={(val) => {
            updateField('distrito', val ?? '');
            if (val !== form.distrito) updateField('municipio', '');
          }}
          searchable
          clearable
          comboboxProps={{ withinPortal: false }}
          required
        />
        <Select
          label="Municipio"
          placeholder="Seleccione municipio"
          data={availableMunicipios.map((m) => ({ value: m, label: m }))}
          value={form.municipio || null}
          onChange={(val) => {
            const mun = val ?? '';
            updateField('municipio', mun);
            if (mun && !form.distrito) {
              const parent = distritoMunicipioMap.find((e) => e.municipios.includes(mun));
              if (parent) updateField('distrito', parent.distrito);
            }
          }}
          searchable
          clearable
          comboboxProps={{ withinPortal: false }}
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
        <TextInput
          label="Coordenadas GMS"
          placeholder="3°48'44&quot;N 76°37'18&quot;W"
          value={gmsInput}
          onChange={(e) => handleGmsChange((e.target as HTMLInputElement).value)}
          error={gmsError}
          rightSection={
            <ActionIcon
              variant={gmsMode ? 'filled' : 'default'}
              color={gmsMode ? 'blue' : 'gray'}
              onClick={handleToggleGmsMode}
              title={gmsMode ? 'Desactivar modo GMS' : 'Activar modo GMS'}
            >
              {gmsMode ? <IconLinkOff size={16} /> : <IconLink size={16} />}
            </ActionIcon>
          }
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

  const renderViewModal = () => {
    if (!viewingSite) return null;
    const gms = viewingSite.location?.latitude && viewingSite.location?.longitude
      ? formatToGMS(viewingSite.location.latitude, viewingSite.location.longitude)
      : 'No disponible';
    const googleMapsUrl = viewingSite.location?.latitude && viewingSite.location?.longitude
      ? `https://www.google.com/maps?q=${viewingSite.location.latitude},${viewingSite.location.longitude}`
      : null;

    return (
      <Modal opened={viewOpened} onClose={closeView} title="Detalles del Sitio" size="md">
        <Stack gap="sm">
          <Group justify="space-between">
            <Text fw={500} size="lg">{viewingSite.name}</Text>
            {siteTypeBadge(viewingSite.site_type)}
          </Group>
          
          <Divider />
          
          <Grid>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Código</Text>
              <Text>{viewingSite.site_code}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Cámaras</Text>
              <Text>{viewingSite.cameras_count}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Distrito</Text>
              <Text>{viewingSite.distrito}</Text>
            </Grid.Col>
            <Grid.Col span={6}>
              <Text size="sm" c="dimmed">Municipio</Text>
              <Text>{viewingSite.municipio}</Text>
            </Grid.Col>
          </Grid>
          
          <div>
            <Text size="sm" c="dimmed">Dirección</Text>
            <Text>{viewingSite.address}</Text>
          </div>
          
          <div>
            <Text size="sm" c="dimmed">Coordenadas</Text>
            <Text>GMS: {gms}</Text>
            <Text>Decimal: {viewingSite.location?.latitude?.toFixed(6) ?? 'N/A'}, {viewingSite.location?.longitude?.toFixed(6) ?? 'N/A'}</Text>
            {googleMapsUrl && (
              <Button
                component="a"
                href={googleMapsUrl}
                target="_blank"
                variant="light"
                size="xs"
                leftSection={<IconMapPin size={14} />}
                mt="xs"
              >
                Ver en Google Maps
              </Button>
            )}
          </div>
          
          {viewingSite.description && (
            <div>
              <Text size="sm" c="dimmed">Descripción</Text>
              <Text>{viewingSite.description}</Text>
            </div>
          )}
          
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeView}>Cerrar</Button>
          </Group>
        </Stack>
      </Modal>
    );
  };

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
              leftSection={<IconEye size={14} />}
              onClick={() => handleOpenView(site)}
              style={{ flex: 1 }}
            >
              Ver
            </Button>
            <Button
              variant="light"
              size="xs"
              leftSection={<IconEdit size={14} />}
              onClick={() => handleOpenEdit(site)}
              style={{ flex: 1 }}
            >
              Editar
            </Button>
            {/* <Button
              variant="light"
              color="red"
              size="xs"
              leftSection={<IconTrash size={14} />}
              onClick={() => handleOpenDelete(site.id)}
              style={{ flex: 1 }}
            >
              Eliminar
            </Button> */}
          </Group>
        </Card>
      ))}
    </Stack>
  );

  const renderTable = () => (
    <Table striped highlightOnHover withTableBorder verticalSpacing="md" horizontalSpacing="md">
      <Table.Thead>
        <Table.Tr>
          <Table.Th w={40}>
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={toggleSelectAll}
              aria-label="Seleccionar todos"
            />
          </Table.Th>
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
          <Table.Tr key={site.id} bg={selectedIds.has(site.id) ? 'var(--mantine-primary-color-light)' : undefined}>
            <Table.Td>
              <Checkbox
                checked={selectedIds.has(site.id)}
                onChange={() => toggleSelect(site.id)}
                aria-label={`Seleccionar ${site.site_code}`}
              />
            </Table.Td>
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
                <Tooltip label="Ver">
                  <ActionIcon variant="subtle" color="gray" onClick={() => handleOpenView(site)}>
                    <IconEye size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Editar">
                  <ActionIcon variant="subtle" color="blue" onClick={() => handleOpenEdit(site)}>
                    <IconEdit size={16} />
                  </ActionIcon>
                </Tooltip>
                {/* <Tooltip label="Eliminar">
                  <ActionIcon variant="subtle" color="red" onClick={() => handleOpenDelete(site.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip> */}
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
          <Menu shadow="md" width={220}>
            <Menu.Target>
              <Button variant="default" leftSection={<IconFileSpreadsheet size={16} />}>
                Excel
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Importar</Menu.Label>
              <FileButton onChange={handleFileSelected} accept=".xlsx,.xls,.csv" resetRef={resetFileRef}>
                {(props) => (
                  <Menu.Item leftSection={<IconUpload size={14} />} {...props}>
                    Cargar archivo Excel
                  </Menu.Item>
                )}
              </FileButton>
              <Menu.Item leftSection={<IconTemplate size={14} />} onClick={downloadTemplate}>
                Descargar plantilla vacía
              </Menu.Item>
              <Menu.Divider />
              <Menu.Label>Exportar</Menu.Label>
              <Menu.Item leftSection={<IconDownload size={14} />} onClick={handleExport}>
                {selectedIds.size > 0
                  ? `Exportar selección (${selectedIds.size})`
                  : 'Exportar todos los sitios'}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
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
          <Group justify="space-between" mb="sm">
            <Text size="sm" c="dimmed">
              Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length} sitios
            </Text>
            {selectedIds.size > 0 && (
              <Group gap="xs">
                <Text size="sm" fw={500}>{selectedIds.size} seleccionados</Text>
                <Button variant="subtle" size="xs" onClick={() => setSelectedIds(new Set())}>
                  Limpiar selección
                </Button>
              </Group>
            )}
          </Group>
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
      {renderViewModal()}

      <Modal opened={importOpened} onClose={closeImport} title="Importar desde Excel" size="lg">
        <Stack gap="sm">
          {importError && (
            <Alert color="red" title="Error">{importError}</Alert>
          )}
          {importPlan && (
            <>
              <Text size="sm">Resultado del análisis:</Text>
              <Group gap="xs" wrap="wrap">
                {importPlan.toCreate.length > 0 && (
                  <Badge color="green" variant="light" size="lg">
                    {importPlan.toCreate.length} nuevos
                  </Badge>
                )}
                {importPlan.toUpdate.length > 0 && (
                  <Badge color="yellow" variant="light" size="lg">
                    {importPlan.toUpdate.length} a actualizar
                  </Badge>
                )}
                {importPlan.unchanged > 0 && (
                  <Badge color="gray" variant="light" size="lg">
                    {importPlan.unchanged} sin cambios
                  </Badge>
                )}
                {importPlan.failed.length > 0 && (
                  <Badge color="red" variant="light" size="lg">
                    {importPlan.failed.length} con errores
                  </Badge>
                )}
              </Group>

              {importPlan.failed.length > 0 && (
                <Alert color="red" title={`Filas con errores (${importPlan.failed.length})`}>
                  <ScrollArea.Autosize mah={200}>
                    <Stack gap={8}>
                      {importPlan.failed.map((f) => (
                        <div key={f.rowNumber}>
                          <Text size="sm" fw={500}>
                            Fila {f.rowNumber} — {f.site_code}
                          </Text>
                          <List size="xs" withPadding>
                            {f.reasons.map((r, i) => (
                              <List.Item key={i}>{r}</List.Item>
                            ))}
                          </List>
                        </div>
                      ))}
                    </Stack>
                  </ScrollArea.Autosize>
                </Alert>
              )}

              {importPlan.toCreate.length === 0 && importPlan.toUpdate.length === 0 ? (
                <Text size="sm" c="dimmed">No hay cambios válidos para aplicar.</Text>
              ) : (
                <Text size="sm" c="dimmed">
                  ¿Desea continuar con los registros válidos? Los sitios se identifican por su código (site_code).
                  {importPlan.failed.length > 0 && ' Las filas con errores serán omitidas.'}
                </Text>
              )}
              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeImport}>Cancelar</Button>
                <Button
                  onClick={handleConfirmImport}
                  loading={importing}
                  disabled={importPlan.toCreate.length === 0 && importPlan.toUpdate.length === 0}
                >
                  Confirmar importación
                </Button>
              </Group>
            </>
          )}
          {!importPlan && !importError && (
            <Text size="sm" c="dimmed">Procesando archivo...</Text>
          )}
        </Stack>
      </Modal>
    </div>
  );
}
