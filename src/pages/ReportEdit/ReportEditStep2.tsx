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
  { value: 'radio_enlace', label: 'Radioenlace' },
  { value: 'na', label: 'N/A' },
];

const CABLING_OPTIONS: { value: CablingType; label: string }[] = [
  { value: 'aereo', label: 'Aéreo' },
  { value: 'subterraneo', label: 'Subterráneo' },
  { value: 'mixto', label: 'Mixto' },
];

interface ReportEditStep2Props {
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

export function ReportEditStep2({ report, setReport, readOnly }: ReportEditStep2Props) {
  const c = report.connectivity;
  const h = report.hardware;
  const siteType = report.address.site_type;

  const isFacial = siteType === 'cotejo_facial';
  const isLPR = siteType === 'lpr';
  const isPTZ = siteType === 'ptz' || !siteType;

  const cameraFields = [
    ...(isPTZ ? [{
      key: 'multisensor',
      label: 'Multisensor',
      value: h.cameras_multisensor,
      onChange: (n: number) => setReport(setHardware(report, { cameras_multisensor: n }))
    }] : []),
    ...(isFacial ? [{
      key: 'facial',
      label: 'Facial',
      value: h.cameras_facial,
      onChange: (n: number) => setReport(setHardware(report, { cameras_facial: n }))
    }] : []),
    ...(isPTZ ? [{
      key: 'ptz',
      label: 'PTZ',
      value: h.cameras_ptz,
      onChange: (n: number) => setReport(setHardware(report, { cameras_ptz: n }))
    }] : []),
    ...(isPTZ ? [{
      key: 'fixed',
      label: 'Fijas',
      value: h.cameras_fixed,
      onChange: (n: number) => setReport(setHardware(report, { cameras_fixed: n }))
    }] : []),
    ...(isLPR ? [{
      key: 'lpr',
      label: 'LPR',
      value: h.cameras_lpr,
      onChange: (n: number) => setReport(setHardware(report, { cameras_lpr: n }))
    }] : []),
    ...(isLPR ? [{
      key: 'ptz',
      label: 'PTZ',
      value: h.cameras_ptz,
      onChange: (n: number) => setReport(setHardware(report, { cameras_ptz: n }))
    }] : []),
  ];

  const cameraDisplay = [
    isPTZ ? h.cameras_multisensor : 0,
    isFacial ? h.cameras_facial : 0,
    isPTZ ? h.cameras_ptz : 0,
    isPTZ ? h.cameras_fixed : 0,
    isLPR ? h.cameras_lpr : 0,
  ].filter(Boolean).join(' / ');

  const cameraLabels = [
    isPTZ ? 'Multisensor' : '',
    isFacial ? 'Facial' : '',
    isPTZ ? 'PTZ' : '',
    isPTZ ? 'Fijas' : '',
    isLPR ? 'LPR' : '',
  ].filter(Boolean).join(' / ');

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
        <Divider label="Cámaras" />
        <Text size="sm" fw={500} c="dimmed">{cameraLabels}</Text>
        <Text size="sm">{cameraDisplay}</Text>
        <Divider label="Cajas" />
        <Text size="sm" fw={500} c="dimmed">40x40 / 60x60 / Total</Text>
        <Text size="sm">{h.boxes_40 ?? 0} / {h.boxes_60 ?? 0} / {(h.boxes_40 ?? 0) + (h.boxes_60 ?? 0)}</Text>
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
        Cámaras
      </Text>
      {cameraFields.map((field) => (
        <NumberInput
          key={field.key}
          label={field.label}
          min={0}
          value={field.value}
          onChange={(n) => field.onChange(typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0)}
        />
      ))}

      <Divider />

      <Text size="md" fw={800}>
        Cajas
      </Text>
      <NumberInput
        label="Cajas 40x40"
        min={0}
        value={h.boxes_40 ?? 0}
        onChange={(n) => setReport(setHardware(report, { boxes_40: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
      <NumberInput
        label="Cajas 60x60"
        min={0}
        value={h.boxes_60 ?? 0}
        onChange={(n) => setReport(setHardware(report, { boxes_60: typeof n === 'string' ? parseInt(n, 10) || 0 : n ?? 0 }))}
      />
    </Stack>
  );
}
