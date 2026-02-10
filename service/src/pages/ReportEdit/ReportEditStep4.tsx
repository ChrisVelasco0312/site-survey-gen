import { useRef, useState, useEffect, useCallback } from 'preact/hooks';
import {
  Stack,
  Text,
  Box,
  Alert,
  FileInput,
  Button,
  Slider,
  Group,
} from '@mantine/core';
import { IconDownload } from '@tabler/icons-react';
import type { Report } from '../../types/Report';

/* ── Constants ─────────────────────────────────────────────── */

const DEFAULT_LAT = 4.5709;
const DEFAULT_LON = -74.2973;
const TILE_SIZE = 256;
const GRID = 3; // 3×3 tiles
const CANVAS_PX = TILE_SIZE * GRID; // 768
const ZOOM_MIN = 15;
const ZOOM_MAX = 19;
const ZOOM_DEFAULT = 17;

/* ── Tile math ─────────────────────────────────────────────── */

function latLonToTile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Load a single OSM tile as an Image. OSM serves Access-Control-Allow-Origin: *
 *  so crossOrigin='anonymous' is enough — no proxy needed. */
function loadTile(z: number, x: number, y: number): Promise<HTMLImageElement> {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Tile ${z}/${x}/${y} failed`));
    img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  });
}

/** Render a GRID×GRID tile mosaic centered on (lat, lon) onto the given canvas. */
async function renderTilesToCanvas(
  canvas: HTMLCanvasElement,
  lat: number,
  lon: number,
  zoom: number,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.width = CANVAS_PX;
  canvas.height = CANVAS_PX;

  // Clear with a neutral background while tiles load
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

  const center = latLonToTile(lat, lon, zoom);
  const max = 2 ** zoom - 1;
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const half = Math.floor(GRID / 2);

  for (let dy = 0; dy < GRID; dy++) {
    for (let dx = 0; dx < GRID; dx++) {
      const tx = clamp(center.x - half + dx);
      const ty = clamp(center.y - half + dy);
      try {
        const img = await loadTile(zoom, tx, ty);
        ctx.drawImage(img, dx * TILE_SIZE, dy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      } catch {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(dx * TILE_SIZE, dy * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Draw crosshair at center
  const cx = CANVAS_PX / 2;
  const cy = CANVAS_PX / 2;
  ctx.strokeStyle = 'rgba(220, 50, 50, 0.8)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 12, cy);
  ctx.lineTo(cx + 12, cy);
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, cy + 12);
  ctx.stroke();
}

/* ── Component ─────────────────────────────────────────────── */

interface ReportEditStep4Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

export function ReportEditStep4({ report, setReport, readOnly }: ReportEditStep4Props) {
  const hasCoords = report.address.latitude !== 0 || report.address.longitude !== 0;
  const lat = hasCoords ? report.address.latitude : DEFAULT_LAT;
  const lon = hasCoords ? report.address.longitude : DEFAULT_LON;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [loading, setLoading] = useState(false);

  const hasEditedMap = Boolean(report.edited_map_image_url?.trim());

  // Re-render tiles whenever lat, lon or zoom changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoading(true);
    renderTilesToCanvas(canvas, lat, lon, zoom).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lat, lon, zoom]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `mapa-sitio-${report.address.pm_number || report.id}.png`;
    a.click();
  }, [report.address.pm_number, report.id]);

  const onDiagramFileChange = (file: File | null) => {
    if (!file) {
      setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setReport({ ...report, edited_map_image_url: reader.result as string, updated_at: Date.now() });
    };
    reader.readAsDataURL(file);
  };

  const clearDiagram = () => {
    setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
  };

  /* ── Read-only view ── */
  if (readOnly) {
    return (
      <Stack gap="lg">
        <Box>
          <Text size="sm" fw={500} c="dimmed" mb="sm">Ubicación en mapa</Text>
          {!hasCoords ? (
            <Text size="sm" c="dimmed">Sin coordenadas (complete el paso 1).</Text>
          ) : (
            <Box style={{ width: '100%', maxWidth: CANVAS_PX, borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
          )}
        </Box>
        <Box>
          <Text size="sm" fw={500} c="dimmed" mb="sm">Diagrama del sitio editado</Text>
          {hasEditedMap ? (
            <Box style={{ maxWidth: 400, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <img src={report.edited_map_image_url} alt="Diagrama del sitio" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
          ) : (
            <Text size="sm" c="dimmed">—</Text>
          )}
        </Box>
      </Stack>
    );
  }

  /* ── Editable view ── */
  return (
    <Stack gap="xl">
      {/* ── Map section ── */}
      <Box
        style={{
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
        }}
      >
        {/* Map canvas */}
        <Box style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
          {loading && (
            <Box
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,0.6)',
              }}
            >
              <Text size="sm" c="dimmed">Cargando mapa…</Text>
            </Box>
          )}
        </Box>

        {/* Controls bar below the map */}
        <Box
          style={{
            padding: 'var(--mantine-spacing-sm) var(--mantine-spacing-md)',
            borderTop: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
          }}
        >
          {!hasCoords && (
            <Alert color="blue" mb="sm">
              Complete la dirección en el paso 1 para ver la ubicación exacta.
            </Alert>
          )}

          <Group align="flex-end" gap="md" wrap="wrap">
            <Box style={{ flex: 1, minWidth: 160, paddingBottom: 16 }}>
              <Text size="xs" fw={500} mb={4}>Zoom: {zoom}</Text>
              <Slider
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                value={zoom}
                onChange={setZoom}
                marks={[
                  { value: ZOOM_MIN, label: String(ZOOM_MIN) },
                  { value: ZOOM_MAX, label: String(ZOOM_MAX) },
                ]}
              />
            </Box>
            <Button
              leftSection={<IconDownload size={14} />}
              variant="light"
              size="xs"
              onClick={handleDownload}
              disabled={loading}
            >
              Descargar imagen
            </Button>
          </Group>
        </Box>
      </Box>

      <Text size="xs" c="dimmed" mt={-12}>
        Ajuste el zoom, descargue la imagen, edítela externamente con las señales de instalación y súbala abajo.
      </Text>

      {/* ── Diagram upload section ── */}
      <Stack gap="sm">
        <Text size="sm" fw={500}>Imagen del diagrama editado</Text>

        {!hasEditedMap && (
          <Alert color="orange">
            La imagen del diagrama editado es obligatoria para enviar el reporte a revisión.
          </Alert>
        )}

        {hasEditedMap ? (
          <Stack gap="sm">
            <Box style={{ maxWidth: 400, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
              <img src={report.edited_map_image_url} alt="Diagrama del sitio" style={{ width: '100%', height: 'auto', display: 'block' }} />
            </Box>
            <Group gap="xs">
              <FileInput accept="image/*" placeholder="Cambiar imagen" onChange={onDiagramFileChange} style={{ flex: '1', minWidth: 140 }} />
              <Button variant="light" color="red" size="xs" onClick={clearDiagram}>
                Quitar imagen
              </Button>
            </Group>
          </Stack>
        ) : (
          <FileInput
            accept="image/*"
            placeholder="Seleccionar imagen del diagrama"
            onChange={onDiagramFileChange}
          />
        )}
      </Stack>
    </Stack>
  );
}
