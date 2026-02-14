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
import { IconDeviceFloppy, IconCheck, IconChevronDown, IconEye } from '@tabler/icons-react';
import { useMediaQuery, useDisclosure } from '@mantine/hooks';
import type { Report } from '../../types/Report';
import { useAuth } from '../../features/auth/AuthContext';
import { getReport, saveReport, updateReportStatus } from '../../services/reportsService';
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
  'Datos generales y ubicación',
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

  const persistReport = (r: Report) => {
    saveReport(r).catch((e) =>
      console.error('Error al guardar reporte:', e)
    );
  };

  // Debounced auto-save: persist 2s after last change
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if (!report) return;
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      persistReport(report);
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [report]);

  const handleSave = async () => {
    if (!report) return;
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
    if (report) persistReport(report);
    setActiveStep((c) => (c < STEP_LABELS.length - 1 ? c + 1 : c));
  };
  const prevStep = () => {
    if (report) persistReport(report);
    setActiveStep((c) => (c > 0 ? c - 1 : c));
  };

  const handleSubmitForReview = async () => {
    if (!report || report.status !== 'en_campo') return;
    if (!confirm('¿Está seguro de enviar este reporte a revisión? Ya no podrá editarlo.')) return;

    const updated = await updateReportStatus(report, 'en_revision');
    setReport(updated);
    location.route('/mis-reportes');
  };

  const handleApprove = async () => {
    if (!report || report.status !== 'en_revision') return;
    if (!confirm('¿Marcar este reporte como listo para generar?')) return;

    const updated = await updateReportStatus(report, 'listo_para_generar');
    setReport(updated);
    location.route('/');
  };

  // Admin can edit en_campo and en_revision; workers can only edit en_campo
  const readOnly = isAdmin
    ? report?.status === 'listo_para_generar' || report?.status === 'generado'
    : report?.status !== 'en_campo';

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
    if (report) persistReport(report);
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
    const props = { report, setReport, readOnly };
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
              )}

              {showPreview ? (
                <PdfPreviewPanel
                  report={report}
                  onBack={() => setShowPreview(false)}
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

                  {/* Status transition actions */}
                  {report.status === 'en_campo' && !isAdmin && (
                    <Alert color="blue" variant="light" title="Reporte en campo">
                      <Group justify="space-between" align="center" mt="xs">
                        <Text size="sm">Cuando el reporte esté completo, envíelo a revisión.</Text>
                        <Button color="orange" onClick={handleSubmitForReview}>
                          Enviar a Revisión
                        </Button>
                      </Group>
                    </Alert>
                  )}

                  {report.status === 'en_revision' && isAdmin && (
                    <Alert color="orange" variant="light" title="Reporte en revisión">
                      <Group justify="space-between" align="center" mt="xs">
                        <Text size="sm">Revise los datos y apruebe el reporte cuando esté correcto.</Text>
                        <Button color="teal" onClick={handleApprove}>
                          Marcar como Listo para generar
                        </Button>
                      </Group>
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
