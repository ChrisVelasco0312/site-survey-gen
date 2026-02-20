import {
  Stack,
  Text,
  NumberInput,
  TextInput,
  Textarea,
  Divider,
  Box,
  Table,
} from '@mantine/core';
import type { Report, PoleInfrastructure, InfrastructureDetails, FacadeInfrastructure } from '../../types/Report';

interface ReportEditStepCableadoProps {
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

function setInfrastructureDetails(report: Report, patch: Partial<InfrastructureDetails>): Report {
  return {
    ...report,
    infrastructure_details: { ...report.infrastructure_details, ...patch },
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

const parseNum = (n: string | number): number =>
  typeof n === 'string' ? parseFloat(n) || 0 : n ?? 0;

export function ReportEditStepCableado({ report, setReport, readOnly }: ReportEditStepCableadoProps) {
  const pole = report.pole_infrastructure;
  const se = report.infrastructure_details.service_entrance;
  const cp = report.infrastructure_details.camera_point;
  const facade = report.facade_infrastructure;

  const rows = [
    { label: 'Aérea', value: pole.aerial_meters, key: 'aerial_meters' as keyof PoleInfrastructure },
    { label: 'Prado', value: pole.grass_meters, key: 'grass_meters' as keyof PoleInfrastructure },
    { label: 'Asfalto', value: pole.asphalt_meters, key: 'asphalt_meters' as keyof PoleInfrastructure },
    { label: 'Adoquín', value: pole.adoquin_meters, key: 'adoquin_meters' as keyof PoleInfrastructure },
    { label: 'Concreto', value: pole.concrete_meters, key: 'concrete_meters' as keyof PoleInfrastructure },
    { label: 'Relleno', value: pole.fill_meters, key: 'fill_meters' as keyof PoleInfrastructure },
  ];

  if (readOnly) {
    return (
      <Stack gap="md">
        <Text size="md" fw={700}>4. Cableado y Adecuaciones Físicas en Poste</Text>
        <Text size="sm">Ruta Acometida hasta Base de Poste:</Text>
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo de Superficie</Table.Th>
              <Table.Th>Metros (mts)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>{row.value}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>

        <Divider my="md" />

        <Text size="md" fw={700}>5. Cableado y Adecuaciones Físicas en Fachada</Text>
        
        <Box>
          <Text size="sm" fw={600}>Breve Descripción:</Text>
          <Text size="sm">{facade.description || '—'}</Text>
        </Box>

        <Box>
          <Text size="sm" fw={600} td="underline">POSTE ACOMETIDA:</Text>
          <Text size="sm">Tubería: {se.pipe_type || '—'}</Text>
          <Text size="sm">Altura: {se.height || '—'}</Text>
          <Text size="sm">Otro: {se.other || '—'}</Text>
        </Box>

        <Box>
          <Text size="sm" fw={600} td="underline">POSTE PUNTO DE CÁMARA:</Text>
          <Text size="sm">Tubería: {cp.pipe_type || '—'}</Text>
          <Text size="sm">Altura: {cp.height || '—'}</Text>
          <Text size="sm">Material: {cp.material || '—'}</Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="xl">
      {/* SECTION 1: POSTE */}
      <Box>
        <Text size="lg" fw={800} mb="sm" style={{ textTransform: 'uppercase', background: '#e0e0e0', padding: '8px' }}>
          4. Cableado y Adecuaciones Físicas en Poste
        </Text>
        <Text size="sm" mb="md">Ruta Acometida hasta Base de Poste:</Text>
        
        <Table withTableBorder withColumnBorders>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo de Superficie</Table.Th>
              <Table.Th style={{ width: '150px' }}>Metros (mts)</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={row.key}>
                <Table.Td>{row.label}</Table.Td>
                <Table.Td>
                  <NumberInput
                    min={0}
                    decimalScale={2}
                    value={row.value}
                    onChange={(n) => setReport(setPoleInfra(report, { [row.key]: parseNum(n) }))}
                    size="xs"
                    hideControls
                  />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {/* SECTION 2: FACHADA */}
      <Box>
        <Text size="lg" fw={800} mb="sm" style={{ textTransform: 'uppercase', background: '#e0e0e0', padding: '8px' }}>
          5. Cableado y Adecuaciones Físicas en Fachada
        </Text>
        
        <Textarea
          label="Breve Descripción:"
          autosize
          minRows={2}
          mb="md"
          value={facade.description}
          onInput={(e) =>
            setReport(setFacadeInfra(report, { description: (e.target as HTMLTextAreaElement).value }))
          }
        />

        <Stack gap="md" mb="md">
          {/* POSTE ACOMETIDA */}
          <Box>
            <Text size="sm" fw={700} mb="xs" td="underline">POSTE ACOMETIDA:</Text>
            <Stack gap="xs">
              <TextInput
                label="Tubería:"
                placeholder="Ej. PVC"
                value={se.pipe_type}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  service_entrance: { ...se, pipe_type: (e.target as HTMLInputElement).value },
                }))}
              />
              <TextInput
                label="Altura:"
                placeholder="Ej. 3m"
                value={se.height}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  service_entrance: { ...se, height: (e.target as HTMLInputElement).value },
                }))}
              />
              <TextInput
                label="Otro:"
                placeholder=""
                value={se.other}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  service_entrance: { ...se, other: (e.target as HTMLInputElement).value },
                }))}
              />
            </Stack>
          </Box>

          {/* POSTE PUNTO DE CÁMARA */}
          <Box>
            <Text size="sm" fw={700} mb="xs" td="underline">POSTE PUNTO DE CÁMARA:</Text>
            <Stack gap="xs">
              <TextInput
                label="Tubería:"
                placeholder="Ej. PVC"
                value={cp.pipe_type}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  camera_point: { ...cp, pipe_type: (e.target as HTMLInputElement).value },
                }))}
              />
              <TextInput
                label="Altura:"
                placeholder="Ej. 3m"
                value={cp.height}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  camera_point: { ...cp, height: (e.target as HTMLInputElement).value },
                }))}
              />
              <TextInput
                label="Material:"
                placeholder="Ej. Concreto"
                value={cp.material}
                onInput={(e) => setReport(setInfrastructureDetails(report, {
                  camera_point: { ...cp, material: (e.target as HTMLInputElement).value },
                }))}
              />
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
