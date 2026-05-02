import { useEffect, useState } from "preact/hooks";
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
import { IconEye, IconFileSpreadsheet, IconRefresh, IconSearch, IconX } from "@tabler/icons-react";
import { useLocation } from "preact-iso";
import * as XLSX from "xlsx";
import { getAllReports } from "../../services/reportsService";
import { formatReportDate } from "../../utils/reportDate";

const PAGE_SIZE = 10;
const STATUS_LABELS: Record<string, string> = {
  en_campo: "En campo",
  en_revision: "En revisión",
  listo_para_generar: "Listos para generar",
  generado: "Generados",
};
const GROUP_LABELS: Record<string, string> = {
  all: "Administrador",
  grupo_a: "Grupo 1",
  grupo_b: "Grupo 2",
};

export function AdminDashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>("en_campo");
  const location = useLocation();
  const isMobile = useMediaQuery("(max-width: 768px)");

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const [filterGroup, setFilterGroup] = useState<string | null>(null);
  const [signatureFilter, setSignatureFilter] = useState<string | null>(null);
  const [commentFilter, setCommentFilter] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterGroup, signatureFilter, commentFilter, activeTab]);

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

  const hasSignature = (signatureUrl?: string) => Boolean(signatureUrl?.trim());
  const hasInterventoriaComment = (report: Report) =>
    Boolean(report.interventoria_observation?.trim());
  const formatDateTime = (timestamp: number) =>
    new Date(timestamp).toLocaleString("es-CO");

  const decimalToGMS = (decimal: number, isLatitude: boolean): string => {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesFull = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesFull);
    const seconds = Math.round((minutesFull - minutes) * 60);

    const direction = isLatitude
      ? decimal >= 0 ? "N" : "S"
      : decimal >= 0 ? "E" : "W";

    return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
  };

  const formatMapPins = (mapPins?: { lat: number; lon: number; label: string }[]): string => {
    if (!mapPins || mapPins.length === 0) {
      return "";
    }
    return mapPins
      .map((pin) => `${pin.label}: ${decimalToGMS(pin.lat, true)}, ${decimalToGMS(pin.lon, false)}`)
      .join("; ");
  };

  const getSignatureCompletionCount = (report: Report) => (
    [
      report.signature_img_director_url,
      report.signature_img_coordinator_url,
      report.signature_img_interventoria_url,
    ].filter((url) => hasSignature(url)).length
  );

  const renderSignatureChecks = (report: Report) => {
    const signatureStates = [
      { label: "Dir", ok: hasSignature(report.signature_img_director_url) },
      { label: "Coord", ok: hasSignature(report.signature_img_coordinator_url) },
      { label: "Interv", ok: hasSignature(report.signature_img_interventoria_url) },
    ];
    const completed = signatureStates.filter((item) => item.ok).length;

    return (
      <Stack gap={2}>
        <Badge
          size="sm"
          variant="light"
          color={completed === 3 ? "green" : completed > 0 ? "yellow" : "red"}
          w="fit-content"
        >
          {completed}/3
        </Badge>
        <Group gap={4}>
          {signatureStates.map((item) => (
            <Badge
              key={item.label}
              size="xs"
              variant="light"
              color={item.ok ? "green" : "red"}
            >
              {item.label} {item.ok ? "✔" : "✖"}
            </Badge>
          ))}
        </Group>
      </Stack>
    );
  };

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

    if (filterStatus.includes("listo_para_generar") && signatureFilter) {
      result = result.filter((r) => {
        const signatureCount = getSignatureCompletionCount(r);
        const isComplete = signatureCount === 3;
        if (signatureFilter === "none") {
          return signatureCount === 0;
        }
        return signatureFilter === "complete" ? isComplete : !isComplete;
      });
    }

    if (filterStatus.includes("listo_para_generar") && commentFilter) {
      result = result.filter((r) => {
        const hasComment = hasInterventoriaComment(r);
        return commentFilter === "with_comment" ? hasComment : !hasComment;
      });
    }

    return result;
  };

  const getActiveStatusFilter = (): string[] => {
    if (!activeTab) {
      return [];
    }

    if (activeTab === "en_campo" || activeTab === "en_revision" || activeTab === "listo_para_generar" || activeTab === "generado") {
      return [activeTab];
    }

    return [];
  };

  const exportCurrentTabToExcel = () => {
    const activeStatusFilter = getActiveStatusFilter();
    if (activeStatusFilter.length === 0) {
      return;
    }

    const filteredReports = applyFilters(activeStatusFilter);
    if (filteredReports.length === 0) {
      return;
    }

    const rows = filteredReports.map((report) => {
      const signatureCount = getSignatureCompletionCount(report);
      return {
        "ID reporte": report.id,
        "ID usuario": report.user_id,
        "Estado": STATUS_LABELS[report.status] ?? report.status.replace(/_/g, " "),
        "Grupo": GROUP_LABELS[report.group] ?? report.group,
        "Fecha del reporte": formatReportDate(report.date, report.created_at),
        "Fecha creación": formatDateTime(report.created_at),
        "Fecha actualización": formatDateTime(report.updated_at),
        "PM/N°": report.address?.pm_number ?? "",
        "Tipo de sitio": report.address?.site_type ?? "",
        "Distrito": report.address?.distrito ?? "",
        "Municipio": report.address?.municipio ?? "",
        "Nombre del sitio": report.address?.site_name ?? "",
        "Dirección": report.address?.full_address ?? "",
        "Latitud": report.address?.latitude ?? "",
        "Longitud": report.address?.longitude ?? "",
        "Coordenadas GMS": report.address?.latitude && report.address?.longitude
          ? `${decimalToGMS(report.address.latitude, true)}, ${decimalToGMS(report.address.longitude, false)}`
          : "",
        "Coordenadas Adicionales": formatMapPins(report.map_pins),
        "Firmas completadas": `${signatureCount}/3`,
        "Firma director": hasSignature(report.signature_img_director_url) ? "Sí" : "No",
        "Firma coordinador": hasSignature(report.signature_img_coordinator_url) ? "Sí" : "No",
        "Firma interventoría": hasSignature(report.signature_img_interventoria_url) ? "Sí" : "No",
        "Comentario interventoría": report.interventoria_observation?.trim() ?? "",
        "URL PDF": report.pdf_url ?? "",
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reportes");

    const today = new Date().toISOString().slice(0, 10);
    const statusLabel = STATUS_LABELS[activeStatusFilter[0]] ?? activeStatusFilter[0];
    const safeStatus = statusLabel.toLowerCase().replace(/\s+/g, "_");
    XLSX.writeFile(workbook, `reportes_${safeStatus}_${today}.xlsx`);
  };

  const renderContent = (filterStatus: string[]) => {
    const showSignaturesColumn = filterStatus.includes("listo_para_generar");
    const showCommentsColumn = filterStatus.includes("listo_para_generar") && Boolean(commentFilter);
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
              {showSignaturesColumn && <Table.Th>Firmas</Table.Th>}
              {showCommentsColumn && <Table.Th>Comentario</Table.Th>}
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
                {showSignaturesColumn && (
                  <Table.Td>{renderSignatureChecks(report)}</Table.Td>
                )}
                {showCommentsColumn && (
                  <Table.Td>
                    {hasInterventoriaComment(report) ? (
                      <Tooltip
                        multiline
                        w={320}
                        label={(
                          <Text size="sm" style={{ whiteSpace: "normal" }}>
                            {report.interventoria_observation?.trim()}
                          </Text>
                        )}
                      >
                        <Text size="sm">
                          {(report.interventoria_observation ?? "").trim().length > 60
                            ? `${(report.interventoria_observation ?? "").trim().slice(0, 60)}...`
                            : (report.interventoria_observation ?? "").trim()}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm" c="dimmed">-</Text>
                    )}
                  </Table.Td>
                )}
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

  const exportableReportsCount = applyFilters(getActiveStatusFilter()).length;

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
          {activeTab === "listo_para_generar" && (
            <>
              <Select
                placeholder="Firmas"
                data={[
                  { value: "complete", label: "Completas (3/3)" },
                  { value: "incomplete", label: "Incompletas (<3/3)" },
                  { value: "none", label: "Sin firmas (0/3)" },
                ]}
                value={signatureFilter}
                onChange={setSignatureFilter}
                clearable
                style={{ flex: "0 0 190px" }}
              />
              <Select
                placeholder="Comentario"
                data={[
                  { value: "with_comment", label: "Con comentario" },
                  { value: "without_comment", label: "Sin comentario" },
                ]}
                value={commentFilter}
                onChange={setCommentFilter}
                clearable
                style={{ flex: "0 0 190px" }}
              />
            </>
          )}
          <Button
            variant="light"
            leftSection={<IconFileSpreadsheet size={16} />}
            onClick={exportCurrentTabToExcel}
            disabled={exportableReportsCount === 0}
            style={{ flex: "0 0 auto" }}
          >
            Exportar Excel
          </Button>
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
