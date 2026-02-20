import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import {
  Container,
  Title,
  Text,
  Button,
  Group,
  Alert,
  Stack,
  Box,
  ActionIcon,
  Tooltip,
  Drawer,
  UnstyledButton,
  ThemeIcon,
  Divider,
} from '@mantine/core';
import { IconDeviceFloppy, IconCheck, IconChevronDown, IconEye, IconLock, IconLockOpen } from '@tabler/icons-react';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import type { Report } from '../../types/Report';
import { useAuth } from '../../features/auth/AuthContext';
import { getReport, saveReport, saveReportLocally, updateReportStatus } from '../../services/reportsService';
import { uploadGeneratedPdf, createGeneratedReport, getGeneratedReportByReportId } from '../../services/generatedReportsService';
import { useConnectivity } from '../../hooks/useConnectivity';
import { ReportEditStep1 } from './ReportEditStep1';
import { ReportEditStep2 } from './ReportEditStep2';
import { ReportEditStep3 } from './ReportEditStep3';
import { ReportEditStep4 } from './ReportEditStep4';
import { ReportEditStep5 } from './ReportEditStep5';
import { ReportEditStep6 } from './ReportEditStep6';
import { ReportEditStep7 } from './ReportEditStep7';
import { PdfPreviewPanel } from './PdfPreviewPanel';
import './ReportEdit.css';

const STEP_LABELS = [
  'Información Geográfica Nodo',
  'Seguridad, contrato y observaciones',
  'Datos técnicos e infraestructura',
  'Diagrama y mapa',
  'Evidencia fotográfica',
  'Metrajes y civil',
  'Cierre y guardado',
];

