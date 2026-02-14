import { useState, useEffect, useRef } from 'preact/hooks';
import { useRoute, useLocation } from 'preact-iso';
import {
  Container,
  Title,
  Text,
  Tabs,
  Button,
  Group,
  Alert,
  Stack,
  Box,
  ScrollArea,
  Select,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { IconDeviceFloppy } from '@tabler/icons-react';
import { useMediaQuery } from '@mantine/hooks';
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

const STEP_LABELS = [
  'Datos generales y ubicación',
  'Seguridad, contrato y observaciones',
  'Datos técnicos e infraestructura',
  'Diagrama y mapa',
  'Evidencia fotográfica',
  'Metrajes y civil',
  'Cierre y guardado',
];

const STEP_KEYS = STEP_LABELS.map((_, i) => String(i));
const STEP_SHORT_LABELS = [
  'Generales',
  'Seguridad',
  'Técnicos',
  'Diagrama',
  'Fotos',
  'Metrajes',
  'Cierre',
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

  const stepValue = String(activeStep);
  const setStepValue = (v: string | null) => setActiveStep(Number(v ?? 0));
  const isMobile = useMediaQuery('(max-width: 48em)');

  const stepSelectData = STEP_KEYS.map((key) => ({
    value: key,
    label: `Paso ${Number(key) + 1}: ${STEP_SHORT_LABELS[Number(key)]}`,
  }));

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

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <Group justify="space-between" align="flex-start">
          <Box>
            <Title order={2}>Editar reporte</Title>
            <Text c="dimmed" mt="xs" size="sm">
              ID: {report.id}
            </Text>
          </Box>
          {!readOnly && (
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

        <Tabs value={stepValue} onChange={setStepValue} variant="outline">
          {isMobile ? (
            <Select
              label="Paso actual"
              value={stepValue}
              onChange={setStepValue}
              data={stepSelectData}
              size="sm"
              mb="sm"
            />
          ) : (
            <ScrollArea scrollbars="x" type="auto" mb="xs">
              <Tabs.List style={{ flexWrap: 'nowrap', minWidth: 'min-content' }}>
                {STEP_KEYS.map((key, index) => (
                  <Tabs.Tab key={key} value={key} style={{ whiteSpace: 'nowrap' }}>
                    {index + 1}. {STEP_SHORT_LABELS[index]}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </ScrollArea>
          )}
          {STEP_KEYS.map((key, index) => (
            <Tabs.Panel key={key} value={key} pt="md">
              <Box py="sm">
                {index === 0 ? (
                  <ReportEditStep1
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 1 ? (
                  <ReportEditStep2
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 2 ? (
                  <ReportEditStep3
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 3 ? (
                  <ReportEditStep4
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 4 ? (
                  <ReportEditStep5
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 5 ? (
                  <ReportEditStep6
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : index === 6 ? (
                  <ReportEditStep7
                    report={report}
                    setReport={setReport}
                    readOnly={readOnly}
                  />
                ) : null}
              </Box>
            </Tabs.Panel>
          ))}
        </Tabs>

        <Group justify="space-between">
          <Button variant="default" onClick={prevStep} disabled={activeStep === 0}>
            Anterior
          </Button>
          <Button
            onClick={nextStep}
            disabled={activeStep === STEP_LABELS.length - 1}
          >
            Siguiente
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
      </Stack>
    </Container>
  );
}
