import {
  Stack,
  Text,
  Select,
  Switch,
  NumberInput,
  TextInput,
  Box,
  Divider,
} from '@mantine/core';
import type {
  Report,
  TransmissionMedium,
  CablingType,
  ConnectivityData,
  HardwareInventory,
  InfrastructureDetails,
} from '../../types/Report';

const TRANSMISSION_OPTIONS: { value: TransmissionMedium; label: string }[] = [
  { value: 'fibra_optica', label: 'Fibra óptica' },
  { value: 'na', label: 'N/A' },
];

const CABLING_OPTIONS: { value: CablingType; label: string }[] = [
  { value: 'aereo', label: 'Aéreo' },
  { value: 'subterraneo', label: 'Subterráneo' },
  { value: 'mixto', label: 'Mixto' },
];

interface ReportEditStep3Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

function setConnectivity(report: Report, patch: Partial<ConnectivityData>): Report {
  return {
    ...report,
    connectivity: { ...report.connectivity, ...patch },
    updated_at: Date.now(),
  };
}

function setHardware(report: Report, patch: Partial<HardwareInventory>): Report {
  return {
    ...report,
    hardware: { ...report.hardware, ...patch },
    updated_at: Date.now(),
  };
}

function setInfrastructureDetails(report: Report, patch: Partial<InfrastructureDetails>): Report {
  return {
    ...report,
    infrastructure_details: { ...report.infrastructure_details, ...patch },
    updated_at: Date.now(),
  };
}

export function ReportEditStep3({ report, setReport, readOnly }: ReportEditStep3Props) {
  const c = report.connectivity;
  const h = report.hardware;

  if (readOnly) {
    return (
      <Stack gap="md">
        <Box>
          <Text size="sm" fw={500} c="dimmed">Línea de vista</Text>
          <Text>{c.has_line_of_sight ? 'Sí' : 'No'}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Medio de transmisión</Text>
          <Text>{TRANSMISSION_OPTIONS.find((o) => o.value === c.transmission_medium)?.label ?? c.transmission_medium}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Tipo de cableado</Text>
          <Text>{CABLING_OPTIONS.find((o) => o.value === c.cabling_type)?.label ?? c.cabling_type}</Text>
        </Box>
        <Divider label="Inventario de hardware" />
        <Text size="sm" fw={500} c="dimmed">Cajas adicionales / Multisensor / PTZ / Fijas</Text>
        <Text size="sm">{h.additional_boxes} / {h.cameras_multisensor} / {h.cameras_ptz} / {h.cameras_fixed}</Text>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text size="md" fw={800}>Conectividad</Text>
      <Switch
        label="Tiene línea de vista"
        checked={c.has_line_of_sight}
        onChange={(e) => setReport(setConnectivity(report, { has_line_of_sight: (e.target as HTMLInputElement).checked }))}
      />
      <Select
        label="Medio de transmisión"
        placeholder="Seleccione"
        data={TRANSMISSION_OPTIONS}
        value={c.transmission_medium}
        onChange={(v) => v != null && setReport(setConnectivity(report, { transmission_medium: v as TransmissionMedium }))}
      />
      <Select
        label="Tipo de cableado"
        placeholder="Seleccione"
        data={CABLING_OPTIONS}
        value={c.cabling_type}
        onChange={(v) => v != null && setReport(setConnectivity(report, { cabling_type: v as CablingType }))}
      />

      <Divider />

      <Text size="md" fw={800}>
        Inventario de hardware
      </Text>
      <NumberInput
        label="Cajas adicionales"
        min={0}
        value={h.additional_boxes}
        onChange={(n) => setReport(setHardware(report, { additional_boxes: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
      <NumberInput
        label="Cámaras multisensor"
        min={0}
        value={h.cameras_multisensor}
        onChange={(n) => setReport(setHardware(report, { cameras_multisensor: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
      <NumberInput
        label="Cámaras PTZ"
        min={0}
        value={h.cameras_ptz}
        onChange={(n) => setReport(setHardware(report, { cameras_ptz: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
      <NumberInput
        label="Cámaras fijas"
        min={0}
        value={h.cameras_fixed}
        onChange={(n) => setReport(setHardware(report, { cameras_fixed: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
    </Stack>
  );
}
