import { useState, useEffect, useRef } from 'preact/hooks';
import {
  Box,
  Text,
  Button,
  Group,
  Stack,
  Paper,
  Loader,
  Alert,
  Modal,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDownload, IconRefresh, IconArrowLeft, IconFileExport, IconWifiOff, IconSend } from '@tabler/icons-react';
import type { Report, ReportStatus } from '../../types/Report';
import { generateReportPdf } from '../../utils/pdfGenerator';
import { validateReportForReview } from '../../utils/reportValidation';

interface PdfPreviewPanelProps {
  report: Report;
  onBack: () => void;
  /** Admin flag — controls visibility of "Generar Reporte Final" button */
  isAdmin?: boolean;
  /** Current online status */
  isOnline?: boolean;
  /** Called when admin confirms final generation */
  onGenerate?: () => Promise<void>;
  /** URL of the stored PDF for generado reports */
  generatedPdfUrl?: string | null;
  /** Called when user sends to review */
  onSendToReview?: () => Promise<void>;
}

export function PdfPreviewPanel({
  report,
  onBack,
  isAdmin = false,
  isOnline = true,
  onGenerate,
  generatedPdfUrl,
  onSendToReview,
}: PdfPreviewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);

  const validation = validateReportForReview(report);
  const isGenerado = report.status === 'generado';

  // --- Generado reports: use stored PDF URL ---
  useEffect(() => {
    if (isGenerado && generatedPdfUrl) {
      setPdfUrl(generatedPdfUrl);
      setLoading(false);
    }
  }, [isGenerado, generatedPdfUrl]);

  // --- Non-generado reports: generate PDF client-side ---
  async function doGenerate() {
    if (isGenerado) return;
    setLoading(true);
    setError(null);
    try {
      const pdf = await generateReportPdf(report);
      const blob = new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = url;
      setPdfUrl(url);
    } catch (e: any) {
      console.error('Error generating PDF:', e);
      setError(e?.message ?? 'Error al generar el PDF');
    } finally {
      setLoading(false);
    }
  }

  // Generate on mount (debounced) for non-generado reports
  useEffect(() => {
    if (isGenerado) return;

    let cancelled = false;
    setLoading(true);

    const timer = setTimeout(async () => {
      setError(null);
      try {
        const pdf = await generateReportPdf(report);
        if (cancelled) return;
        const blob = new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = url;
        setPdfUrl(url);
      } catch (e: any) {
        if (cancelled) return;
        console.error('Error generating PDF:', e);
        setError(e?.message ?? 'Error al generar el PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [report, isGenerado]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;

    if (isGenerado && generatedPdfUrl) {
      // For generado reports, open the Storage URL in a new tab (direct download)
      window.open(generatedPdfUrl, '_blank');
      return;
    }

    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `reporte_${report.address?.site_name || report.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleConfirmGenerate = async () => {
    if (!onGenerate) return;
    setGenerating(true);
    try {
      await onGenerate();
    } catch (e: any) {
      console.error('Error generating final report:', e);
      setError(e?.message ?? 'Error al generar el reporte final');
    } finally {
      setGenerating(false);
      closeConfirm();
    }
  };

  // Show "Generar Reporte Final" button only for admin + listo_para_generar
  const showGenerarButton = isAdmin && report.status === 'listo_para_generar' && onGenerate;

  // For generado reports offline: show alert instead of PDF
  if (isGenerado && !isOnline) {
    return (
      <Stack gap="md">
        <Group justify="space-between" align="center" wrap="wrap">
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={onBack}
            size="sm"
          >
            Volver
          </Button>
        </Group>

        <Alert color="orange" variant="light" title="Sin conexión" icon={<IconWifiOff size={20} />}>
          El PDF generado requiere conexión a internet para visualizarse.
          Conéctese a internet e intente de nuevo.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      {/* Confirmation modal */}
      <Modal
        opened={confirmOpened}
        onClose={closeConfirm}
        title={<Text fw={700} size="lg">Generar reporte final</Text>}
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Una vez generado, este reporte quedará fijo y no podrá ser editado ni duplicado.
            Esta acción es irreversible y solo puede ser realizada por un administrador.
          </Text>
          <Text size="sm" fw={600}>
            ¿Desea continuar?
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={closeConfirm} disabled={generating}>
              Cancelar
            </Button>
            <Button color="teal" onClick={handleConfirmGenerate} loading={generating}>
              Generar
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Group justify="space-between" align="center" wrap="wrap">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
          size="sm"
        >
          {isGenerado ? 'Volver' : 'Volver a editar'}
        </Button>
        <Group gap="sm">
          {/* Non-generado: Regenerar + Descargar */}
          {!isGenerado && (
            <>
              <Button
                variant="light"
                leftSection={<IconRefresh size={16} />}
                onClick={doGenerate}
                loading={loading}
                size="sm"
              >
                Regenerar
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={handleDownload}
                disabled={!pdfUrl || loading}
                size="sm"
              >
                Descargar PDF
              </Button>
            </>
          )}

          {/* Generado: only Descargar when online */}
          {isGenerado && isOnline && (
            <Button
              leftSection={<IconDownload size={16} />}
              onClick={handleDownload}
              disabled={!pdfUrl}
              size="sm"
            >
              Descargar PDF
            </Button>
          )}

          {/* Generar Reporte Final button */}
          {showGenerarButton && (
            <Button
              color="teal"
              leftSection={<IconFileExport size={16} />}
              onClick={openConfirm}
              disabled={!pdfUrl || loading}
              size="sm"
            >
              Generar Reporte Final
            </Button>
          )}

          {/* Enviar a Revisión button */}
          {report.status === 'en_campo' && onSendToReview && (
            <Tooltip
              label={
                validation.isValid
                  ? 'Enviar a revisión'
                  : `Faltan campos:\n${validation.missingFields.join('\n')}`
              }
              multiline
              color={validation.isValid ? 'black' : 'red'}
              position="bottom"
              withArrow
            >
              {/* Wrapper needed to show tooltip on disabled button */}
              <div style={{ display: 'inline-block' }}>
                <Button
                  color="orange"
                  leftSection={<IconSend size={16} />}
                  onClick={onSendToReview}
                  disabled={loading || !validation.isValid}
                  size="sm"
                  style={{ pointerEvents: validation.isValid ? 'auto' : 'none' }}
                >
                  Enviar a Revisión
                </Button>
              </div>
            </Tooltip>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" variant="light" title="Error de generación">
          {error}
        </Alert>
      )}

      <Paper
        shadow="sm"
        radius="md"
        style={{ overflow: 'hidden', position: 'relative', minHeight: 600 }}
      >
        {loading && !pdfUrl ? (
          <Box
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 600,
            }}
          >
            <Stack align="center" gap="sm">
              <Loader size="lg" />
              <Text c="dimmed" size="sm">
                {isGenerado ? 'Cargando PDF…' : 'Generando PDF…'}
              </Text>
            </Stack>
          </Box>
        ) : pdfUrl ? (
          <>
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=0`}
              style={{
                width: '100%',
                height: '80vh',
                minHeight: 600,
                border: 'none',
              }}
              title="Vista previa del reporte PDF"
            />
            {loading && (
              <Box
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  background: 'rgba(255,255,255,0.9)',
                  borderRadius: 8,
                  padding: '4px 12px',
                }}
              >
                <Group gap="xs">
                  <Loader size="xs" />
                  <Text size="xs" c="dimmed">
                    Actualizando…
                  </Text>
                </Group>
              </Box>
            )}
          </>
        ) : null}
      </Paper>
    </Stack>
  );
}
