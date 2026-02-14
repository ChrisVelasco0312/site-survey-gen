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
} from '@mantine/core';
import { IconDownload, IconRefresh, IconArrowLeft } from '@tabler/icons-react';
import type { Report } from '../../types/Report';
import { generateReportPdf } from '../../utils/pdfGenerator';

interface PdfPreviewPanelProps {
  report: Report;
  onBack: () => void;
}

export function PdfPreviewPanel({ report, onBack }: PdfPreviewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  async function doGenerate() {
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

  // Generate on mount, and re-generate (debounced) when report changes
  useEffect(() => {
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
  }, [report]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `reporte_${report.address?.site_name || report.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center" wrap="wrap">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={onBack}
          size="sm"
        >
          Volver a editar
        </Button>
        <Group gap="sm">
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
                Generando PDF…
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
