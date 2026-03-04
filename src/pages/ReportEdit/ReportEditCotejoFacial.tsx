import { useMemo } from 'preact/hooks';
import {
  Stack,
  Text,
  Select,
  NumberInput,
  TextInput,
  Textarea,
  MultiSelect,
  Switch,
  Group,
  Divider,
  Box,
} from '@mantine/core';
import type { Report, CotejoFacialSurvey } from '../../types/Report';

interface ReportEditCotejoFacialProps {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditCotejoFacial({ report, setReport, readOnly }: ReportEditCotejoFacialProps) {
  const survey = report.cotejo_facial_survey || {};

  const handleChange = (key: keyof CotejoFacialSurvey, value: any) => {
    setReport({
      ...report,
      cotejo_facial_survey: {
        ...survey,
        [key]: value,
      },
      updated_at: Date.now(),
    });
  };

  if (readOnly) {
    return (
      <Stack gap="md">
        <Text fw={600} size="lg">1. Clasificación de la Zona</Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Tipo de zona</Text>
            <Text>{survey.zona_tipo || '—'}</Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">2. Especificaciones de Instalación Física</Text>
        <Stack gap="xs">
          <Text size="sm" fw={500} c="dimmed">Tipo de estructura</Text>
          <Text>{survey.estructura_tipo === 'otro' ? `Otro: ${survey.estructura_otro}` : (survey.estructura_tipo || '—')}</Text>

          <Group>
            <Box>
              <Text size="sm" fw={500} c="dimmed">Altura proyectada (m)</Text>
              <Text>{survey.altura_proyectada ?? '—'}</Text>
            </Box>
            <Box>
              <Text size="sm" fw={500} c="dimmed">Distancia rostro - Cámara (m)</Text>
              <Text>{survey.distancia_rostro_camara ?? '—'}</Text>
            </Box>
          </Group>

          <Text size="sm" fw={500} c="dimmed">Área de cobertura estimada</Text>
          <Text>{survey.area_cobertura || '—'}</Text>

          <Group>
            <Box>
              <Text size="sm" fw={500} c="dimmed">Ángulo horizontal estimado (°)</Text>
              <Text>{survey.angulo_horizontal ?? '—'}</Text>
            </Box>
            <Box>
              <Text size="sm" fw={500} c="dimmed">Ángulo vertical estimado (°)</Text>
              <Text>{survey.angulo_vertical ?? '—'}</Text>
            </Box>
          </Group>
        </Stack>

        <Divider my="sm" />
        <Text fw={600} size="lg">3. Condiciones de Iluminación</Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Estado actual</Text>
            <Text>{survey.iluminacion_estado === 'con_iluminacion' ? 'Con iluminación' : survey.iluminacion_estado === 'sin_iluminacion' ? 'Sin iluminación' : '—'}</Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">4. Conectividad y Energía</Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Punto eléctrico cercano</Text>
            <Text>{survey.punto_electrico_cercano ? 'Sí' : 'No'}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Distancia al punto eléctrico (m)</Text>
            <Text>{survey.distancia_punto_electrico ?? '—'}</Text>
          </Box>
        </Group>
        <Group mt="xs">
          <Box>
            <Text size="sm" fw={500} c="dimmed">Tipo de enlace proyectado</Text>
            <Text>{survey.tipo_enlace === 'fibra_optica' ? 'Fibra Óptica' : survey.tipo_enlace === 'inalambrico' ? 'Inalámbrico' : '—'}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">Distancia estimada de canalización (m)</Text>
            <Text>{survey.distancia_canalizacion ?? '—'}</Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">5. Evaluación de Riesgos y Entorno</Text>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Riesgos identificados</Text>
          <Text>{survey.riesgos_identificados?.join(', ') || 'Ninguno'}</Text>
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed">Detalle de riesgos</Text>
          <Text>{survey.detalle_riesgos || '—'}</Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">1. Clasificación de la Zona</Text>
      <Group grow>
        <Select
          label="Tipo de zona"
          data={[
            { value: 'peatonal', label: 'Peatonal' },
            { value: 'mixta', label: 'Mixta (peatonal - vehicular)' },
          ]}
          value={survey.zona_tipo || null}
          onChange={(val) => handleChange('zona_tipo', val)}
          clearable
        />
      </Group>

      <Divider my="sm" />
      <Text fw={600} size="lg">2. Especificaciones de Instalación Física</Text>
      <Select
        label="Tipo de estructura"
        data={[
          { value: 'poste', label: 'Poste' },
          { value: 'muro', label: 'Muro' },
          { value: 'techo', label: 'Techo' },
          { value: 'portico', label: 'Pórtico' },
          { value: 'otro', label: 'Otro' },
        ]}
        value={survey.estructura_tipo || null}
        onChange={(val) => handleChange('estructura_tipo', val)}
        clearable
      />
      {survey.estructura_tipo === 'otro' && (
        <TextInput
          label="Especifique otro tipo de estructura"
          value={survey.estructura_otro || ''}
          onChange={(e) => handleChange('estructura_otro', e.currentTarget.value)}
        />
      )}

      <Group grow>
        <NumberInput
          label="Altura proyectada de instalación (m)"
          description="Ideal: 3 - 5 m"
          value={survey.altura_proyectada ?? ''}
          onChange={(val) => handleChange('altura_proyectada', val === '' ? undefined : Number(val))}
          min={0}
        />
        <NumberInput
          label="Distancia rostro - Cámara (m)"
          description="Recomendado: 2 - 6 m"
          value={survey.distancia_rostro_camara ?? ''}
          onChange={(val) => handleChange('distancia_rostro_camara', val === '' ? undefined : Number(val))}
          min={0}
        />
      </Group>

      <TextInput
        label="Área de cobertura estimada"
        value={survey.area_cobertura || ''}
        onChange={(e) => handleChange('area_cobertura', e.currentTarget.value)}
      />

      <Group grow>
        <NumberInput
          label="Ángulo horizontal estimado (°)"
          description="Recomendado: < 30°"
          value={survey.angulo_horizontal ?? ''}
          onChange={(val) => handleChange('angulo_horizontal', val === '' ? undefined : Number(val))}
        />
        <NumberInput
          label="Ángulo vertical estimado (°)"
          value={survey.angulo_vertical ?? ''}
          onChange={(val) => handleChange('angulo_vertical', val === '' ? undefined : Number(val))}
        />
      </Group>

      <Divider my="sm" />
      <Text fw={600} size="lg">3. Condiciones de Iluminación</Text>
      <Group grow>
        <Select
          label="Estado actual"
          data={[
            { value: 'con_iluminacion', label: 'Con iluminación' },
            { value: 'sin_iluminacion', label: 'Sin iluminación' },
          ]}
          value={survey.iluminacion_estado || null}
          onChange={(val) => handleChange('iluminacion_estado', val)}
          clearable
        />
      </Group>

      <Divider my="sm" />
      <Text fw={600} size="lg">4. Conectividad y Energía</Text>
      <Switch
        label="Punto eléctrico cercano"
        checked={!!survey.punto_electrico_cercano}
        onChange={(e) => handleChange('punto_electrico_cercano', e.currentTarget.checked)}
      />
      <NumberInput
        label="Distancia al punto eléctrico (m)"
        value={survey.distancia_punto_electrico ?? ''}
        onChange={(val) => handleChange('distancia_punto_electrico', val === '' ? undefined : Number(val))}
        min={0}
      />
      <Group grow>
        <Select
          label="Tipo de enlace proyectado"
          data={[
            { value: 'fibra_optica', label: 'Fibra Óptica' },
            { value: 'inalambrico', label: 'Inalámbrico' },
          ]}
          value={survey.tipo_enlace || null}
          onChange={(val) => handleChange('tipo_enlace', val)}
          clearable
        />
        <NumberInput
          label="Distancia estimada de canalización (m)"
          value={survey.distancia_canalizacion ?? ''}
          onChange={(val) => handleChange('distancia_canalizacion', val === '' ? undefined : Number(val))}
          min={0}
        />
      </Group>

      <Divider my="sm" />
      <Text fw={600} size="lg">5. Evaluación de Riesgos y Entorno</Text>
      <MultiSelect
        label="Riesgos identificados"
        data={[
          { value: 'vandalismo', label: 'Vandalismo' },
          { value: 'contraluz', label: 'Contraluz' },
          { value: 'sombras', label: 'Sombras marcadas' },
          { value: 'obstaculos', label: 'Obstáculos' },
          { value: 'alto_trafico', label: 'Alto tráfico peatonal' },
        ]}
        value={survey.riesgos_identificados || []}
        onChange={(val) => handleChange('riesgos_identificados', val)}
        clearable
      />
      <Textarea
        label="Detalle de riesgos"
        value={survey.detalle_riesgos || ''}
        onChange={(e) => handleChange('detalle_riesgos', e.currentTarget.value)}
        minRows={3}
      />
    </Stack>
  );
}
