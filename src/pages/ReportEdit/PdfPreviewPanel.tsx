import { useState, useEffect, useRef, useMemo } from 'preact/hooks';
import {
  ActionIcon,
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
  FileInput,
  Image,
  SimpleGrid,
  Textarea,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconDownload, IconRefresh, IconArrowLeft, IconFileExport, IconWifiOff, IconSend, IconCheck, IconUpload, IconSignature, IconTrash, IconDeviceFloppy } from '@tabler/icons-react';
import type { Report } from '../../types/Report';
import { generateReportPdf, buildPdfInputs, TRANSPARENT_1PX, type SignatureImages } from '../../utils/pdfGenerator';
import { uploadSignatureImage, deleteSignatureImage } from '../../utils/reportImagesStorage';
import { validateReportForReview } from '../../utils/reportValidation';
import { MantineStorageImage } from '../../components/StorageImage/StorageImage';

interface PdfPreviewPanelProps {
  report: Report;
  onBack: () => void;
  /** Admin flag — controls visibility of "Generar Reporte Final" button */
  isAdmin?: boolean;
  /** Current online status */
  isOnline?: boolean;
  /** Called when admin confirms final generation — receives the signed PDF bytes */
  onGenerate?: (signedPdfBytes: Uint8Array) => Promise<void>;
  /** URL of the stored PDF for generado reports */
  generatedPdfUrl?: string | null;
  /** Called when user sends to review */
  onSendToReview?: () => Promise<void>;
  /** Called when admin approves report (en_revision → listo_para_generar) */
  onApprove?: () => Promise<void>;
  /** Whether the user can upload signature images directly */
  canUploadSignatures?: boolean;
  /** Whether the current user is the interventoría user and can upload their own signature + observation */
  canInterventoriaSignature?: boolean;
  /** Called after saving signature images to persist changes to the report */
  onUpdateReport?: (updated: Report) => void;
  /** Global status transition lock from ReportEdit */
  statusActionInProgress?: boolean;
}

