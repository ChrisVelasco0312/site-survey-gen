import { useEffect, useState, useMemo } from "preact/hooks";
import {
  Title,
  Table,
  Badge,
  Button,
  Loader,
  Text,
  Group,
  ActionIcon,
  Tooltip,
  Card,
  Stack,
  Tabs,
  TextInput,
  Select,
  Pagination,
} from "@mantine/core";
import { useMediaQuery, useDebouncedValue } from "@mantine/hooks";
import { Report } from "../../types/Report";
import { IconEye, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import { useLocation } from "preact-iso";
import { getAllReports } from "../../services/reportsService";
import { formatReportDate } from "../../utils/reportDate";

const PAGE_SIZE = 10;

export function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>("en_campo");
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterGroup, activeTab]);

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
        status === "generado"
          ? "green"
          : status === "listo_para_generar"
            ? "blue"
            : status === "en_revision"
              ? "orange"
              : "gray"
      }
    >
      {status?.replace(/_/g, " ")}
    </Badge>
  );

  const renderMobileList = (filtered: Report[]) => (
    <Stack>
      {filtered.map((report) => (
        <Card key={report.id} shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between" mb="xs" align="flex-start">
            <div>
              <Text fw={500}>
                {[report.address?.distrito, report.address?.municipio]
                  .filter(Boolean)
                  .join(" - ")}
              </Text>
              <Text size="sm" c="dimmed">
                  {report.address?.site_name
                    ? report.address?.site_name +
                    " - " +
                    report.address?.full_address
                    : "Sin dirección"}
              </Text>
            </div>
            {getStatusBadge(report.status)}
          </Group>

          <Text size="sm" c="dimmed" mb="xs">
            {formatReportDate(report.date, report.created_at)} •{" "}
            {report.group === 'all' ? 'Administrador' : report.group === 'grupo_a' ? 'Grupo 1' : 'Grupo 2'}
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

  const applyFilters = (filterStatus: string[]) => {
    let result = reports.filter((r) => filterStatus.includes(r.status));

    if (filterGroup) {
      result = result.filter((r) => r.group === filterGroup);
    }

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.trim().toLowerCase();
      result = result.filter((r) => {
        const addr = r.address;
        return (
          (addr?.site_name ?? "").toLowerCase().includes(q) ||
          (addr?.full_address ?? "").toLowerCase().includes(q) ||
          (addr?.distrito ?? "").toLowerCase().includes(q) ||
          (addr?.municipio ?? "").toLowerCase().includes(q) ||
          (addr?.pm_number ?? "").toLowerCase().includes(q)
        );
      });
    }

    return result;
  };

  const renderContent = (filterStatus: string[]) => {
    const filtered = applyFilters(filterStatus);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    if (filtered.length === 0) {
      return (
        <Text c="dimmed" ta="center" py="xl">
          No hay reportes en este estado.
        </Text>
      );
    }

    if (isMobile) {
      return (
        <>
          {renderMobileList(paged)}
          {totalPages > 1 && (
            <Group justify="center" mt="md">
              <Pagination size="sm" value={page} onChange={setPage} total={totalPages} siblings={1} boundaries={1} />
            </Group>
          )}
        </>
      );
    }

    return (
      <>
        <Text size="sm" c="dimmed" mb="xs">
          Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
        </Text>
        <Table
          striped
          highlightOnHover
          withTableBorder
          verticalSpacing="md"
          horizontalSpacing="md"
        >
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
            {paged.map((report) => (
              <Table.Tr key={report.id}>
                <Table.Td>
                  {formatReportDate(report.date, report.created_at)}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>
                    {[report.address?.distrito, report.address?.municipio]
                      .filter(Boolean)
                      .join(" - ")}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {report.address?.site_name
                      ? report.address?.site_name +
                      " - " +
                      report.address?.full_address
                      : "Sin dirección"}
                  </Text>
                </Table.Td>
                <Table.Td style={{ textTransform: "capitalize" }}>
                  {report.group === 'all' ? 'Administrador' : report.group === 'grupo_a' ? 'Grupo 1' : 'Grupo 2'}
                </Table.Td>
                <Table.Td>{getStatusBadge(report.status)}</Table.Td>
                <Table.Td>
                  <Tooltip label="Ver detalles">
                    <ActionIcon
                      variant="subtle"
                      color="blue"
                      onClick={() => location.route(`/reporte/${report.id}`)}
                    >
                      <IconEye size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} siblings={1} boundaries={1} />
          </Group>
        )}
      </>
    );
  };

  return (
    <div style={{ padding: "20px" }}>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Dashboard General</Title>
        <Button
          onClick={fetchReports}
          leftSection={<IconRefresh size={16} />}
          loading={loading}
        >
          Actualizar
        </Button>
      </Group>

      {loading ? (
        <Loader />
      ) : (
        <>
        <Group gap="sm" mb="md" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Buscar por sitio, dirección, distrito, municipio…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
            style={{ flex: "1 1 250px" }}
            rightSection={search ? (
              <ActionIcon variant="subtle" size="sm" onClick={() => setSearch("")}>
                <IconX size={14} />
              </ActionIcon>
            ) : undefined}
          />
          <Select
            placeholder="Grupo"
            data={[
              { value: "all", label: "Administrador" },
              { value: "grupo_a", label: "Grupo 1" },
              { value: "grupo_b", label: "Grupo 2" },
            ]}
            value={filterGroup}
            onChange={setFilterGroup}
            clearable
            style={{ flex: "0 0 160px" }}
          />
        </Group>
        <Tabs value={activeTab} onChange={setActiveTab} keepMounted={false}>
          <Tabs.List mb="md">
            <Tabs.Tab value="en_campo">En Campo</Tabs.Tab>
            <Tabs.Tab value="en_revision">En Revisión</Tabs.Tab>
            <Tabs.Tab value="listo_para_generar">Listos para Generar</Tabs.Tab>
            <Tabs.Tab value="generado">Generados</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="en_campo">
            {renderContent(["en_campo"])}
          </Tabs.Panel>

          <Tabs.Panel value="en_revision">
            {renderContent(["en_revision"])}
          </Tabs.Panel>

          <Tabs.Panel value="listo_para_generar">
            {renderContent(["listo_para_generar"])}
          </Tabs.Panel>

          <Tabs.Panel value="generado">
            {renderContent(["generado"])}
          </Tabs.Panel>
        </Tabs>
        </>
      )}
    </div>
  );
}
