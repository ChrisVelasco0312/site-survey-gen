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
  SegmentedControl,
  Center,
  ThemeIcon,
} from '@mantine/core';
import {
  IconDownload,
  IconExternalLink,
  IconWifiOff,
  IconEdit,
} from '@tabler/icons-react';
import type { Report } from '../../types/Report';
import { useConnectivity } from '../../hooks/useConnectivity';
import { ImageEditor } from '../../components/ImageEditor/ImageEditor';

/* ── Constants ─────────────────────────────────────────────── */

const DEFAULT_LAT = 4.5709;
const DEFAULT_LON = -74.2973;
const TILE_SIZE = 256;
const GRID_W = 7; // Covers 1792px width
const GRID_H = 4; // Covers 1024px height
// Exact resolution requested by user
const CANVAS_WIDTH = 1732;
const CANVAS_HEIGHT = 974;
const ZOOM_MIN = 15;
const ZOOM_MAX = 21;
const ZOOM_DEFAULT = 17;
const MAX_NATIVE_ZOOM = 19;

/* ── Tile math ─────────────────────────────────────────────── */

function latLonToTile(lat: number, lon: number, z: number) {
  const n = 2 ** z;
  const x = Math.floor(((lon + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Load a single OSM or Satellite tile as an Image. Supports digital zoom beyond MAX_NATIVE_ZOOM. */
async function loadTile(z: number, x: number, y: number, type: 'osm' | 'satellite'): Promise<CanvasImageSource> {
  if (z <= MAX_NATIVE_ZOOM) {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Tile ${z}/${x}/${y} failed`));
      if (type === 'satellite') {
        // Esri World Imagery (uses z/y/x ordering in REST URL)
        img.src = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
      } else {
        // OpenStreetMap (standard z/x/y)
        img.src = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
      }
    });
  }

  // Overzoom logic: fetch parent tile from MAX_NATIVE_ZOOM and crop/scale
  const scale = 2 ** (z - MAX_NATIVE_ZOOM);
  const xParent = Math.floor(x / scale);
  const yParent = Math.floor(y / scale);
  
  const parentImg = await loadTile(MAX_NATIVE_ZOOM, xParent, yParent, type);

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const cropSize = TILE_SIZE / scale;
  const srcX = (x % scale) * cropSize;
  const srcY = (y % scale) * cropSize;

  ctx.drawImage(parentImg, srcX, srcY, cropSize, cropSize, 0, 0, TILE_SIZE, TILE_SIZE);
  return canvas;
}

/** Render a GRID×GRID tile mosaic centered on (lat, lon) onto the given canvas. */
async function renderTilesToCanvas(
  canvas: HTMLCanvasElement,
  lat: number,
  lon: number,
  zoom: number,
  type: 'osm' | 'satellite',
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Handle fractional zoom:
  // We load tiles for the integer zoom level (intZoom)
  // and scale the canvas context by the fractional difference.
  const intZoom = Math.floor(zoom);
  const scale = 2 ** (zoom - intZoom);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  // Reset transform to identity before clearing
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Clear with a neutral background while tiles load
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const center = latLonToTile(lat, lon, intZoom);
  const max = 2 ** intZoom - 1;
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const halfW = Math.floor(GRID_W / 2);
  const halfH = Math.floor(GRID_H / 2);

  // Calculate offsets to center the TILE_SIZE*GRID grid within the custom CANVAS size
  const gridPixelWidth = GRID_W * TILE_SIZE;
  const gridPixelHeight = GRID_H * TILE_SIZE;
  const offsetX = (CANVAS_WIDTH - gridPixelWidth) / 2;
  const offsetY = (CANVAS_HEIGHT - gridPixelHeight) / 2;

  // Apply scaling for fractional zoom, centered on the canvas
  const scaleCx = CANVAS_WIDTH / 2;
  const scaleCy = CANVAS_HEIGHT / 2;
  ctx.translate(scaleCx, scaleCy);
  ctx.scale(scale, scale);
  ctx.translate(-scaleCx, -scaleCy);

  for (let dy = 0; dy < GRID_H; dy++) {
    for (let dx = 0; dx < GRID_W; dx++) {
      const tx = clamp(center.x - halfW + dx);
      const ty = clamp(center.y - halfH + dy);
      const drawX = Math.floor(dx * TILE_SIZE + offsetX);
      const drawY = Math.floor(dy * TILE_SIZE + offsetY);

      try {
        const img = await loadTile(intZoom, tx, ty, type);
        ctx.drawImage(img, drawX, drawY, TILE_SIZE, TILE_SIZE);
      } catch {
        ctx.fillStyle = '#ddd';
        ctx.fillRect(drawX, drawY, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Reset transform to draw crosshair crisp and centered (ignoring zoom scale? No, crosshair should stay centered)
  // Actually, usually crosshair is UI overlay, but here it is burnt into canvas.
  // If we scale the map, we probably want the crosshair to remain constant size or scale?
  // Constant size is usually better for a "sight".
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  // Draw crosshair at center
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
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
  const [mapType, setMapType] = useState<'osm' | 'satellite'>('osm');
  const [loading, setLoading] = useState(false);
  const [imageWarning, setImageWarning] = useState<string | null>(null);
  const isOnline = useConnectivity();

  /* ── Editor State ── */
  const [isEditing, setIsEditing] = useState(false);
  
  const hasEditedMap = Boolean(report.edited_map_image_url?.trim());

  // Re-render tiles whenever lat, lon or zoom changes
  useEffect(() => {
    if (!isOnline) {
      setLoading(false);
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    setLoading(true);
    renderTilesToCanvas(canvas, lat, lon, zoom, mapType).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [lat, lon, zoom, isOnline, mapType, isEditing]); // Added isEditing to re-render map when switching to edit mode

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
    setImageWarning(null);
    if (!file) {
      setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      // Validate image dimensions/ratio
      const img = new Image();
      img.onload = () => {
        const { width, height } = img;
        const ratio = width / height;
        // Ideal: ~1.77 (16:9). Accept 1.5 to 2.0. Min width 1000px.
        const isRatioOk = ratio >= 1.5 && ratio <= 2.2;
        const isResOk = width >= 1000;
        
        if (!isRatioOk || !isResOk) {
          setImageWarning(
            'Para un ajuste perfecto en el PDF, se recomienda una imagen de 1732x974 píxeles (aprox. 16:9) y alta resolución.'
          );
        }
        setReport({ ...report, edited_map_image_url: result, updated_at: Date.now() });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  };

  const clearDiagram = () => {
    setImageWarning(null);
    setReport({ ...report, edited_map_image_url: undefined, updated_at: Date.now() });
  };

  const handleSaveEdit = (dataUrl: string) => {
    setReport({ ...report, edited_map_image_url: dataUrl, updated_at: Date.now() });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
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
            <Box style={{ width: '100%', maxWidth: 800, borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
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
        {isOnline ? (
          <>
            {isEditing ? (
                <Box p="sm">
                    <ImageEditor
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        baseCanvasRef={canvasRef}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                    >
                        <canvas
                            ref={canvasRef}
                            style={{ width: '100%', height: 'auto', display: 'block' }}
                        />
                    </ImageEditor>
                </Box>
            ) : (
                <>
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
                            <Box>
                            <Text size="xs" fw={500} mb={4}>Tipo de mapa</Text>
                            <SegmentedControl
                                size="xs"
                                value={mapType}
                                onChange={(val) => setMapType(val as 'osm' | 'satellite')}
                                data={[
                                { label: 'Mapa', value: 'osm' },
                                { label: 'Satélite', value: 'satellite' },
                                ]}
                            />
                            </Box>
                            <Box style={{ flex: 1, minWidth: 160, paddingBottom: 16 }}>
                            <Text size="xs" fw={500} mb={4}>
                                Zoom: {zoom.toFixed(1)} {zoom > 20 && <span style={{ color: 'red' }}>(Digital)</span>}
                            </Text>
                            <Slider
                                min={ZOOM_MIN}
                                max={ZOOM_MAX}
                                step={0.1}
                                color={zoom > 20 ? 'red' : 'blue'}
                                value={zoom}
                                onChange={setZoom}
                                marks={[
                                { value: ZOOM_MIN, label: String(ZOOM_MIN) },
                                { value: 20, label: '20' },
                                { value: ZOOM_MAX, label: String(ZOOM_MAX) },
                                ]}
                            />
                            </Box>
                            
                            <Button
                                leftSection={<IconEdit size={14} />}
                                variant="filled"
                                color="grape"
                                size="xs"
                                onClick={() => setIsEditing(true)}
                                disabled={loading}
                            >
                                Editar Mapa
                            </Button>

                            <Button
                            leftSection={<IconDownload size={14} />}
                            variant="light"
                            size="xs"
                            onClick={handleDownload}
                            disabled={loading}
                            >
                            Descargar
                            </Button>
                            
                            {hasCoords && (
                            <Button
                                component="a"
                                href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="subtle"
                                size="xs"
                                leftSection={<IconExternalLink size={14} />}
                            >
                                Google Maps
                            </Button>
                            )}
                        </Group>
                    </Box>
                </>
            )}
          </>
        ) : (
          /* Offline placeholder */
          <Box p="xl">
            <Center style={{ flexDirection: 'column', gap: 16 }}>
              <ThemeIcon variant="light" color="gray" size={64} radius="xl">
                <IconWifiOff size={32} />
              </ThemeIcon>
              <Text ta="center" size="sm" fw={500}>
                Sin conexión a internet
              </Text>
              <Text ta="center" size="xs" c="dimmed" style={{ maxWidth: 300 }}>
                Para visualizar el mapa satelital y descargar la imagen base, es necesaria una conexión a internet activa.
              </Text>
              {hasCoords && (
                <Button
                  component="a"
                  href={`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outline"
                  size="sm"
                  leftSection={<IconExternalLink size={16} />}
                >
                  Abrir ubicación en Google Maps
                </Button>
              )}
            </Center>
          </Box>
        )}
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
            {imageWarning && (
              <Alert color="yellow" title="Sugerencia de imagen">
                {imageWarning}
              </Alert>
            )}
            <Box style={{ maxWidth: 500, border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
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
