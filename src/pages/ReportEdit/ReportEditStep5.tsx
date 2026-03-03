import {
  Stack,
  Text,
  NumberInput,
  Divider,
  Box,
  Select,
  Radio,
  Group,
  SimpleGrid,
} from '@mantine/core';
import type { Report, PoleInfrastructure, InfrastructureDetails } from '../../types/Report';

interface ReportEditStep5Props {
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

const parseNum = (n: string | number): number =>
  typeof n === 'string' ? parseFloat(n) || 0 : n ?? 0;

export function ReportEditStep5({ report, setReport, readOnly }: ReportEditStep5Props) {
  const pole = report.pole_infrastructure;
  const se = report.infrastructure_details.service_entrance;
  const cp = report.infrastructure_details.camera_point;

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
        <Text size="sm" fw={600}>Ruta Acometida hasta Base de Poste:</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          {rows.map((row) => (
            <Box key={row.key}>
              <Text size="xs" c="dimmed">{row.label}</Text>
              <Text size="sm">{row.value ?? 0} mts</Text>
            </Box>
          ))}
        </SimpleGrid>

        <Box mt="md">
          <Text size="sm" fw={600}>El punto de cámara se instalará con:</Text>
          <Text size="sm">
            {report.infrastructure_details.camera_mounting === 'soporte_t' && 'Soporte T'}
            {report.infrastructure_details.camera_mounting === 'poste' && 'Poste'}
            {report.infrastructure_details.camera_mounting === 'soporte_l' && 'Soporte L'}
            {!report.infrastructure_details.camera_mounting && '—'}
          </Text>
        </Box>

        <Box mt="md">
          <Text size="sm" fw={600}>Requiere instalación de poste de apoyo:</Text>
          <Text size="sm">
            {report.infrastructure_details.needs_support_point === true ? 'SI' : 
             report.infrastructure_details.needs_support_point === false ? 'NO' : '—'}
          </Text>
        </Box>

        {report.infrastructure_details.needs_support_point === true && (
          <Box mt="md">
            <Text size="sm" fw={600}>Cantidad de postes de apoyo:</Text>
            <Text size="sm">{report.infrastructure_details.apoyo_cant ?? 0}</Text>
          </Box>
        )}

        <Box mt="md">
          <Text size="sm" fw={600}>DISTANCIA DE ACOMETIDA DE RED ELÉCTRICA A INSTALAR (desde el punto de conexión hasta el gabinete)</Text>
          <Text size="sm">{report.infrastructure_details.electrical_distance ?? 0} mts</Text>
        </Box>

        <Box mt="md">
          <Text size="sm" fw={600}>DISTANCIA DE ACOMETIDA FIBRA ÓPTICA A INSTALAR (desde la mufla de Cámara hasta el gabinete)</Text>
          <Text size="sm">{report.infrastructure_details.fiber_distance ?? 0} mts</Text>
        </Box>

        <Divider my="md" />

        <Box>
          <Text size="sm" fw={600} td="underline">POSTE ACOMETIDA:</Text>
          <Text size="sm">Altura: {se.height || '—'}</Text>
          <Text size="sm">Material: {se.material || '—'}</Text>
        </Box>

        <Box>
          <Text size="sm" fw={600} td="underline">POSTE PUNTO DE CÁMARA:</Text>
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
        <Text size="sm" fw={600} mb="md">Ruta Acometida hasta Base de Poste:</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
          {rows.map((row) => (
            <NumberInput
              key={row.key}
              label={row.label}
              min={0}
              decimalScale={2}
              value={row.value}
              onChange={(n) => setReport(setPoleInfra(report, { [row.key]: parseNum(n) }))}
              suffix=" mts"
            />
          ))}
        </SimpleGrid>

        <Box mb="md">
          <Text size="sm" fw={700} mb="xs">El punto de cámara se instalará con:</Text>
          <Radio.Group
            value={report.infrastructure_details.camera_mounting || ''}
            onChange={(val) => setReport(setInfrastructureDetails(report, { camera_mounting: val as any }))}
          >
            <Group>
              <Radio value="soporte_t" label="Soporte T" />
              <Radio value="poste" label="Poste" />
              <Radio value="soporte_l" label="Soporte L" />
            </Group>
          </Radio.Group>
        </Box>

        <Box mb="md">
          <Text size="sm" fw={700} mb="xs">Requiere instalación de poste de apoyo:</Text>
          <Radio.Group
            value={report.infrastructure_details.needs_support_point === undefined ? '' : String(report.infrastructure_details.needs_support_point)}
            onChange={(val) => setReport(setInfrastructureDetails(report, { needs_support_point: val === 'true' }))}
          >
            <Group>
              <Radio value="true" label="SI" />
              <Radio value="false" label="NO" />
            </Group>
          </Radio.Group>
        </Box>

        <Box mb="md">
          <NumberInput
            label="Cantidad de postes de apoyo:"
            min={0}
            value={report.infrastructure_details.apoyo_cant ?? 0}
            onChange={(n) => setReport(setInfrastructureDetails(report, { apoyo_cant: parseNum(n) }))}
          />
        </Box>

        <Box mb="md">
          <NumberInput
            label="DISTANCIA DE ACOMETIDA DE RED ELÉCTRICA A INSTALAR (desde el punto de conexión hasta el gabinete)"
            min={0}
            decimalScale={2}
            value={report.infrastructure_details.electrical_distance ?? 0}
            onChange={(n) => setReport(setInfrastructureDetails(report, { electrical_distance: parseNum(n) }))}
            suffix=" mts"
          />
        </Box>

        <Box mb="md">
          <NumberInput
            label="DISTANCIA DE ACOMETIDA FIBRA ÓPTICA A INSTALAR (desde la mufla de Cámara hasta el gabinete)"
            min={0}
            decimalScale={2}
            value={report.infrastructure_details.fiber_distance ?? 0}
            onChange={(n) => setReport(setInfrastructureDetails(report, { fiber_distance: parseNum(n) }))}
            suffix=" mts"
          />
        </Box>
      </Box>

      {/* SECTION 2: FACHADA */}
      <Box>
        <Stack gap="md" mb="md">
          {/* POSTE ACOMETIDA */}
          <Box>
            <Text size="sm" fw={700} mb="xs" td="underline">POSTE ACOMETIDA:</Text>
            <Stack gap="xs">
              <NumberInput
                label="Altura (mts):"
                placeholder="Ej. 3"
                value={parseFloat(se.height) || ''}
                onChange={(v) => setReport(setInfrastructureDetails(report, {
                  service_entrance: { ...se, height: String(v) },
                }))}
                suffix=" mts"
              />
              <Select
                label="Material:"
                placeholder="Seleccione"
                data={['Concreto', 'Fibra']}
                value={se.material}
                onChange={(v) => setReport(setInfrastructureDetails(report, {
                  service_entrance: { ...se, material: v || '' },
                }))}
              />
            </Stack>
          </Box>

          {/* POSTE PUNTO DE CÁMARA */}
          <Box>
            <Text size="sm" fw={700} mb="xs" td="underline">POSTE PUNTO DE CÁMARA:</Text>
            <Stack gap="xs">
              <NumberInput
                label="Altura (mts):"
                placeholder="Ej. 3"
                value={parseFloat(cp.height) || ''}
                onChange={(v) => setReport(setInfrastructureDetails(report, {
                  camera_point: { ...cp, height: String(v) },
                }))}
                suffix=" mts"
              />
              <Select
                label="Material:"
                placeholder="Seleccione"
                data={['Concreto', 'Fibra', 'Metal']}
                value={cp.material}
                onChange={(v) => setReport(setInfrastructureDetails(report, {
                  camera_point: { ...cp, material: v || '' },
                }))}
              />
            </Stack>
          </Box>
        </Stack>
      </Box>
    </Stack>
  );
}
