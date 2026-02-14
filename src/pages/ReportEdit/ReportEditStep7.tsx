import { Stack, Text, TextInput, Textarea, Divider, Box } from '@mantine/core';
import type { Report } from '../../types/Report';

interface ReportEditStep7Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditStep7({ report, setReport, readOnly }: ReportEditStep7Props) {
  if (readOnly) {
    return (
      <Stack gap="md">
        <Text size="md" fw={800}>Cierre del reporte</Text>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Este punto de cámara pertenece a</Text>
          <Text>{report.owner_name || '—'}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Observaciones finales</Text>
          <Text>{report.final_observations || '—'}</Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text size="md" fw={800}>Cierre del reporte</Text>
      <TextInput
        label="Este punto de cámara pertenece a"
        placeholder="Nombre o entidad"
        value={report.owner_name}
        onInput={(e) =>
          setReport({
            ...report,
            owner_name: (e.target as HTMLInputElement).value,
            updated_at: Date.now(),
          })
        }
      />
      <Textarea
        label="Observaciones finales"
        placeholder="Observaciones adicionales de cierre"
        autosize
        minRows={3}
        maxRows={8}
        value={report.final_observations}
        onInput={(e) =>
          setReport({
            ...report,
            final_observations: (e.target as HTMLTextAreaElement).value,
            updated_at: Date.now(),
          })
        }
      />
      <Text size="xs" c="dimmed">
        Nota: Los espacios para firmas (Director de Proyectos y Director de Interventoría) se incluirán en el PDF generado.
      </Text>
    </Stack>
  );
}
