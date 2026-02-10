import { useState, useEffect } from 'preact/hooks';
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
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { getReportFromDB, saveReportToDB } from '../../utils/indexedDB';
import type { Report } from '../../types/Report';
import { ReportEditStep1 } from './ReportEditStep1';
import { ReportEditStep2 } from './ReportEditStep2';
import { ReportEditStep3 } from './ReportEditStep3';
import { ReportEditStep4 } from './ReportEditStep4';
import { ReportEditStep5 } from './ReportEditStep5';

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
  const id = params?.id;

  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getReportFromDB(id)
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
    saveReportToDB(r).catch((e) =>
      console.error('Error al guardar reporte en IndexedDB:', e)
    );
  };

  const nextStep = () => {
    if (report) persistReport(report);
    setActiveStep((c) => (c < STEP_LABELS.length - 1 ? c + 1 : c));
  };
  const prevStep = () => {
    if (report) persistReport(report);
    setActiveStep((c) => (c > 0 ? c - 1 : c));
  };
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
        <Box>
          <Title order={2}>Editar reporte</Title>
          <Text c="dimmed" mt="xs" size="sm">
            ID: {report.id}
          </Text>
        </Box>

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
                    readOnly={report.status !== 'en_campo'}
                  />
                ) : index === 1 ? (
                  <ReportEditStep2
                    report={report}
                    setReport={setReport}
                    readOnly={report.status !== 'en_campo'}
                  />
                ) : index === 2 ? (
                  <ReportEditStep3
                    report={report}
                    setReport={setReport}
                    readOnly={report.status !== 'en_campo'}
                  />
                ) : index === 3 ? (
                  <ReportEditStep4
                    report={report}
                    setReport={setReport}
                    readOnly={report.status !== 'en_campo'}
                  />
                ) : index === 4 ? (
                  <ReportEditStep5
                    report={report}
                    setReport={setReport}
                    readOnly={report.status !== 'en_campo'}
                  />
                ) : (
                  <Text size="sm" c="dimmed">
                    Paso {index + 1}: {STEP_LABELS[index]} (contenido en desarrollo)
                  </Text>
                )}
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
      </Stack>
    </Container>
  );
}
