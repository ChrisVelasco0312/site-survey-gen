import { useState, useEffect, useMemo } from 'preact/hooks';
import { useAuth } from '../../features/auth/AuthContext';
import { useLocation } from 'preact-iso';
import { 
  Title, 
  Container, 
  Paper, 
  Table, 
  Button, 
  Group, 
  Modal, 
  TextInput, 
  Select, 
  Stack, 
  Badge,
  PasswordInput,
  ActionIcon,
  Tooltip,
  Text,
  Pagination,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconPlus, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { UserProfile, UserRole, GroupAssignment } from '../../types/User';
import { getUsers, createUser } from '../../services/userAdminService';

const PAGE_SIZE = 10;

export function UsersAdmin() {
  const { userData } = useAuth();
  const location = useLocation();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpened, setModalOpened] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filterRole, setFilterRole] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterRole]);

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<UserRole>('field_worker');
  const [groupAssignment, setGroupAssignment] = useState<GroupAssignment>('grupo_a');

  useEffect(() => {
    // Only superadmin can access this page
    if (userData && userData.role !== 'superadmin') {
      location.route('/');
      return;
    }
    fetchUsers();
  }, [userData]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      alert('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!email || !password || !fullName || !role) {
      alert('Por favor complete todos los campos obligatorios');
      return;
    }

    setSubmitting(true);
    try {
      await createUser(email, password, fullName, role, groupAssignment);
      alert('Usuario creado exitosamente');
      setModalOpened(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert('Error al crear usuario: ' + (error.message || 'Error desconocido'));
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('field_worker');
    setGroupAssignment('grupo_a');
  };

  if (!userData || userData.role !== 'superadmin') {
    return null; // or a spinner
  }

  const roleLabels: Record<string, string> = {
    superadmin: 'Super Admin',
    admin: 'Admin',
    field_worker: 'Trabajador de Campo',
    read_only: 'Solo Lectura',
  };

  const groupLabels: Record<string, string> = {
    grupo_a: 'Grupo 1',
    grupo_b: 'Grupo 2',
    all: 'Todos',
  };

  const filtered = useMemo(() => {
    let result = users;

    if (filterRole) {
      result = result.filter((u) => u.role === filterRole);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    }

    return result;
  }, [users, debouncedSearch, filterRole]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="lg">
        <Title order={2}>Administración de Usuarios</Title>
        <Group>
          <ActionIcon variant="light" size="lg" onClick={fetchUsers} disabled={loading}>
            <IconRefresh size={20} />
          </ActionIcon>
          <Button leftSection={<IconPlus size={18} />} onClick={() => setModalOpened(true)}>
            Nuevo Usuario
          </Button>
        </Group>
      </Group>

      <Group gap="sm" mb="md" wrap="wrap" align="flex-end">
        <TextInput
          placeholder="Buscar por nombre o email…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
          style={{ flex: '1 1 250px' }}
          rightSection={search ? (
            <ActionIcon variant="subtle" size="sm" onClick={() => setSearch('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : undefined}
        />
        <Select
          placeholder="Rol"
          data={[
            { value: 'superadmin', label: 'Super Admin' },
            { value: 'admin', label: 'Admin' },
            { value: 'field_worker', label: 'Trabajador de Campo' },
            { value: 'read_only', label: 'Solo Lectura' },
          ]}
          value={filterRole}
          onChange={setFilterRole}
          clearable
          style={{ flex: '0 0 200px' }}
        />
      </Group>

      <Paper shadow="sm" radius="md" p="md" withBorder>
        {!loading && filtered.length > 0 && (
          <Text size="sm" c="dimmed" mb="xs">
            Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
          </Text>
        )}
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nombre Completo</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Rol</Table.Th>
              <Table.Th>Grupo</Table.Th>
              <Table.Th>Estado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  Cargando usuarios...
                </Table.Td>
              </Table.Tr>
            ) : filtered.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center' }}>
                  {users.length === 0 ? 'No se encontraron usuarios' : 'Sin resultados para la búsqueda'}
                </Table.Td>
              </Table.Tr>
            ) : (
              paged.map((user) => (
                <Table.Tr key={user.uid}>
                  <Table.Td>{user.full_name}</Table.Td>
                  <Table.Td>{user.email}</Table.Td>
                  <Table.Td>
                    <Badge color={user.role === 'superadmin' ? 'red' : user.role === 'admin' ? 'blue' : 'gray'}>
                      {roleLabels[user.role] || user.role}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{groupLabels[user.group_assignment] || user.group_assignment}</Table.Td>
                  <Table.Td>
                    <Badge color={user.is_active ? 'green' : 'red'}>
                      {user.is_active ? 'Activo' : 'Inactivo'}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} siblings={1} boundaries={1} />
          </Group>
        )}
      </Paper>

      <Modal opened={modalOpened} onClose={() => setModalOpened(false)} title="Crear Nuevo Usuario" centered>
        <Stack gap="md">
          <TextInput
            label="Nombre Completo"
            placeholder="Ej. Juan Pérez"
            value={fullName}
            onChange={(e) => setFullName(e.currentTarget.value)}
            required
          />
          <TextInput
            label="Email"
            placeholder="correo@ejemplo.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            required
          />
          <PasswordInput
            label="Contraseña"
            placeholder="Mínimo 6 caracteres"
            value={password}
            onChange={(e) => setPassword(e.currentTarget.value)}
            required
          />
          <Select
            label="Rol"
            data={[
              { value: 'field_worker', label: 'Trabajador de Campo' },
              { value: 'admin', label: 'Administrador' },
              { value: 'superadmin', label: 'Super Admin' },
              { value: 'read_only', label: 'Solo Lectura' }
            ]}
            value={role}
            onChange={(val) => setRole(val as UserRole)}
            required
          />
          
          {role === 'field_worker' && (
            <Select
              label="Grupo Asignado"
              data={[
                { value: 'grupo_a', label: 'Grupo 1' },
                { value: 'grupo_b', label: 'Grupo 2' }
              ]}
              value={groupAssignment}
              onChange={(val) => setGroupAssignment(val as GroupAssignment)}
              required
            />
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpened(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} loading={submitting}>Crear Usuario</Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