export function PdfPreviewPanel({
  report,
  onBack,
  isAdmin = false,
  isOnline = true,
  onGenerate,
  generatedPdfUrl,
  onSendToReview,
  onApprove,
  canUploadSignatures = false,
  canInterventoriaSignature = false,
  onUpdateReport,
  statusActionInProgress = false,
}: PdfPreviewPanelProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const blobUrlRef = useRef<string | null>(null);
  const signedBlobUrlRef = useRef<string | null>(null);
  const [confirmOpened, { open: openConfirm, close: closeConfirm }] = useDisclosure(false);
  const [signedPdfBytes, setSignedPdfBytes] = useState<Uint8Array | null>(null);
  const [signedPdfUrl, setSignedPdfUrl] = useState<string | null>(null);
  // Signature images: display value (base64 for unsaved uploads, Storage URL for saved)
  const [sigImgProj, setSigImgProj] = useState<string | null>(
    report.signature_img_director_url ?? null,
  );
  const [sigImgCoord, setSigImgCoord] = useState<string | null>(
    report.signature_img_coordinator_url ?? null,
  );
  // File objects for pending uploads (null when image comes from report)
  const [sigFileProj, setSigFileProj] = useState<File | null>(null);
  const [sigFileCoord, setSigFileCoord] = useState<File | null>(null);
  const [sigDirty, setSigDirty] = useState(false);
  const [sigSaving, setSigSaving] = useState(false);

  // Interventoría signature & observation
  const [sigImgInterventoria, setSigImgInterventoria] = useState<string | null>(
    report.signature_img_interventoria_url ?? null,
  );
  const [sigFileInterventoria, setSigFileInterventoria] = useState<File | null>(null);
  const [interventoriaObs, setInterventoriaObs] = useState<string>(
    report.interventoria_observation ?? '',
  );
  const [sigDirtyInterventoria, setSigDirtyInterventoria] = useState(false);
  const [sigSavingInterventoria, setSigSavingInterventoria] = useState(false);

  const validation = validateReportForReview(report);
  const isGenerado = report.status === 'generado';
  const isListoParaGenerar = report.status === 'listo_para_generar';

  // Sync signature state when report URLs change externally
  useEffect(() => {
    if (!sigDirty) {
      setSigImgProj(report.signature_img_director_url ?? null);
      setSigImgCoord(report.signature_img_coordinator_url ?? null);
    }
  }, [report.signature_img_director_url, report.signature_img_coordinator_url]);

  useEffect(() => {
    if (!sigDirtyInterventoria) {
      setSigImgInterventoria(report.signature_img_interventoria_url ?? null);
      setInterventoriaObs(report.interventoria_observation ?? '');
    }
  }, [report.signature_img_interventoria_url, report.interventoria_observation]);

  // --- Generado reports: use stored PDF URL ---
  useEffect(() => {
    if (isGenerado && generatedPdfUrl) {
      setPdfUrl(generatedPdfUrl);
      setLoading(false);
    }
  }, [isGenerado, generatedPdfUrl]);

  // Stable fingerprint of PDF-relevant fields only; avoids regenerating
  // the PDF preview when unrelated report fields change.
  const pdfInputsKey = useMemo(
    () => JSON.stringify(buildPdfInputs(report)),
    [report],
  );

  const buildSigImages = (): SignatureImages | undefined => {
    const hasSig = (canUploadSignatures && isListoParaGenerar) || canInterventoriaSignature;
    if (!hasSig) return undefined;
    return {
      directorProyectos: (canUploadSignatures && isListoParaGenerar) ? (sigImgProj || TRANSPARENT_1PX) : undefined,
      coordinadorZona: (canUploadSignatures && isListoParaGenerar) ? (sigImgCoord || TRANSPARENT_1PX) : undefined,
      interventoria: canInterventoriaSignature ? (sigImgInterventoria || TRANSPARENT_1PX) : undefined,
    };
  };

  // --- Non-generado reports: generate PDF client-side ---
  async function doGenerate() {
    if (isGenerado) return;
    setLoading(true);
    setError(null);
    try {
      const pdf = await generateReportPdf(report, buildSigImages());
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

  const reportRef = useRef(report);
  reportRef.current = report;

  // Generate on mount (debounced) for non-generado reports;
  // also regenerates when signature images change.
  // Uses pdfInputsKey instead of the full report object so unrelated
  // field changes (e.g. text edits) don't trigger expensive PDF rebuilds.
  useEffect(() => {
    if (isGenerado) return;

    let cancelled = false;
    setLoading(true);

    const sigImages: SignatureImages | undefined =
      (canUploadSignatures && isListoParaGenerar) || canInterventoriaSignature
        ? {
            directorProyectos: (canUploadSignatures && isListoParaGenerar) ? (sigImgProj || TRANSPARENT_1PX) : undefined,
            coordinadorZona: (canUploadSignatures && isListoParaGenerar) ? (sigImgCoord || TRANSPARENT_1PX) : undefined,
            interventoria: canInterventoriaSignature ? (sigImgInterventoria || TRANSPARENT_1PX) : undefined,
          }
        : undefined;

    const timer = setTimeout(async () => {
      setError(null);
      try {
        const pdf = await generateReportPdf(reportRef.current, sigImages);
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
  }, [pdfInputsKey, isGenerado, sigImgProj, sigImgCoord, sigImgInterventoria]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      if (signedBlobUrlRef.current) URL.revokeObjectURL(signedBlobUrlRef.current);
    };
  }, []);

  const handleSignedPdfUpload = (file: File | null) => {
    if (!file) {
      setSignedPdfBytes(null);
      if (signedBlobUrlRef.current) URL.revokeObjectURL(signedBlobUrlRef.current);
      signedBlobUrlRef.current = null;
      setSignedPdfUrl(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const bytes = new Uint8Array(reader.result as ArrayBuffer);
      setSignedPdfBytes(bytes);
      if (signedBlobUrlRef.current) URL.revokeObjectURL(signedBlobUrlRef.current);
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      signedBlobUrlRef.current = url;
      setSignedPdfUrl(url);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleSignatureImageUpload = (
    file: File | null,
    type: 'proj' | 'coord',
  ) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (type === 'proj') {
        setSigImgProj(base64);
        setSigFileProj(file);
      } else {
        setSigImgCoord(base64);
        setSigFileCoord(file);
      }
      setSigDirty(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = (type: 'proj' | 'coord') => {
    if (type === 'proj') {
      setSigImgProj(null);
      setSigFileProj(null);
    } else {
      setSigImgCoord(null);
      setSigFileCoord(null);
    }
    setSigDirty(true);
  };

  const handleInterventoriaImageUpload = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setSigImgInterventoria(reader.result as string);
      setSigFileInterventoria(file);
      setSigDirtyInterventoria(true);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveInterventoriaSignature = () => {
    setSigImgInterventoria(null);
    setSigFileInterventoria(null);
    setSigDirtyInterventoria(true);
  };

  const handleSaveInterventoria = async () => {
    if (!onUpdateReport) return;
    setSigSavingInterventoria(true);
    try {
      const updated = { ...report };

      if (sigFileInterventoria) {
        const url = await uploadSignatureImage(report.id, 'interventoria', sigFileInterventoria);
        updated.signature_img_interventoria_url = url;
        setSigFileInterventoria(null);
        setSigImgInterventoria(url);
      } else if (!sigImgInterventoria && report.signature_img_interventoria_url) {
        await deleteSignatureImage(report.id, 'interventoria');
        updated.signature_img_interventoria_url = '';
      }

      updated.interventoria_observation = interventoriaObs;
      updated.updated_at = Date.now();
      onUpdateReport(updated);
      setSigDirtyInterventoria(false);
    } catch (e: any) {
      console.error('Error saving interventoría data:', e);
      setError(e?.message ?? 'Error al guardar la firma de interventoría');
    } finally {
      setSigSavingInterventoria(false);
    }
  };

  const handleSaveSignatures = async () => {
    if (!onUpdateReport) return;
    setSigSaving(true);
    try {
      const updated = { ...report };

      // Director de Proyectos
      if (sigFileProj) {
        const url = await uploadSignatureImage(report.id, 'director', sigFileProj);
        updated.signature_img_director_url = url;
        setSigFileProj(null);
        setSigImgProj(url);
      } else if (!sigImgProj && report.signature_img_director_url) {
        await deleteSignatureImage(report.id, 'director');
        updated.signature_img_director_url = '';
      }

      // Coordinador de zona
      if (sigFileCoord) {
        const url = await uploadSignatureImage(report.id, 'coordinator', sigFileCoord);
        updated.signature_img_coordinator_url = url;
        setSigFileCoord(null);
        setSigImgCoord(url);
      } else if (!sigImgCoord && report.signature_img_coordinator_url) {
        await deleteSignatureImage(report.id, 'coordinator');
        updated.signature_img_coordinator_url = '';
      }

      updated.updated_at = Date.now();
      onUpdateReport(updated);
      setSigDirty(false);
    } catch (e: any) {
      console.error('Error saving signatures:', e);
      setError(e?.message ?? 'Error al guardar las firmas');
    } finally {
      setSigSaving(false);
    }
  };

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
    if (statusActionInProgress) return;
    if (!onGenerate || !signedPdfBytes) return;
    setGenerating(true);
    try {
      await onGenerate(signedPdfBytes);
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

  // When a signed PDF is uploaded, preview it instead of the generated one
  const displayPdfUrl = (isListoParaGenerar && signedPdfUrl) ? signedPdfUrl : pdfUrl;

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
          disabled={statusActionInProgress}
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
                disabled={statusActionInProgress}
              >
                Regenerar
              </Button>
              <Button
                leftSection={<IconDownload size={16} />}
                onClick={handleDownload}
                disabled={!pdfUrl || loading || statusActionInProgress}
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
              disabled={!pdfUrl || statusActionInProgress}
              size="sm"
            >
              Descargar PDF
            </Button>
          )}

          {/* Generar Reporte Final button — requires signed PDF */}
          {showGenerarButton && (
            <Button
              color="teal"
              leftSection={<IconFileExport size={16} />}
              onClick={openConfirm}
              disabled={!signedPdfBytes || loading || statusActionInProgress}
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
                  disabled={loading || !validation.isValid || statusActionInProgress}
                  size="sm"
                  style={{ pointerEvents: validation.isValid ? 'auto' : 'none' }}
                >
                  Enviar a Revisión
                </Button>
              </div>
            </Tooltip>
          )}

          {/* Marcar como Listo para generar (admin approval) */}
          {report.status === 'en_revision' && onApprove && (
            <Button
              color="teal"
              leftSection={<IconCheck size={16} />}
              onClick={onApprove}
              disabled={loading || statusActionInProgress}
              size="sm"
            >
              Marcar como Listo para generar
            </Button>
          )}
        </Group>
      </Group>

      {error && (
        <Alert color="red" variant="light" title="Error de generación">
          {error}
        </Alert>
      )}

      {/* Signature image uploads for listo_para_generar */}
      {isListoParaGenerar && canUploadSignatures && (
        <Alert color="violet" variant="light" title="Subir firmas" icon={<IconSignature size={20} />}>
          <Stack gap="sm" mt="xs">
            <Text size="sm">
              Suba las imágenes de firma para que se incrusten automáticamente en el PDF.
            </Text>
            <SimpleGrid cols={2}>
              <Stack gap="xs">
                <Text size="xs" fw={600}>Firma Director de Proyectos</Text>
                {sigImgProj ? (
                  <Box pos="relative">
                    <MantineStorageImage src={sigImgProj} alt="Firma Director" mah={80} fit="contain" />
                    <ActionIcon
                      color="red"
                      variant="filled"
                      size="sm"
                      radius="xl"
                      pos="absolute"
                      top={4}
                      right={4}
                      onClick={() => handleRemoveSignature('proj')}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Box>
                ) : (
                  <FileInput
                    placeholder="Seleccionar imagen"
                    accept="image/png,image/jpeg,image/webp"
                    leftSection={<IconUpload size={16} />}
                    onChange={(f) => handleSignatureImageUpload(f, 'proj')}
                    size="xs"
                  />
                )}
              </Stack>
              <Stack gap="xs">
                <Text size="xs" fw={600}>Firma Coordinador de zona</Text>
                {sigImgCoord ? (
                  <Box pos="relative">
                    <MantineStorageImage src={sigImgCoord} alt="Firma Coordinador" mah={80} fit="contain" />
                    <ActionIcon
                      color="red"
                      variant="filled"
                      size="sm"
                      radius="xl"
                      pos="absolute"
                      top={4}
                      right={4}
                      onClick={() => handleRemoveSignature('coord')}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Box>
                ) : (
                  <FileInput
                    placeholder="Seleccionar imagen"
                    accept="image/png,image/jpeg,image/webp"
                    leftSection={<IconUpload size={16} />}
                    onChange={(f) => handleSignatureImageUpload(f, 'coord')}
                    size="xs"
                  />
                )}
              </Stack>
            </SimpleGrid>
            <Group justify="flex-end" gap="sm" mt="xs">
              {sigDirty && (
                <Text size="xs" c="orange" fw={500}>● Cambios sin guardar</Text>
              )}
              <Button
                size="xs"
                leftSection={<IconDeviceFloppy size={16} />}
                onClick={handleSaveSignatures}
                loading={sigSaving}
                disabled={!sigDirty}
              >
                Guardar firmas
              </Button>
            </Group>
          </Stack>
        </Alert>
      )}

      {/* Interventoría section — editable for canInterventoriaSignature users, read-only for everyone else */}
      {!isGenerado && (canInterventoriaSignature || !!report.interventoria_observation) && (
        <Alert color="indigo" variant="light" title="Firma Interventoría" icon={<IconSignature size={20} />}>
          <Stack gap="sm" mt="xs">
            {canInterventoriaSignature && (
              <>
                <Text size="sm">
                  Suba la imagen de firma de interventoría. La observación solo quedará registrada en el reporte.
                </Text>
                <Stack gap="xs">
                  <Text size="xs" fw={600}>Firma Interventoría</Text>
                  {sigImgInterventoria ? (
                    <Box pos="relative" maw={200}>
                      <MantineStorageImage src={sigImgInterventoria} alt="Firma Interventoría" mah={80} fit="contain" />
                      <ActionIcon
                        color="red"
                        variant="filled"
                        size="sm"
                        radius="xl"
                        pos="absolute"
                        top={4}
                        right={4}
                        onClick={handleRemoveInterventoriaSignature}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Box>
                  ) : (
                    <FileInput
                      placeholder="Seleccionar imagen"
                      accept="image/png,image/jpeg,image/webp"
                      leftSection={<IconUpload size={16} />}
                      onChange={handleInterventoriaImageUpload}
                      size="xs"
                      style={{ maxWidth: 260 }}
                    />
                  )}
                </Stack>
                <Textarea
                  label={<Text size="xs" fw={600}>Observación Interventoría</Text>}
                  placeholder="Escribe aquí la observación de interventoría…"
                  value={interventoriaObs}
                  onChange={(e) => {
                    setInterventoriaObs(e.currentTarget.value);
                    setSigDirtyInterventoria(true);
                  }}
                  autosize
                  minRows={3}
                  size="xs"
                />
                <Group justify="flex-end" gap="sm" mt="xs">
                  {sigDirtyInterventoria && (
                    <Text size="xs" c="orange" fw={500}>● Cambios sin guardar</Text>
                  )}
                  <Button
                    size="xs"
                    leftSection={<IconDeviceFloppy size={16} />}
                    onClick={handleSaveInterventoria}
                    loading={sigSavingInterventoria}
                    disabled={!sigDirtyInterventoria}
                  >
                    Guardar interventoría
                  </Button>
                </Group>
              </>
            )}

            {/* Read-only observation visible to all other users when a value exists */}
            {!canInterventoriaSignature && report.interventoria_observation && (
              <Stack gap="xs">
                <Text size="xs" fw={600}>Observación Interventoría</Text>
                <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                  {report.interventoria_observation}
                </Text>
              </Stack>
            )}
          </Stack>
        </Alert>
      )}

      {/* Signed PDF upload for listo_para_generar */}
      {isListoParaGenerar && isAdmin && (
        <Alert color="blue" variant="light" title="PDF firmado requerido" icon={<IconUpload size={20} />}>
          <Stack gap="sm" mt="xs">
            <Text size="sm">
              Descargue el PDF, obtenga las firmas necesarias y vuelva a subir el documento firmado para generar el reporte final.
            </Text>
            <FileInput
              placeholder="Seleccione el PDF firmado"
              accept="application/pdf"
              leftSection={<IconUpload size={16} />}
              onChange={handleSignedPdfUpload}
            />
          </Stack>
        </Alert>
      )}

      <Paper
        shadow="sm"
        radius="md"
        style={{ overflow: 'hidden', position: 'relative', minHeight: 600 }}
      >
        {loading && !displayPdfUrl ? (
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
        ) : displayPdfUrl ? (
          <>
            <iframe
              src={`${displayPdfUrl}#toolbar=1&navpanes=0`}
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