export function ReportEdit() {
  const { params } = useRoute();
  const location = useLocation();
  const { userData } = useAuth();
  const id = params?.id;

  const isAdmin = userData?.role === 'admin';

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [stepperOpened, { open: openStepper, close: closeStepper }] = useDisclosure(false);
  const [showPreview, setShowPreview] = useState(false);
  const [adminEditOverride, setAdminEditOverride] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const isOnline = useConnectivity();

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReport(id)
      .then((r) => {
        if (!cancelled) {
          setReport(r);
          setError(r ? null : 'Reporte no encontrado');
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Error al cargar el reporte');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch the generated PDF URL for generado reports
  useEffect(() => {
    if (!report || report.status !== 'generado' || !isOnline) return;
    let cancelled = false;
    getGeneratedReportByReportId(report.id)
      .then((genReport) => {
        if (!cancelled && genReport) {
          setGeneratedPdfUrl(genReport.pdf_url);
        }
      })
      .catch((e) => console.warn('Failed to fetch generated report PDF URL:', e));
    return () => { cancelled = true; };
  }, [report?.id, report?.status, isOnline]);

  // --- Dirty tracking & debounced saves ---
  const isDirty = useRef(false);
  const isInitialLoad = useRef(true);
  const localSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const firestoreSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const reportRef = useRef<Report | null>(null);

  /** Wraps setReport so edits are tracked as dirty. */
  const updateReport: typeof setReport = (value) => {
    isDirty.current = true;
    setReport(value);
  };

  // Keep reportRef in sync for unmount flush
  useEffect(() => { reportRef.current = report; }, [report]);

  // Debounced auto-save: IndexedDB (1s) + Firestore (5s, only when dirty)
  useEffect(() => {
    if (!report) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    // Quick local save for offline safety
    clearTimeout(localSaveTimer.current);
    localSaveTimer.current = setTimeout(() => {
      saveReportLocally(report).catch(() => {});
    }, 1000);

    // Slower Firestore save to reduce network writes
    clearTimeout(firestoreSaveTimer.current);
    firestoreSaveTimer.current = setTimeout(() => {
      if (isDirty.current) {
        isDirty.current = false;
        saveReport(report).catch((e) =>
          console.error('Error al guardar reporte:', e)
        );
      }
    }, 5000);

    return () => {
      clearTimeout(localSaveTimer.current);
      clearTimeout(firestoreSaveTimer.current);
    };
  }, [report]);

  // Flush pending saves on unmount (navigating away from the page)
  useEffect(() => {
    return () => {
      clearTimeout(localSaveTimer.current);
      clearTimeout(firestoreSaveTimer.current);
      if (isDirty.current && reportRef.current) {
        saveReport(reportRef.current).catch(() => {});
      }
    };
  }, []);

  /** Flush pending saves immediately — only writes to Firestore if dirty. */
  const flushSave = (r: Report) => {
    clearTimeout(localSaveTimer.current);
    clearTimeout(firestoreSaveTimer.current);
    if (isDirty.current) {
      isDirty.current = false;
      saveReport(r).catch((e) =>
        console.error('Error al guardar reporte:', e)
      );
    }
  };

  const handleSave = async () => {
    if (!report) return;
    clearTimeout(localSaveTimer.current);
    clearTimeout(firestoreSaveTimer.current);
    isDirty.current = false;
    setSaving(true);
    setSaveMsg(null);
    try {
      await saveReport(report);
      setSaveMsg('Guardado correctamente');
      setTimeout(() => setSaveMsg(null), 3000);
    } catch (e) {
      setSaveMsg('Error al guardar');
      setTimeout(() => setSaveMsg(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (report) flushSave(report);
    setActiveStep((c) => (c < STEP_LABELS.length - 1 ? c + 1 : c));
  };
  const prevStep = () => {
    if (report) flushSave(report);
    setActiveStep((c) => (c > 0 ? c - 1 : c));
  };

  const handleSubmitForReview = async () => {
    if (!report || report.status !== 'en_campo') return;
    if (!confirm('¿Está seguro de enviar este reporte a revisión? Ya no podrá editarlo.')) return;

    const updated = await updateReportStatus(report, 'en_revision');
    setReport(updated);
    location.route(isAdmin ? '/' : '/mis-reportes');
  };

  const handleApprove = async () => {
    if (!report || report.status !== 'en_revision') return;
    if (!confirm('¿Marcar este reporte como listo para generar?')) return;

    const updated = await updateReportStatus(report, 'listo_para_generar');
    setReport(updated);
    location.route('/');
  };

  const handleGenerateFinal = async (signedPdfBytes: Uint8Array) => {
    if (!report || report.status !== 'listo_para_generar' || !isAdmin || !userData) return;

    const pdfUrl = await uploadGeneratedPdf(report.id, signedPdfBytes);
    await createGeneratedReport(report.id, pdfUrl, userData.uid);
    await updateReportStatus(report, 'generado');
    location.route('/reportes-finales');
  };

  // Admin can edit en_campo, en_revision, and listo_para_generar (with explicit toggle); workers can only edit en_campo
  const readOnly = isAdmin
    ? report?.status === 'generado' || (report?.status === 'listo_para_generar' && !adminEditOverride)
    : report?.status !== 'en_campo';

  // Show admin editing toggle only for admin + listo_para_generar
  const showAdminEditToggle = isAdmin && report?.status === 'listo_para_generar';

  const isMobile = useMediaQuery('(max-width: 48em)');

  if (!id) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="ID no especificado">
          No se proporcionó el identificador del reporte.{' '}
          <Button variant="subtle" size="xs" onClick={() => location.route('/mis-reportes')}>
            Volver a Mis Reportes
          </Button>
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container size="md" py="xl">
        <Text c="dimmed">Cargando reporte…</Text>
      </Container>
    );
  }

  if (error || !report) {
    return (
      <Container size="md" py="xl">
        <Alert color="red" title="Error">
          {error ?? 'Reporte no encontrado.'}{' '}
          <Button variant="subtle" size="xs" onClick={() => location.route('/mis-reportes')}>
            Volver a Mis Reportes
          </Button>
        </Alert>
      </Container>
    );
  }

  const handleStepClick = (step: number) => {
    if (report) flushSave(report);
    setActiveStep(step);
    setShowPreview(false);
  };

  const handleStepClickMobile = (step: number) => {
    handleStepClick(step);
    closeStepper();
  };

  const renderStepper = (onStepClick: (step: number) => void) => (
    <div className="vertical-stepper">
      {STEP_LABELS.map((label, i) => {
        const isCompleted = i < activeStep;
        const isActive = i === activeStep && !showPreview;
        return (
          <UnstyledButton
            key={i}
            onClick={() => onStepClick(i)}
            className={`stepper-item${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`}
          >
            <div className="stepper-indicator-col">
              <ThemeIcon
                size={42}
                radius="xl"
                variant={isCompleted || isActive ? 'filled' : 'light'}
                color={isCompleted ? 'teal' : isActive ? 'blue' : 'gray'}
              >
                {isCompleted ? (
                  <IconCheck size={20} />
                ) : (
                  <Text size="sm" fw={700} c={isActive ? 'white' : undefined}>
                    {i + 1}
                  </Text>
                )}
              </ThemeIcon>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="stepper-connector"
                  data-completed={isCompleted || undefined}
                />
              )}
            </div>
            <div className="stepper-label-col">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Paso {i + 1}
              </Text>
              <Text fw={isActive ? 700 : 500} size={isActive ? 'lg' : 'md'}>
                {label}
              </Text>
            </div>
          </UnstyledButton>
        );
      })}
    </div>
  );

  const renderStepContent = () => {
    const props = { report, setReport: updateReport, readOnly };
    switch (activeStep) {
      case 0: return <ReportEditStep1 {...props} />;
      case 1: return <ReportEditStep2 {...props} />;
      case 2: return <ReportEditStep3 {...props} />;
      case 3: return <ReportEditStep4 {...props} />;
      case 4: return <ReportEditStep5 {...props} />;
      case 5: return <ReportEditStep6 {...props} />;
      case 6: return <ReportEditStep7 {...props} />;
      default: return null;
    }
  };

  return (
    <>
      {/* Mobile stepper drawer */}
      {isMobile && (
        <Drawer
          opened={stepperOpened}
          onClose={closeStepper}
          position="bottom"
          size="100%"
          title={<Text fw={600} size="lg">Pasos del reporte</Text>}
        >
          <Box p="md">
            {renderStepper(handleStepClickMobile)}
            <Divider my="lg" />
            <UnstyledButton
              onClick={() => { setShowPreview(true); closeStepper(); }}
              className={`stepper-item${showPreview ? ' active' : ''}`}
            >
              <div className="stepper-indicator-col">
                <ThemeIcon
                  size={42}
                  radius="xl"
                  variant={showPreview ? 'filled' : 'light'}
                  color={showPreview ? 'violet' : 'gray'}
                >
                  <IconEye size={20} />
                </ThemeIcon>
              </div>
              <div className="stepper-label-col">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Documento
                </Text>
                <Text fw={showPreview ? 700 : 500} size={showPreview ? 'lg' : 'md'}>
                  Vista previa PDF
                </Text>
              </div>
            </UnstyledButton>
          </Box>
        </Drawer>
      )}

      <div className={isMobile ? undefined : 'report-edit-wrapper'}>
        {/* Desktop sidebar with vertical stepper */}
        {!isMobile && (
          <aside className="report-edit-sidebar">
            <Box mb="xl">
              <Text size="sm" c="dimmed" fw={500}>Editar reporte</Text>
              <Text size="xs" c="dimmed">ID: {report.id}</Text>
            </Box>
            {renderStepper(handleStepClick)}
            <Divider my="lg" />
            <UnstyledButton
              onClick={() => setShowPreview(true)}
              className={`stepper-item${showPreview ? ' active' : ''}`}
            >
              <div className="stepper-indicator-col">
                <ThemeIcon
                  size={42}
                  radius="xl"
                  variant={showPreview ? 'filled' : 'light'}
                  color={showPreview ? 'violet' : 'gray'}
                >
                  <IconEye size={20} />
                </ThemeIcon>
              </div>
              <div className="stepper-label-col">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Documento
                </Text>
                <Text fw={showPreview ? 700 : 500} size={showPreview ? 'lg' : 'md'}>
                  Vista previa PDF
                </Text>
              </div>
            </UnstyledButton>
          </aside>
        )}

        {/* Main content */}
        <div className={isMobile ? undefined : 'report-edit-main'}>
          <Container size="md" py="xl">
            <Stack gap="lg">
              {/* Mobile: title row with save button */}
              {isMobile && (
                <Group justify="space-between" align="center">
                  <Text size="sm" c="dimmed" fw={500}>
                    {showPreview ? 'Vista previa' : 'Editar reporte'}
                  </Text>
                  <Group gap="xs">
                    {showAdminEditToggle && !showPreview && (
                      <Tooltip label={adminEditOverride ? 'Deshabilitar edición' : 'Habilitar edición'} position="left">
                        <ActionIcon
                          variant="filled"
                          color={adminEditOverride ? 'yellow' : 'gray'}
                          size="xl"
                          radius="xl"
                          onClick={() => setAdminEditOverride((v) => !v)}
                        >
                          {adminEditOverride ? <IconLockOpen size={22} /> : <IconLock size={22} />}
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {!readOnly && !showPreview && (
                      <Tooltip label="Guardar" position="left">
                        <ActionIcon
                          variant="filled"
                          color="green"
                          size="xl"
                          radius="xl"
                          onClick={handleSave}
                          loading={saving}
                        >
                          <IconDeviceFloppy size={22} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              )}

              {/* Step title — tappable on mobile to open stepper menu */}
              {isMobile ? (
                showPreview ? (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                      Documento
                    </Text>
                    <Title order={3}>Vista previa PDF</Title>
                  </Box>
                ) : (
                  <UnstyledButton onClick={openStepper} className="step-title-btn">
                    <Group gap="xs" align="center" wrap="nowrap">
                      <ThemeIcon size={36} radius="xl" variant="light" color="blue">
                        <Text size="xs" fw={700}>{activeStep + 1}</Text>
                      </ThemeIcon>
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Paso {activeStep + 1} de {STEP_LABELS.length}
                        </Text>
                        <Title order={3}>{STEP_LABELS[activeStep]}</Title>
                      </Box>
                      <IconChevronDown size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Group>
                  </UnstyledButton>
                )
              ) : (
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                      {showPreview ? 'Documento' : `Paso ${activeStep + 1} de ${STEP_LABELS.length}`}
                    </Text>
                    <Title order={2}>{showPreview ? 'Vista previa PDF' : STEP_LABELS[activeStep]}</Title>
                  </Box>
                  <Group gap="sm">
                    {showAdminEditToggle && !showPreview && (
                      <Button
                        variant={adminEditOverride ? 'filled' : 'light'}
                        color={adminEditOverride ? 'yellow' : 'gray'}
                        leftSection={adminEditOverride ? <IconLockOpen size={18} /> : <IconLock size={18} />}
                        onClick={() => setAdminEditOverride((v) => !v)}
                        size="sm"
                      >
                        {adminEditOverride ? 'Deshabilitar edición' : 'Habilitar edición'}
                      </Button>
                    )}
                    {!readOnly && !showPreview && (
                      <Tooltip label="Guardar" position="left">
                        <ActionIcon
                          variant="filled"
                          color="green"
                          size="xl"
                          radius="xl"
                          onClick={handleSave}
                          loading={saving}
                        >
                          <IconDeviceFloppy size={22} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Group>
              )}

              {showPreview ? (
                <PdfPreviewPanel
                  report={report}
                  onBack={() => setShowPreview(false)}
                  isAdmin={isAdmin}
                  isOnline={isOnline}
                  onGenerate={handleGenerateFinal}
                  generatedPdfUrl={generatedPdfUrl}
                  onSendToReview={handleSubmitForReview}
                  onApprove={handleApprove}
                />
              ) : (
                <>
                  {/* Step content */}
                  <Box py="sm">
                    {renderStepContent()}
                  </Box>

                  {/* Navigation */}
                  <Group justify="space-between">
                    <Button variant="default" onClick={prevStep} disabled={activeStep === 0}>
                      ← Anterior
                    </Button>
                    <Button
                      onClick={nextStep}
                      disabled={activeStep === STEP_LABELS.length - 1}
                    >
                      Siguiente →
                    </Button>
                  </Group>

                  {saveMsg && (
                    <Alert color={saveMsg.includes('Error') ? 'red' : 'green'} variant="light">
                      {saveMsg}
                    </Alert>
                  )}
                </>
              )}
            </Stack>
          </Container>
        </div>
      </div>
    </>
  );
}
