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
  Modal,
  Loader,
} from '@mantine/core';
import { IconDeviceFloppy, IconCheck, IconChevronDown, IconEye, IconLock, IconLockOpen, IconCloudUpload, IconClockHour4 } from '@tabler/icons-react';
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
import { ReportEditCotejoFacial } from './ReportEditCotejoFacial';
import { ReportEditLpr } from './ReportEditLpr';
import { PdfPreviewPanel } from './PdfPreviewPanel';
import { ALLOWED_SIGNATURE_UPLOAD_UIDS, INTERVENTORIA_UIDS } from '../../constants/reportEditAccess';
import './ReportEdit.css';

const BASE_STEP_LABELS = [
  'Información Geográfica Nodo',
  'Site Survey (datos)',
  'Site Survey (Diagrama del Sitio)',
  'Evidencia fotográfica',
  'Cableado y Adecuaciones Físicas',
  'Cierre y guardado',
];

export function ReportEdit() {
  const { params } = useRoute();
  const location = useLocation();
  const { userData } = useAuth();
  const id = params?.id;

  const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';

  const isProd = import.meta.env.VITE_FIREBASE_PROJECT_ID === 'gen-site-survey-prod';

  const canUploadSignatures = (() => {
    if (!userData) return false;
    if (userData.role === 'superadmin') return true;
    if (isProd) {
      return ALLOWED_SIGNATURE_UPLOAD_UIDS.includes(userData.uid);
    }
    return false;
  })();

  const canInterventoriaSignature = (() => {
    if (!userData) return false;
    if (userData.role === 'superadmin') return true;
    if (isProd) return INTERVENTORIA_UIDS.includes(userData?.uid);
    return false;
  })();

  // The interventoría user cannot generate the final report
  const isInterventoriaUser = isProd && INTERVENTORIA_UIDS.includes(userData?.uid);

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [syncState, setSyncState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [stepperOpened, { open: openStepper, close: closeStepper }] = useDisclosure(false);
  const [showPreview, setShowPreview] = useState(false);
  const [adminEditOverride, setAdminEditOverride] = useState(false);
  const [generatedPdfUrl, setGeneratedPdfUrl] = useState<string | null>(null);
  const [statusProcess, setStatusProcess] = useState<{
    phase: 'idle' | 'processing' | 'success' | 'error';
    message: string;
    redirectTo?: string;
  }>({
    phase: 'idle',
    message: '',
  });
  const isOnline = useConnectivity();

  const isCotejoFacial = report?.address?.site_type === 'cotejo_facial';
  const isLpr = report?.address?.site_type === 'lpr';
  const stepLabels = [...BASE_STEP_LABELS];
  if (isCotejoFacial) {
    stepLabels.splice(2, 0, 'Site Survey (Cotejo Facial)');
  } else if (isLpr) {
    stepLabels.splice(2, 0, 'Site Survey (LPR)');
  }

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
  const syncStateTimer = useRef<ReturnType<typeof setTimeout>>();
  const reportRef = useRef<Report | null>(null);

  const setTransientSyncState = (
    state: 'saved' | 'error',
    timeoutMs: number,
  ) => {
    clearTimeout(syncStateTimer.current);
    setSyncState(state);
    syncStateTimer.current = setTimeout(() => setSyncState('idle'), timeoutMs);
  };

  /** Wraps setReport so edits are tracked as dirty. */
  const updateReport: typeof setReport = (value) => {
    isDirty.current = true;
    clearTimeout(syncStateTimer.current);
    setSyncState('pending');
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
        clearTimeout(syncStateTimer.current);
        setSyncState('saving');
        saveReport(report)
          .then(() => setTransientSyncState('saved', 2500))
          .catch((e) => {
            console.error('Error al guardar reporte:', e);
            setTransientSyncState('error', 5000);
          });
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
      clearTimeout(syncStateTimer.current);
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
      clearTimeout(syncStateTimer.current);
      setSyncState('saving');
      saveReport(r)
        .then(() => setTransientSyncState('saved', 2500))
        .catch((e) => {
          console.error('Error al guardar reporte:', e);
          setTransientSyncState('error', 5000);
        });
    }
  };

  const handleSave = async () => {
    if (!report || saving || syncState === 'saving') return;
    clearTimeout(localSaveTimer.current);
    clearTimeout(firestoreSaveTimer.current);
    isDirty.current = false;
    setSaving(true);
    clearTimeout(syncStateTimer.current);
    setSyncState('saving');
    try {
      await saveReport(report);
      setTransientSyncState('saved', 3000);
    } catch (e) {
      setTransientSyncState('error', 5000);
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => {
    if (saving || syncState === 'saving') return;
    if (isDirty.current && report) {
      flushSave(report);
      return;
    }
    setActiveStep((c) => (c < stepLabels.length - 1 ? c + 1 : c));
  };
  const prevStep = () => {
    if (saving || syncState === 'saving') return;
    if (isDirty.current && report) {
      flushSave(report);
      return;
    }
    setActiveStep((c) => (c > 0 ? c - 1 : c));
  };

  const openPreview = () => {
    if (saving || syncState === 'saving') return;
    if (isDirty.current && report) {
      flushSave(report);
      return;
    }
    setShowPreview(true);
  };

  const handleSubmitForReview = async () => {
    if (saving || syncState === 'saving' || statusProcess.phase === 'processing') return;
    if (!report || report.status !== 'en_campo') return;
    setStatusProcess({
      phase: 'processing',
      message: 'Enviando el reporte a revisión. Por favor espere…',
    });
    try {
      const updated = await updateReportStatus(report, 'en_revision');
      setReport(updated);
      setStatusProcess({
        phase: 'success',
        message: 'El reporte fue enviado a revisión correctamente.',
        redirectTo: isAdmin ? '/' : '/mis-reportes',
      });
    } catch (e: any) {
      setStatusProcess({
        phase: 'error',
        message: e?.message ?? 'No fue posible enviar el reporte a revisión. Intente nuevamente.',
      });
    }
  };

  const handleApprove = async () => {
    if (saving || syncState === 'saving' || statusProcess.phase === 'processing') return;
    if (!report || report.status !== 'en_revision') return;
    setStatusProcess({
      phase: 'processing',
      message: 'Actualizando el estado del reporte a listo para generar. Por favor espere…',
    });
    try {
      const updated = await updateReportStatus(report, 'listo_para_generar');
      setReport(updated);
      setStatusProcess({
        phase: 'success',
        message: 'El reporte quedó marcado como listo para generar.',
        redirectTo: '/',
      });
    } catch (e: any) {
      setStatusProcess({
        phase: 'error',
        message: e?.message ?? 'No fue posible actualizar el estado del reporte. Intente nuevamente.',
      });
    }
  };

  const handleGenerateFinal = async (signedPdfBytes: Uint8Array) => {
    if (saving || syncState === 'saving' || statusProcess.phase === 'processing') return;
    if (!report || report.status !== 'listo_para_generar' || !isAdmin || !userData) return;
    try {
      setStatusProcess({
        phase: 'processing',
        message: 'Subiendo el PDF firmado. Por favor espere…',
      });
      const pdfUrl = await uploadGeneratedPdf(report.id, signedPdfBytes);
      setStatusProcess({
        phase: 'processing',
        message: 'Registrando el reporte final generado…',
      });
      await createGeneratedReport(report.id, pdfUrl, userData.uid);
      setStatusProcess({
        phase: 'processing',
        message: 'Actualizando el estado del reporte a generado…',
      });
      await updateReportStatus(report, 'generado');
      setStatusProcess({
        phase: 'success',
        message: 'El reporte final se generó correctamente.',
        redirectTo: '/',
      });
    } catch (e: any) {
      setStatusProcess({
        phase: 'error',
        message: e?.message ?? 'No fue posible generar el reporte final. Intente nuevamente.',
      });
    }
  };

  /** Called by PdfPreviewPanel after saving signature images to Storage. */
  const handleUpdateReport = (updated: Report) => {
    isDirty.current = true;
    clearTimeout(syncStateTimer.current);
    setSyncState('saving');
    setReport(updated);
    saveReport(updated)
      .then(() => setTransientSyncState('saved', 2500))
      .catch((e) => {
        console.error('Error al guardar reporte:', e);
        setTransientSyncState('error', 5000);
      });
  };

  // Admin can edit en_campo, en_revision, and listo_para_generar (with explicit toggle); workers can only edit en_campo
  const readOnly = userData?.role === 'read_only' || (isAdmin
    ? report?.status === 'generado' || (report?.status === 'listo_para_generar' && !adminEditOverride)
    : report?.status !== 'en_campo');

  // Show admin editing toggle only for admin + listo_para_generar
  const showAdminEditToggle = isAdmin && report?.status === 'listo_para_generar' && userData?.role !== 'read_only';

  const isMobile = useMediaQuery('(max-width: 48em)');
  const isSaveInProgress = saving || syncState === 'saving';
  const isStatusProcessRunning = statusProcess.phase === 'processing';
  const isInteractionBlocked = isSaveInProgress || isStatusProcessRunning;

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
    if (isInteractionBlocked) return;
    if (isDirty.current && report) {
      flushSave(report);
      return;
    }
    setActiveStep(step);
    setShowPreview(false);
  };

  const handleStepClickMobile = (step: number) => {
    handleStepClick(step);
    closeStepper();
  };

  const renderStepper = (onStepClick: (step: number) => void) => (
    <div className="vertical-stepper">
      {stepLabels.map((label, i) => {
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
              {i < stepLabels.length - 1 && (
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
    if (isCotejoFacial) {
      switch (activeStep) {
        case 0: return <ReportEditStep1 {...props} />;
        case 1: return <ReportEditStep2 {...props} />;
        case 2: return <ReportEditCotejoFacial {...props} />;
        case 3: return <ReportEditStep3 {...props} />;
        case 4: return <ReportEditStep4 {...props} saveState={syncState} />;
        case 5: return <ReportEditStep5 {...props} />;
        case 6: return <ReportEditStep6 {...props} />;
        default: return null;
      }
    } else if (isLpr) {
      switch (activeStep) {
        case 0: return <ReportEditStep1 {...props} />;
        case 1: return <ReportEditStep2 {...props} />;
        case 2: return <ReportEditLpr {...props} />;
        case 3: return <ReportEditStep3 {...props} />;
        case 4: return <ReportEditStep4 {...props} saveState={syncState} />;
        case 5: return <ReportEditStep5 {...props} />;
        case 6: return <ReportEditStep6 {...props} />;
        default: return null;
      }
    } else {
      switch (activeStep) {
        case 0: return <ReportEditStep1 {...props} />;
        case 1: return <ReportEditStep2 {...props} />;
        case 2: return <ReportEditStep3 {...props} />;
        case 3: return <ReportEditStep4 {...props} saveState={syncState} />;
        case 4: return <ReportEditStep5 {...props} />;
        case 5: return <ReportEditStep6 {...props} />;
        default: return null;
      }
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
          <Box>
            {renderStepper(handleStepClickMobile)}
            <Divider my="lg" />
            <UnstyledButton
              onClick={() => { openPreview(); closeStepper(); }}
              disabled={isInteractionBlocked}
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

      <div className={isMobile ? 'report-edit-mobile-layout' : 'report-edit-wrapper'}>
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
              onClick={openPreview}
              disabled={isInteractionBlocked}
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
        <div className={isMobile ? 'report-edit-mobile-main' : 'report-edit-main'}>
          <Container
            size={isMobile ? undefined : 'md'}
            px={isMobile ? 'sm' : undefined}
            py={isMobile ? 'md' : 'xl'}
          >
            <Stack gap={isMobile ? 'md' : 'lg'}>
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
                          disabled={isInteractionBlocked}
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
                          loading={saving || syncState === 'saving'}
                          disabled={isInteractionBlocked}
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
                  <UnstyledButton onClick={openStepper} className="step-title-btn" disabled={isInteractionBlocked}>
                    <Group gap="xs" align="center" wrap="nowrap">
                      <ThemeIcon size={36} radius="xl" variant="light" color="blue">
                        <Text size="xs" fw={700}>{activeStep + 1}</Text>
                      </ThemeIcon>
                      <Box style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                          Paso {activeStep + 1} de {stepLabels.length}
                        </Text>
                        <Title order={3}>{stepLabels[activeStep]}</Title>
                      </Box>
                      <IconChevronDown size={20} style={{ color: 'var(--mantine-color-dimmed)' }} />
                    </Group>
                  </UnstyledButton>
                )
              ) : (
                <Group justify="space-between" align="flex-start">
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                      {showPreview ? 'Documento' : `Paso ${activeStep + 1} de ${stepLabels.length}`}
                    </Text>
                    <Title order={2}>{showPreview ? 'Vista previa PDF' : stepLabels[activeStep]}</Title>
                  </Box>
                  <Group gap="sm">
                    {showAdminEditToggle && !showPreview && (
                      <Button
                        variant={adminEditOverride ? 'filled' : 'light'}
                        color={adminEditOverride ? 'yellow' : 'gray'}
                        leftSection={adminEditOverride ? <IconLockOpen size={18} /> : <IconLock size={18} />}
                        onClick={() => setAdminEditOverride((v) => !v)}
                        size="sm"
                        disabled={isInteractionBlocked}
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
                          loading={saving || syncState === 'saving'}
                          disabled={isInteractionBlocked}
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
                  onBack={() => { if (!isInteractionBlocked) setShowPreview(false); }}
                  isAdmin={isAdmin}
                  isOnline={isOnline}
                  onGenerate={isInterventoriaUser ? undefined : handleGenerateFinal}
                  generatedPdfUrl={generatedPdfUrl}
                  onSendToReview={handleSubmitForReview}
                  onApprove={handleApprove}
                  canUploadSignatures={canUploadSignatures}
                  canInterventoriaSignature={canInterventoriaSignature}
                  onUpdateReport={handleUpdateReport}
                  statusActionInProgress={isStatusProcessRunning}
                />
              ) : (
                <>
                  {/* Step content */}
                  <Box py={isMobile ? 0 : 'sm'}>
                    {renderStepContent()}
                  </Box>

                  {/* Navigation */}
                  <Group justify="space-between">
                    <Button variant="default" onClick={prevStep} disabled={activeStep === 0 || isInteractionBlocked}>
                      ← Anterior
                    </Button>
                    <Button
                      onClick={activeStep === stepLabels.length - 1 ? openPreview : nextStep}
                      disabled={isInteractionBlocked}
                    >
                      {activeStep === stepLabels.length - 1 ? 'Ver PDF →' : 'Siguiente →'}
                    </Button>
                  </Group>

                  {syncState !== 'idle' && (
                    <Alert
                      color={
                        syncState === 'error'
                          ? 'red'
                          : syncState === 'saved'
                            ? 'green'
                            : syncState === 'pending'
                              ? 'yellow'
                              : 'blue'
                      }
                      variant="light"
                      icon={
                        syncState === 'pending'
                          ? <IconClockHour4 size={16} />
                          : syncState === 'saving'
                            ? <IconCloudUpload size={16} />
                            : undefined
                      }
                    >
                      {syncState === 'pending' && 'Cambios pendientes por guardar'}
                      {syncState === 'saving' && (isOnline ? 'Subiendo y guardando cambios…' : 'Guardando cambios localmente…')}
                      {syncState === 'saved' && 'Cambios guardados'}
                      {syncState === 'error' && 'Error al guardar cambios'}
                    </Alert>
                  )}
                </>
              )}
            </Stack>
          </Container>
        </div>
      </div>
      <Modal
        opened={statusProcess.phase !== 'idle'}
        onClose={() => {
          if (statusProcess.phase === 'error' || statusProcess.phase === 'success') {
            setStatusProcess({ phase: 'idle', message: '' });
          }
        }}
        closeOnEscape={statusProcess.phase === 'error' || statusProcess.phase === 'success'}
        closeOnClickOutside={false}
        withCloseButton={statusProcess.phase === 'error' || statusProcess.phase === 'success'}
        centered
        title={
          <Text fw={700}>
            {statusProcess.phase === 'processing' && 'Procesando cambio de estado'}
            {statusProcess.phase === 'success' && 'Cambio de estado completado'}
            {statusProcess.phase === 'error' && 'Error al cambiar estado'}
          </Text>
        }
      >
        <Stack gap="md">
          {statusProcess.phase === 'processing' ? (
            <Group gap="sm" wrap="nowrap">
              <Loader size="sm" />
              <Text size="sm">{statusProcess.message}</Text>
            </Group>
          ) : statusProcess.phase === 'error' ? (
            <>
              <Alert color="red" variant="light">
                {statusProcess.message}
              </Alert>
              <Group justify="flex-end">
                <Button onClick={() => setStatusProcess({ phase: 'idle', message: '' })}>
                  Entendido
                </Button>
              </Group>
            </>
          ) : (
            <>
              <Alert color="green" variant="light">
                {statusProcess.message}
              </Alert>
              <Group justify="flex-end">
                <Button
                  onClick={() => {
                    const redirectTo = statusProcess.redirectTo;
                    setStatusProcess({ phase: 'idle', message: '' });
                    if (redirectTo) location.route(redirectTo);
                  }}
                >
                  Continuar
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </>
  );
}
