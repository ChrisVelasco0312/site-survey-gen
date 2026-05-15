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
  Modal,
} from "@mantine/core";
import { useMediaQuery, useDebouncedValue } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Report } from "../../types/Report";
import { IconEye, IconFileSpreadsheet, IconRefresh, IconSearch, IconX, IconFileZip, IconDownload, IconRotateClockwise } from "@tabler/icons-react";
import { useLocation } from "preact-iso";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { getAllReports, updateReportStatus } from "../../services/reportsService";
import { getGeneratedReportByReportId, deleteGeneratedReport } from "../../services/generatedReportsService";
import { formatReportDate } from "../../utils/reportDate";
import { useAuth } from "../../features/auth/AuthContext";

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
  const { userData } = useAuth();
  const isSuperadmin = userData?.role === 'superadmin';
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [generatedPdfUrls, setGeneratedPdfUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<string | null>("en_campo");
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [reportToRestore, setReportToRestore] = useState<Report | null>(null);
  const [restoring, setRestoring] = useState(false);
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

      const generadoReports = data.filter((r) => r.status === "generado");
      const pdfUrls: Record<string, string> = {};

      await Promise.all(
        generadoReports.map(async (report) => {
          try {
            const genReport = await getGeneratedReportByReportId(report.id);
            if (genReport?.pdf_url) {
              pdfUrls[report.id] = genReport.pdf_url;
            }
          } catch (err) {
            console.error(`Error fetching PDF for ${report.id}:`, err);
          }
        }),
      );
      setGeneratedPdfUrls(pdfUrls);
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

    const cablingLabels: Record<string, string> = {
      aereo: 'Aéreo',
      subterraneo: 'Subterráneo',
      mixto: 'Mixto',
    };

    const mountingLabels: Record<string, string> = {
      soporte_t: 'Soporte T',
      soporte_c: 'Soporte C',
      poste: 'Soporte C (Pórtico)',
      soporte_l: 'Soporte L',
    };

    const transmissionLabels: Record<string, string> = {
      fibra_optica: 'Fibra óptica',
      radio_enlace: 'Radioenlace',
      na: 'N/A',
    };

    const getSentiDoVialLabel = (val?: string): string => {
      const map: Record<string, string> = {
        unidireccional_norte_sur: 'Unidireccional Norte → Sur',
        unidireccional_sur_norte: 'Unidireccional Sur → Norte',
        unidireccional_oriente_occidente: 'Unidireccional Oriente → Occidente',
        unidireccional_occidente_oriente: 'Unidireccional Occidente → Oriente',
        unidireccional_nororiente_suroccidente: 'Unidireccional Nororiente → Suroccidente',
        unidireccional_noroeste_sureste: 'Unidireccional Noroeste → Sureste',
        bidireccional_norte_sur: 'Bidireccional Norte ⇄ Sur',
        bidireccional_sur_norte: 'Bidireccional Sur ⇄ Norte',
        bidireccional_oriente_occidente: 'Bidireccional Oriente ⇄ Occidente',
        bidireccional_occidente_oriente: 'Bidireccional Occidente ⇄ Oriente',
        bidireccional_nororiente_suroccidente: 'Bidireccional Nororiente ⇄ Suroccidente',
        bidireccional_noroeste_sureste: 'Bidireccional Noroeste ⇄ Sureste',
      };
      return map[val ?? ''] ?? val ?? '';
    };

    const getAnguloHorizontalLabel = (val?: string): string => {
      const map: Record<string, string> = {
        menor_30: '< 30° (Recomendado)',
        '30_a_45': '30° - 45°',
        mayor_45: '> 45°',
      };
      return map[val ?? ''] ?? val ?? '';
    };

    const getCommonFields = (report: Report) => {
      const signatureCount = getSignatureCompletionCount(report);
      const aerialMeters = report.pole_infrastructure?.aerial_meters ?? 0;
      const grassMeters = report.pole_infrastructure?.grass_meters ?? 0;
      const asphaltMeters = report.pole_infrastructure?.asphalt_meters ?? 0;
      const adoquinMeters = report.pole_infrastructure?.adoquin_meters ?? 0;
      const concreteMeters = report.pole_infrastructure?.concrete_meters ?? 0;
      const fillMeters = report.pole_infrastructure?.fill_meters ?? 0;
      const totalRuta = aerialMeters + grassMeters + asphaltMeters + adoquinMeters + concreteMeters + fillMeters;
      const seHeight = report.infrastructure_details?.service_entrance?.height ?? 0;
      const cpHeight = report.infrastructure_details?.camera_point?.height ?? 0;
      const baseDist = totalRuta + seHeight + cpHeight;
      const distanciaElectrica = baseDist + (report.infrastructure_details?.electrical_distance ?? 0);
      const distanciaFibra = baseDist + (report.infrastructure_details?.fiber_distance ?? 0);

      return {
        "ID reporte": report.id,
        "ID usuario": report.user_id,
        "Estado": STATUS_LABELS[report.status] ?? report.status.replace(/_/g, " "),
        "Grupo": GROUP_LABELS[report.group] ?? report.group,
        "Fecha del reporte": formatReportDate(report.date, report.created_at),
        "Fecha creación": formatDateTime(report.created_at),
        "Fecha actualización": formatDateTime(report.updated_at),
        "PM/N°": report.address?.pm_number ?? "",
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
        "Nivel de seguridad": { alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }[report.security_level] ?? report.security_level,
        "Tipo de instalación": (report.installation_type ?? []).map((t: string) =>
          ({ fachada_mastil: 'Fachada / Mástil', poste: 'Poste', torre: 'Torre', terraza: 'Terraza', estructura: 'Estructura' }[t] ?? t)
        ).join(', '),
        "Línea de vista": report.connectivity?.has_line_of_sight ? 'Sí' : 'No',
        "Medio de transmisión": transmissionLabels[report.connectivity?.transmission_medium ?? ''] ?? report.connectivity?.transmission_medium ?? '',
        "Tipo Cableado": cablingLabels[report.connectivity?.cabling_type ?? ''] ?? '',
        "Total Ruta (mts)": totalRuta,
        "Ruta Aérea (mts)": aerialMeters,
        "Ruta Prado (mts)": grassMeters,
        "Ruta Asfalto (mts)": asphaltMeters,
        "Ruta Adoquín (mts)": adoquinMeters,
        "Ruta Concreto (mts)": concreteMeters,
        "Ruta Relleno (mts)": fillMeters,
        "Distancia Eléctrica (mts)": distanciaElectrica,
        "Distancia Fibra (mts)": distanciaFibra,
        "Altura Acometida (mts)": seHeight,
        "Material Acometida": report.infrastructure_details?.service_entrance?.material ?? '',
        "Altura Punto Cámara (mts)": cpHeight,
        "Material Punto Cámara": report.infrastructure_details?.camera_point?.material ?? '',
        "Tipo Instalación Cámara": mountingLabels[report.infrastructure_details?.camera_mounting ?? ''] ?? '',
        "Requiere Poste Apoyo": report.infrastructure_details?.needs_support_point === true ? 'Sí' :
          report.infrastructure_details?.needs_support_point === false ? 'No' : '',
        "Cantidad Postes Apoyo": report.infrastructure_details?.apoyo_cant ?? 0,
        "Cajas 40x40": report.hardware?.boxes_40 ?? 0,
        "Cajas 60x60": report.hardware?.boxes_60 ?? 0,
        "Pertenece a": report.owner_name ?? '',
        "Observaciones finales": report.final_observations ?? '',
        "Firmas completadas": `${signatureCount}/3`,
        "Firma director": hasSignature(report.signature_img_director_url) ? "Sí" : "No",
        "Firma coordinador": hasSignature(report.signature_img_coordinator_url) ? "Sí" : "No",
        "Firma interventoría": hasSignature(report.signature_img_interventoria_url) ? "Sí" : "No",
        "Comentario interventoría": report.interventoria_observation?.trim() ?? "",
        "URL PDF": report.pdf_url ?? '',
      };
    };

    const ptzReports = filteredReports.filter((r) => r.address?.site_type === 'ptz');
    const lprReports = filteredReports.filter((r) => r.address?.site_type === 'lpr');
    const facialReports = filteredReports.filter((r) => r.address?.site_type === 'cotejo_facial');

    const ptzRows = ptzReports.map((report) => ({
      ...getCommonFields(report),
      "Cámaras Multisensor": report.hardware?.cameras_multisensor ?? 0,
      "Cámaras PTZ": report.hardware?.cameras_ptz ?? 0,
      "Cámaras Fijas": report.hardware?.cameras_fixed ?? 0,
      "Cables eléctricos aéreos": report.ptz_survey?.has_aerial_cables === true ? 'Sí' :
        report.ptz_survey?.has_aerial_cables === false ? 'No' : '',
      "Distancia cables eléctricos (mts)": report.ptz_survey?.distance_from_pole ?? '',
    }));

    const lprRows = lprReports.map((report) => {
      const s = report.lpr_survey || {};
      return {
        ...getCommonFields(report),
        "Cámaras LPR": report.hardware?.cameras_lpr ?? 0,
        "Cámaras PTZ": report.hardware?.cameras_ptz ?? 0,
        "Sentido vial": getSentiDoVialLabel(s.sentido_vial),
        "Número de carriles": s.numero_carriles ?? '',
        "Distancia cámara - placas (m)": s.distancia_camara_placas ?? '',
        "Altura instalación (m)": s.altura_instalacion ?? '',
        "Ángulo horizontal": getAnguloHorizontalLabel(s.angulo_horizontal),
        "Ángulo vertical (°)": s.angulo_vertical ?? '',
        "FOV carriles": s.fov_carriles ?? '',
        "Obstáculo en FOV": s.obstaculo_fov === true ? 'Sí' : s.obstaculo_fov === false ? 'No' : '',
        "Descripción obstáculo": s.obstaculo_descripcion ?? '',
        "Iluminación": s.iluminacion_estado === 'con_iluminacion_publica' ? 'Con iluminación pública' :
          s.iluminacion_estado === 'sin_iluminacion_publica' ? 'Sin iluminación pública' : '',
        "Condiciones del sitio": Array.isArray(s.condiciones_sitio)
          ? s.condiciones_sitio.map((c: string) => c === 'otros' ? `Otros: ${s.condiciones_sitio_otros || ''}` : c.replace(/_/g, ' ')).join(', ')
          : '',
      };
    });

    const facialRows = facialReports.map((report) => {
      const s = report.cotejo_facial_survey || {};
      const zonaTipoLabels: Record<string, string> = { peatonal: 'Peatonal', mixta: 'Mixta (peatonal - vehicular)' };
      const iluminacionLabels: Record<string, string> = { con_iluminacion: 'Con iluminación', sin_iluminacion: 'Sin iluminación' };
      const enlaceLabels: Record<string, string> = { fibra_optica: 'Fibra Óptica', inalambrico: 'Inalámbrico' };
      const estructuraLabels: Record<string, string> = { poste: 'Poste', muro: 'Muro', techo: 'Techo', portico: 'Pórtico', otro: 'Otro' };
      return {
        ...getCommonFields(report),
        "Cámaras Facial": report.hardware?.cameras_facial ?? 0,
        "Tipo de zona": zonaTipoLabels[s.zona_tipo ?? ''] ?? s.zona_tipo ?? '',
        "Tipo de estructura": s.estructura_tipo === 'otro' ? `Otro: ${s.estructura_otro ?? ''}` : (estructuraLabels[s.estructura_tipo ?? ''] ?? s.estructura_tipo ?? ''),
        "Altura proyectada (m)": s.altura_proyectada ?? '',
        "Distancia rostro - cámara (m)": s.distancia_rostro_camara ?? '',
        "Área de cobertura": s.area_cobertura ?? '',
        "Ángulo horizontal (°)": s.angulo_horizontal ?? '',
        "Ángulo vertical (°)": s.angulo_vertical ?? '',
        "Iluminación": iluminacionLabels[s.iluminacion_estado ?? ''] ?? s.iluminacion_estado ?? '',
        "Punto eléctrico cercano": s.punto_electrico_cercano === true ? 'Sí' : s.punto_electrico_cercano === false ? 'No' : '',
        "Distancia punto eléctrico (m)": s.distancia_punto_electrico ?? '',
        "Tipo de enlace": enlaceLabels[s.tipo_enlace ?? ''] ?? s.tipo_enlace ?? '',
        "Distancia canalización (m)": s.distancia_canalizacion ?? '',
        "Riesgos identificados": Array.isArray(s.riesgos_identificados)
          ? s.riesgos_identificados.join(', ')
          : '',
        "Detalle riesgos": s.detalle_riesgos ?? '',
      };
    });

    const workbook = XLSX.utils.book_new();

    if (ptzRows.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(ptzRows), "Componente 1 PTZ");
    }
    if (lprRows.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(lprRows), "Componente 2 LPR");
    }
    if (facialRows.length > 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(facialRows), "Componente 3 Facial");
    }

    if (workbook.SheetNames.length === 0) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([]), "Sin datos");
    }

    const today = new Date().toISOString().slice(0, 10);
    const statusLabel = STATUS_LABELS[activeStatusFilter[0]] ?? activeStatusFilter[0];
    const safeStatus = statusLabel.toLowerCase().replace(/\s+/g, "_");
    XLSX.writeFile(workbook, `reportes_${safeStatus}_${today}.xlsx`);
  };

  const downloadPdfsZip = async () => {
    const generatedReports = applyFilters(["generado"]).filter((r) => generatedPdfUrls[r.id]);

    if (generatedReports.length === 0) {
      notifications.show({
        title: "Sin PDFs disponibles",
        message: "No hay reportes generados con PDF para descargar.",
        color: "yellow",
      });
      return;
    }

    setDownloadingZip(true);
    notifications.show({
      title: "Descargando PDFs",
      message: `Descargando ${generatedReports.length} PDF(s)...`,
      color: "blue",
      loading: true,
    });

    try {
      const zip = new JSZip();
      let downloadedCount = 0;
      let failedCount = 0;

      for (const report of generatedReports) {
        const pdfUrl = generatedPdfUrls[report.id];
        if (pdfUrl) {
          try {
            const response = await fetch(pdfUrl, { mode: "cors" });
            if (response.ok) {
              const blob = await response.blob();
              const fileName = report.address.site_name
                ? `${report.address.site_name}.pdf`
                : `${report.id}.pdf`;
              zip.file(fileName, blob);
              downloadedCount++;
            } else {
              failedCount++;
              console.warn(`Failed to fetch PDF for ${report.id}: ${response.status}`);
            }
          } catch (err) {
            failedCount++;
            console.error(`Error fetching PDF for ${report.id}:`, err);
          }
        }
      }

      if (downloadedCount === 0) {
        notifications.show({
          title: "Error",
          message: "No se pudieron descargar los PDFs. Verifica tu conexión.",
          color: "red",
        });
        setDownloadingZip(false);
        return;
      }

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pdfs_generados_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      notifications.show({
        title: "Descarga completa",
        message: `Se descargaron ${downloadedCount} PDF(s)${failedCount > 0 ? ` (${failedCount} fallidos)` : ""}.`,
        color: downloadedCount === generatedReports.length ? "green" : "yellow",
      });
    } catch (err) {
      console.error("Error generating zip:", err);
      notifications.show({
        title: "Error",
        message: "Ocurrió un error al generar el ZIP.",
        color: "red",
      });
    } finally {
      setDownloadingZip(false);
    }
  };

  const downloadPdf = async (report: Report, pdfUrl: string) => {
    try {
      const response = await fetch(pdfUrl, { mode: "cors" });
      if (!response.ok) throw new Error("Failed to fetch");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.address?.site_name || report.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading PDF:", err);
      notifications.show({ title: "Error", message: "No se pudo descargar el PDF.", color: "red" });
    }
  };

  const openRestoreModal = (report: Report) => {
    setReportToRestore(report);
    setRestoreModalOpen(true);
  };

  const handleRestore = async () => {
    if (!reportToRestore) return;

    setRestoring(true);
    try {
      await deleteGeneratedReport(reportToRestore.id);
      await updateReportStatus(reportToRestore, 'listo_para_generar');

      setGeneratedPdfUrls((prev) => {
        const next = { ...prev };
        delete next[reportToRestore.id];
        return next;
      });

      setReports((prev) =>
        prev.map((r) =>
          r.id === reportToRestore.id ? { ...r, status: 'listo_para_generar' as const } : r
        )
      );

      notifications.show({
        title: "Reporte restaurado",
        message: "El reporte ha vuelto a estado 'Listo para generar'.",
        color: "green",
      });
    } catch (err) {
      console.error("Error restoring report:", err);
      notifications.show({
        title: "Error",
        message: "No se pudo restaurar el reporte.",
        color: "red",
      });
    } finally {
      setRestoring(false);
      setRestoreModalOpen(false);
      setReportToRestore(null);
    }
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
                  <Group gap={4}>
                    <Tooltip label="Ver detalles">
                      <ActionIcon
                        variant="subtle"
                        color="blue"
                        onClick={() => location.route(`/reporte/${report.id}`)}
                      >
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    {report.status === "generado" && generatedPdfUrls[report.id] && (
                      <Tooltip label="Descargar PDF">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => downloadPdf(report, generatedPdfUrls[report.id])}
                        >
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {report.status === "generado" && isSuperadmin && (
                      <Tooltip label="Restaurar a Listo para Generar">
                        <ActionIcon
                          variant="subtle"
                          color="orange"
                          onClick={() => openRestoreModal(report)}
                        >
                          <IconRotateClockwise size={16} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
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
          {activeTab === "generado" && (
            <Button
              variant="light"
              color="orange"
              leftSection={<IconFileZip size={16} />}
              onClick={downloadPdfsZip}
              loading={downloadingZip}
              style={{ flex: "0 0 auto" }}
            >
              Descargar PDFs
            </Button>
          )}
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

        <Modal
          opened={restoreModalOpen}
          onClose={() => setRestoreModalOpen(false)}
          title="Restaurar Reporte"
          centered
        >
          <Text mb="lg">
            ¿Estás seguro de restaurar el reporte <b>{reportToRestore?.address?.site_name || reportToRestore?.id}</b> a estado "Listo para generar"?
          </Text>
          <Text size="sm" c="dimmed" mb="lg">
            Esto eliminará el PDF generado y el registro en Firestore. El reporte pasará a estado "Listo para generar" sin ser eliminado.
          </Text>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setRestoreModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="orange" onClick={handleRestore} loading={restoring}>
              Restaurar
            </Button>
          </Group>
        </Modal>
        </>
      )}
    </div>
  );
}
