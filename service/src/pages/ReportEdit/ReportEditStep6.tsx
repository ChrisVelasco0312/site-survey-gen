import {
  Stack,
  Text,
  NumberInput,
  Textarea,
  Divider,
  Box,
  Alert,
} from '@mantine/core';
import type { Report, PoleInfrastructure, FacadeInfrastructure } from '../../types/Report';

interface ReportEditStep6Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

function setPoleInfra(report: Report, patch: Partial<PoleInfrastructure>): Report {
  return {
    ...report,
    pole_infrastructure: { ...report.pole_infrastructure, ...patch },
    updated_at: Date.now(),
  };
}

function setFacadeInfra(report: Report, patch: Partial<FacadeInfrastructure>): Report {
  return {
    ...report,
    facade_infrastructure: { ...report.facade_infrastructure, ...patch },
    updated_at: Date.now(),
  };
}

function hasPoleMetrage(p: PoleInfrastructure): boolean {
  return p.aerial_meters > 0 || p.grass_meters > 0 || p.asphalt_meters > 0 || p.other_surface_meters > 0;
}

const parseNum = (n: string | number): number =>
  typeof n === 'string' ? parseFloat(n) || 0 : n ?? 0;

export function ReportEditStep6({ report, setReport, readOnly }: ReportEditStep6Props) {
  const pole = report.pole_infrastructure;
  const facade = report.facade_infrastructure;

  if (readOnly) {
    return (
      <Stack gap="md">
        <Divider label="Metrajes — Poste" />
        <Box>
          <Text size="sm" fw={500} c="dimmed">Aérea (m)</Text>
          <Text>{pole.aerial_meters}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Prado (m)</Text>
          <Text>{pole.grass_meters}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Asfalto (m)</Text>
          <Text>{pole.asphalt_meters}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Otra superficie (m)</Text>
          <Text>{pole.other_surface_meters}</Text>
        </Box>

        <Divider label="Instalación en Fachada" />
        <Box>
          <Text size="sm" fw={500} c="dimmed">Descripción</Text>
          <Text>{facade.description || '—'}</Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Divider label="Metrajes — Poste" />
      <Text size="xs" c="dimmed">
        Ingrese los metros de cableado según el tipo de superficie. Al menos un campo debe tener valor mayor a 0.
      </Text>

      <NumberInput
        label="Aérea (metros)"
        min={0}
        decimalScale={2}
        value={pole.aerial_meters}
        onChange={(n) => setReport(setPoleInfra(report, { aerial_meters: parseNum(n) }))}
      />
      <NumberInput
        label="Prado (metros)"
        min={0}
        decimalScale={2}
        value={pole.grass_meters}
        onChange={(n) => setReport(setPoleInfra(report, { grass_meters: parseNum(n) }))}
      />
      <NumberInput
        label="Asfalto (metros)"
        min={0}
        decimalScale={2}
        value={pole.asphalt_meters}
        onChange={(n) => setReport(setPoleInfra(report, { asphalt_meters: parseNum(n) }))}
      />
      <NumberInput
        label="Otra superficie (metros)"
        min={0}
        decimalScale={2}
        value={pole.other_surface_meters}
        onChange={(n) => setReport(setPoleInfra(report, { other_surface_meters: parseNum(n) }))}
      />

      {!hasPoleMetrage(pole) && (
        <Alert color="yellow" variant="light" title="Validación">
          Al menos un campo de metraje en poste debe tener un valor mayor a 0.
        </Alert>
      )}

      <Divider label="Instalación en Fachada" />
      <Textarea
        label="Descripción"
        placeholder="Descripción breve de la instalación en fachada"
        autosize
        minRows={2}
        maxRows={6}
        value={facade.description}
        onInput={(e) =>
          setReport(setFacadeInfra(report, { description: (e.target as HTMLTextAreaElement).value }))
        }
      />
    </Stack>
  );
}
