import { useMemo } from "preact/hooks";
import {
  Stack,
  Text,
  Select,
  NumberInput,
  TextInput,
  MultiSelect,
  Switch,
  Group,
  Divider,
  Box,
} from "@mantine/core";
import type { Report, LprSurvey } from "../../types/Report";

interface ReportEditLprProps {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditLpr({
  report,
  setReport,
  readOnly,
}: ReportEditLprProps) {
  const survey = report.lpr_survey || {};

  const handleChange = (key: keyof LprSurvey, value: any) => {
    setReport({
      ...report,
      lpr_survey: {
        ...survey,
        [key]: value,
      },
      updated_at: Date.now(),
    });
  };

  const SENTIDO_VIAL_OPTIONS = [
    {
      group: "Unidireccional",
      items: [
        { value: "unidireccional_norte_sur", label: "Norte → Sur" },
        { value: "unidireccional_sur_norte", label: "Sur → Norte" },
        {
          value: "unidireccional_oriente_occidente",
          label: "Oriente → Occidente",
        },
        {
          value: "unidireccional_occidente_oriente",
          label: "Occidente → Oriente",
        },
        {
          value: "unidireccional_nororiente_suroccidente",
          label: "Nororiente → Suroccidente",
        },
        {
          value: "unidireccional_noroeste_sureste",
          label: "Noroeste → Sureste",
        },
      ],
    },
    {
      group: "Bidireccional",
      items: [
        { value: "bidireccional_norte_sur", label: "Norte ⇄ Sur" },
        { value: "bidireccional_sur_norte", label: "Sur ⇄ Norte" },
        {
          value: "bidireccional_oriente_occidente",
          label: "Oriente ⇄ Occidente",
        },
        {
          value: "bidireccional_occidente_oriente",
          label: "Occidente ⇄ Oriente",
        },
        {
          value: "bidireccional_nororiente_suroccidente",
          label: "Nororiente ⇄ Suroccidente",
        },
        {
          value: "bidireccional_noroeste_sureste",
          label: "Noroeste ⇄ Sureste",
        },
      ],
    },
  ];

  const getSentidoVialLabel = (val?: string) => {
    for (const group of SENTIDO_VIAL_OPTIONS) {
      const item = group.items.find((i) => i.value === val);
      if (item) return `${group.group} - ${item.label}`;
    }
    return "—";
  };

  const anguloHorizontalEstimadoLable = useMemo(() => {
    if (survey.angulo_horizontal === "menor_30") return "< 30° (Recomendado)";
    if (survey.angulo_horizontal === "30_a_45") return "30° - 45°";
    if (survey.angulo_horizontal === "mayor_45") return "> 45°";
    return "—";
  }, [survey.angulo_horizontal]);

  if (readOnly) {
    return (
      <Stack gap="md">
        <Text fw={600} size="lg">
          1. Información Vial
        </Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Sentido vial de la vía
            </Text>
            <Text>{getSentidoVialLabel(survey.sentido_vial)}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Número de carriles
            </Text>
            <Text>
              {survey.numero_carriles
                ? survey.numero_carriles === 4
                  ? "4 o más carriles"
                  : `${survey.numero_carriles} carril${survey.numero_carriles > 1 ? "es" : ""}`
                : "—"}
            </Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">
          2. Ubicación de la Cámara
        </Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Distancia cámara – punto de captura (m)
            </Text>
            <Text>{survey.distancia_camara_placas ?? "—"}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Altura estimada de instalación (m)
            </Text>
            <Text>{survey.altura_instalacion ?? "—"}</Text>
          </Box>
        </Group>
        <Group mt="xs">
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Ángulo horizontal estimado
            </Text>
            <Text>{anguloHorizontalEstimadoLable}</Text>
          </Box>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Ángulo vertical estimado (°)
            </Text>
            <Text>{survey.angulo_vertical ?? "—"}</Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">
          3. Campo de Visión (FOV)
        </Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Campo de visión requerido cubre
            </Text>
            <Text>
              {survey.fov_carriles
                ? survey.fov_carriles === 4
                  ? "Más de 3 carriles"
                  : `${survey.fov_carriles} carril${survey.fov_carriles > 1 ? "es" : ""}`
                : "—"}
            </Text>
          </Box>
        </Group>
        <Group mt="xs">
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              ¿Existe algún obstáculo dentro del FOV?
            </Text>
            <Text>{survey.obstaculo_fov ? "Sí" : "No"}</Text>
          </Box>
          {survey.obstaculo_fov && (
            <Box>
              <Text size="sm" fw={500} c="dimmed">
                Detalle del obstáculo
              </Text>
              <Text>{survey.obstaculo_descripcion || "—"}</Text>
            </Box>
          )}
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">
          4. Condiciones de Iluminación
        </Text>
        <Group>
          <Box>
            <Text size="sm" fw={500} c="dimmed">
              Iluminación existente en el punto
            </Text>
            <Text>
              {survey.iluminacion_estado === "con_iluminacion_publica"
                ? "Con iluminación pública"
                : survey.iluminacion_estado === "sin_iluminacion_publica"
                  ? "Sin iluminación pública"
                  : "—"}
            </Text>
          </Box>
        </Group>

        <Divider my="sm" />
        <Text fw={600} size="lg">
          5. Observaciones Técnicas
        </Text>
        <Box>
          <Text size="sm" fw={500} c="dimmed">
            Condiciones relevantes del sitio
          </Text>
          <Text>
            {survey.condiciones_sitio
              ?.map((c: string) =>
                c === "otros"
                  ? `Otros: ${survey.condiciones_sitio_otros || ""}`
                  : c.replace("_", " "),
              )
              .join(", ") || "Ninguna"}
          </Text>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">
        1. Información Vial
      </Text>
      <Select
        label="Sentido vial de la vía"
        data={SENTIDO_VIAL_OPTIONS}
        value={survey.sentido_vial || null}
        onChange={(val) => handleChange("sentido_vial", val)}
        clearable
        searchable
      />
      <Select
        label="Número de carriles"
        data={[
          { value: "1", label: "1 carril" },
          { value: "2", label: "2 carriles" },
          { value: "3", label: "3 carriles" },
          { value: "4", label: "4 o más carriles" },
        ]}
        value={survey.numero_carriles ? String(survey.numero_carriles) : null}
        onChange={(val) =>
          handleChange("numero_carriles", val ? Number(val) : undefined)
        }
        clearable
      />

      <Divider my="sm" />
      <Text fw={600} size="lg">
        2. Ubicación de la Cámara
      </Text>
      <Group grow>
        <NumberInput
          label="Distancia cámara – punto de captura (m)"
          description="Línea de placas"
          value={survey.distancia_camara_placas ?? ""}
          onChange={(val) =>
            handleChange(
              "distancia_camara_placas",
              val === "" ? undefined : Number(val),
            )
          }
          min={0}
        />
        <NumberInput
          label="Altura estimada de instalación (m)"
          value={survey.altura_instalacion ?? ""}
          onChange={(val) =>
            handleChange(
              "altura_instalacion",
              val === "" ? undefined : Number(val),
            )
          }
          min={0}
        />
      </Group>
      <Group grow>
        <Select
          label="Ángulo horizontal estimado respecto al vehículo"
          data={[
            { value: "menor_30", label: "< 30° (Recomendado)" },
            { value: "30_a_45", label: "30° - 45°" },
            { value: "mayor_45", label: "> 45°" },
          ]}
          value={survey.angulo_horizontal || null}
          onChange={(val) => handleChange("angulo_horizontal", val)}
          clearable
        />
        <NumberInput
          label="Ángulo vertical estimado (°)"
          value={survey.angulo_vertical ?? ""}
          onChange={(val) =>
            handleChange(
              "angulo_vertical",
              val === "" ? undefined : Number(val),
            )
          }
        />
      </Group>

      <Divider my="sm" />
      <Text fw={600} size="lg">
        3. Campo de Visión (FOV)
      </Text>
      <Select
        label="Campo de visión requerido cubre"
        data={[
          { value: "1", label: "1 carril" },
          { value: "2", label: "2 carriles" },
          { value: "3", label: "3 carriles" },
          { value: "4", label: "Más de 3 carriles" },
        ]}
        value={survey.fov_carriles ? String(survey.fov_carriles) : null}
        onChange={(val) =>
          handleChange("fov_carriles", val ? Number(val) : undefined)
        }
        clearable
      />
      <Switch
        label="¿Existe algún obstáculo dentro del FOV?"
        checked={!!survey.obstaculo_fov}
        onChange={(e) => handleChange("obstaculo_fov", e.currentTarget.checked)}
      />
      {survey.obstaculo_fov && (
        <TextInput
          label="¿Cuál obstáculo?"
          description="Árboles, postes, señales, cables, puentes, etc."
          value={survey.obstaculo_descripcion || ""}
          onChange={(e) =>
            handleChange("obstaculo_descripcion", e.currentTarget.value)
          }
        />
      )}

      <Divider my="sm" />
      <Text fw={600} size="lg">
        4. Condiciones de Iluminación
      </Text>
      <Select
        label="Iluminación existente en el punto"
        data={[
          {
            value: "con_iluminacion_publica",
            label: "Con iluminación pública",
          },
          {
            value: "sin_iluminacion_publica",
            label: "Sin iluminación pública",
          },
        ]}
        value={survey.iluminacion_estado || null}
        onChange={(val) => handleChange("iluminacion_estado", val)}
        clearable
      />

      <Divider my="sm" />
      <Text fw={600} size="lg">
        5. Observaciones Técnicas
      </Text>
      <MultiSelect
        label="Condiciones relevantes del sitio"
        data={[
          { value: "riesgo_electrico", label: "Riesgo eléctrico cercano" },
          { value: "cables_aereos", label: "Presencia de cables aéreos" },
          {
            value: "obra_interferencias",
            label: "Zona de obra o interferencias",
          },
          { value: "alto_flujo", label: "Alto flujo vehicular" },
          { value: "otros", label: "Otros" },
        ]}
        value={survey.condiciones_sitio || []}
        onChange={(val) => handleChange("condiciones_sitio", val)}
        clearable
      />
      {survey.condiciones_sitio?.includes("otros") && (
        <TextInput
          label="Especifique otras condiciones"
          value={survey.condiciones_sitio_otros || ""}
          onChange={(e) =>
            handleChange("condiciones_sitio_otros", e.currentTarget.value)
          }
        />
      )}
    </Stack>
  );
}
