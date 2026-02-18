import { useState, useEffect } from 'preact/hooks';
import "./ReportEdit.css"
import {
  Select,
  Stack,
  Text,
  TextInput,
  Button,
  Group,
  ActionIcon,
  Box,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
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
  const [newObservation, setNewObservation] = useState('');

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

  const addObservation = () => {
    const trimmed = newObservation.trim();
    if (!trimmed) return;
    setReport({
      ...report,
      observations: [...(report.observations ?? []), trimmed],
      updated_at: Date.now(),
    });
    setNewObservation('');
  };

  const removeObservation = (index: number) => {
    const next = [...(report.observations ?? [])];
    next.splice(index, 1);
    setReport({
      ...report,
      observations: next,
      updated_at: Date.now(),
    });
  };

  const updateObservation = (index: number, value: string) => {
    const next = [...(report.observations ?? [])];
    next[index] = value;
    setReport({
      ...report,
      observations: next,
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
        <Box>
          <Text size="sm" fw={500} c="dimmed">Observaciones</Text>
          {report.observations?.length ? (
            <Stack gap="xs" mt="xs">
              {report.observations.map((obs, i) => (
                <Text key={i} size="sm">{obs}</Text>
              ))}
            </Stack>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
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
      <Box>
        <Text size="md" fw={800} mb="xs" component="label" display="block">
          Observaciones
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Agregue las observaciones que apliquen al sitio.
        </Text>
        <Group gap="xs" mb="sm">
          <TextInput
            placeholder="Nueva observación"
            value={newObservation}
            onInput={(e) => setNewObservation((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addObservation())}
            style={{ flex: 1 }}
          />
          <Button
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={addObservation}
            disabled={!newObservation.trim()}
          >
            Agregar
          </Button>
        </Group>
        <Stack gap="xs">
          {(report.observations ?? []).map((obs, index) => (
            <Group key={index} gap="xs" wrap="nowrap">
              <TextInput
                value={obs}
                onInput={(e) => updateObservation(index, (e.target as HTMLInputElement).value)}
                style={{ flex: 1 }}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => removeObservation(index)}
                aria-label="Eliminar observación"
              >
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
        </Stack>
      </Box>
    </Stack>
  );
}
