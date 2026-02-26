import { useEffect } from 'preact/hooks';
import "./ReportEdit.css"
import {
  Select,
  Stack,
  Text,
  Box,
} from '@mantine/core';
import type { Report, SecurityLevel, ContractComponent } from '../../types/Report';

const SECURITY_LEVEL_OPTIONS: { value: SecurityLevel; label: string }[] = [
  { value: 'alto', label: 'Alto' },
  { value: 'medio', label: 'Medio' },
  { value: 'bajo', label: 'Bajo' },
];

const CONTRACT_COMPONENT_OPTIONS: { value: ContractComponent; label: string }[] = [
  { value: 'valle_seguro', label: 'Valle Seguro' },
  { value: 'lpr', label: 'LPR' },
  { value: 'cotejo_facial', label: 'Cotejo Facial' },
];

interface ReportEditStep2Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditStep2({ report, setReport, readOnly }: ReportEditStep2Props) {
  useEffect(() => {
    const siteType = report.address.site_type;
    if (!siteType) return;
    
    let component: ContractComponent;
    if (siteType === 'ptz') {
      component = 'valle_seguro';
    } else if (siteType === 'lpr') {
      component = 'lpr';
    } else if (siteType === 'cotejo_facial') {
      component = 'cotejo_facial';
    } else {
      return;
    }

    if (report.contract_component !== component) {
      setReport({
        ...report,
        contract_component: component,
        updated_at: Date.now(),
      });
    }
  }, [report.address.site_type]);

  const onSecurityLevelChange = (value: string | null) => {
    if (value == null) return;
    setReport({
      ...report,
      security_level: value as SecurityLevel,
      updated_at: Date.now(),
    });
  };

  const onContractComponentChange = (value: string | null) => {
    if (value == null) return;
    setReport({
      ...report,
      contract_component: value as ContractComponent,
      updated_at: Date.now(),
    });
  };

  if (readOnly) {
    return (
      <Stack gap="md">
        <Box>
          <Text size="sm" fw={500} c="dimmed">Nivel de seguridad</Text>
          <Text>
            {SECURITY_LEVEL_OPTIONS.find((o) => o.value === report.security_level)?.label ?? report.security_level}
          </Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Componentes del contrato 001</Text>
          <Text>
            {CONTRACT_COMPONENT_OPTIONS.find((o) => o.value === report.contract_component)?.label ?? report.contract_component}
          </Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Select
        label="Nivel de seguridad"
        placeholder="Seleccione el nivel"
        data={SECURITY_LEVEL_OPTIONS}
        value={report.security_level}
        onChange={onSecurityLevelChange}
      />
      <Select
        label="Componentes del contrato 001"
        placeholder="Seleccione el componente"
        data={CONTRACT_COMPONENT_OPTIONS}
        value={report.contract_component}
        onChange={onContractComponentChange}
      />
    </Stack>
  );
}
