import { useCallback, useEffect, useRef, useState } from 'preact/hooks';
import {
  Stack,
  Text,
  Box,
  FileInput,
  Button,
  Group,
  Alert,
  Loader,
  Modal,
  Checkbox,
  ActionIcon,
} from '@mantine/core';
import { IconPhoto, IconTrash, IconEdit, IconCheck, IconAlertCircle, IconEye, IconZoomIn, IconZoomOut, IconRefresh, IconDownload } from '@tabler/icons-react';
import { buildWatermarkedImage } from '../../utils/watermark';
import imageCompression from 'browser-image-compression';
import type { Report } from '../../types/Report';
import { Shape } from '../../types/Shape';
import { clearImageSourceUrls } from '../../utils/reportImagesStorage';
import { ImageEditor } from '../../components/ImageEditor/ImageEditor';
import { StorageImage } from '../../components/StorageImage/StorageImage';
import { resolveStorageUrl } from '../../hooks/useStorageUrl';

/* ── Helpers ──────────────────────────────────────────────── */

async function resolveImageSource(src: string): Promise<string> {
  if (!src) throw new Error('No image source provided');
  if (src.startsWith('data:')) return src;
  return await resolveStorageUrl(src);
}

let cachedLogoDataUrl: string | null = null;
async function getPublicLogoDataUrl(): Promise<string> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  const res = await fetch('/logo_transparent.png', { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch logo asset');
  const blob = await res.blob();
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert logo to data URL'));
    reader.readAsDataURL(blob);
  });
  cachedLogoDataUrl = dataUrl;
  return dataUrl;
}

/* ── Compression options ──────────────────────────────────── */

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,          // Target ≤ 500 KB
  maxWidthOrHeight: 1920,  // Max dimension
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

/* ── Types ────────────────────────────────────────────────── */

interface ReportEditStep4Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
  saveState?: 'idle' | 'pending' | 'saving' | 'saved' | 'error';
}

type PhotoField = 'camera_view_photo_url' | 'service_entrance_photo_url';
type FieldAction = 'upload' | 'delete';
type WatermarkEnabledField = 'camera_view_photo_watermark_enabled' | 'service_entrance_photo_watermark_enabled';

interface PhotoSectionConfig {
  field: PhotoField;
  label: string;
  placeholder: string;
}

interface WatermarkFieldConfig {
  enabledField: WatermarkEnabledField;
  watermarkedField: WatermarkedPhotoField;
}

interface ViewerItem {
  field: PhotoField;
  label: string;
  src: string;
}

const PHOTO_SECTIONS: PhotoSectionConfig[] = [
  {
    field: 'camera_view_photo_url',
    label: 'Visual de cámara',
    placeholder: 'Seleccionar foto de visual de cámara',
  },
  {
    field: 'service_entrance_photo_url',
    label: 'Acometida',
    placeholder: 'Seleccionar foto de acometida',
  },
];

const WATERMARK_CONFIG: Record<PhotoField, WatermarkFieldConfig> = {
  camera_view_photo_url: {
    enabledField: 'camera_view_photo_watermark_enabled',
  },
  service_entrance_photo_url: {
    enabledField: 'service_entrance_photo_watermark_enabled',
  },
};

async function compressAndEncode(file: File): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(compressed);
  });
}

function getPhotoDisplaySource(report: Report, field: PhotoField, previewMap: Partial<Record<PhotoField, string>>): string | undefined {
  const { enabledField } = WATERMARK_CONFIG[field];
  if (report[enabledField] && previewMap[field]) {
    return previewMap[field];
  }
  return report[field];
}

/* ── Component ────────────────────────────────────────────── */

export function ReportEditStep4({ report, setReport, readOnly, saveState = 'idle' }: ReportEditStep4Props) {
  const reportRef = useRef(report);
  const [compressing, setCompressing] = useState<PhotoField | null>(null);
  const [watermarkingField, setWatermarkingField] = useState<PhotoField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<PhotoField | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerImageSrc, setViewerImageSrc] = useState<string | null>(null);
  const [viewerImageLabel, setViewerImageLabel] = useState('Vista de imagen');
  const [viewerItems, setViewerItems] = useState<ViewerItem[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerScale, setViewerScale] = useState(1);
  const [viewerOffset, setViewerOffset] = useState({ x: 0, y: 0 });
  const [viewerDragging, setViewerDragging] = useState(false);
  const [editorImageMeta, setEditorImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [pendingSaveByField, setPendingSaveByField] = useState<Partial<Record<PhotoField, boolean>>>({});
  const [pendingActionByField, setPendingActionByField] = useState<Partial<Record<PhotoField, FieldAction>>>({});
  const clearPendingTimer = useRef<ReturnType<typeof setTimeout>>();
  const watermarkRequestRef = useRef<Record<PhotoField, number>>({
    camera_view_photo_url: 0,
    service_entrance_photo_url: 0,
  });
  const watermarkCacheKeyRef = useRef<Partial<Record<PhotoField, string>>>({});
  const [watermarkedPreview, setWatermarkedPreview] = useState<Partial<Record<PhotoField, string>>>({});
  const viewerDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const viewerLoadRequestRef = useRef(0);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const [viewerShowControls, setViewerShowControls] = useState(false);
  const viewerControlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const viewerDoubleTapRef = useRef<{ lastTap: number }>(null);
  const [hoveredPhotoField, setHoveredPhotoField] = useState<PhotoField | null>(null);
  const photoDoubleTapRef = useRef<Partial<Record<PhotoField, number>>>({
    camera_view_photo_url: 0,
    service_entrance_photo_url: 0,
  });

  useEffect(() => {
    reportRef.current = report;
  }, [report]);

  const markFieldPending = (field: PhotoField, action: FieldAction) => {
    setPendingSaveByField((prev) => ({ ...prev, [field]: true }));
    setPendingActionByField((prev) => ({ ...prev, [field]: action }));
  };

  const ensureWatermarkedPhoto = useCallback(async (field: PhotoField) => {
    const source = reportRef.current[field];
    const { enabledField } = WATERMARK_CONFIG[field];
    const watermarkEnabled = Boolean(reportRef.current[enabledField]);
    if (!watermarkEnabled || !source) return;

    const watermarkKey = JSON.stringify([
      source,
      reportRef.current.date,
      reportRef.current.address?.latitude,
      reportRef.current.address?.longitude,
      reportRef.current.address?.distrito,
      reportRef.current.address?.site_name,
    ]);

    if (watermarkCacheKeyRef.current[field] === watermarkKey && watermarkedPreview[field]) {
      return;
    }

    const requestId = Date.now() + Math.random();
    watermarkRequestRef.current[field] = requestId;
    setWatermarkingField(field);

    try {
      const logoDataUrl = await getPublicLogoDataUrl();
      const watermarkedDataUrl = await buildWatermarkedImage(source, reportRef.current, logoDataUrl);
      if (watermarkRequestRef.current[field] !== requestId) return;

      watermarkCacheKeyRef.current[field] = watermarkKey;
      setWatermarkedPreview((prev) => ({ ...prev, [field]: watermarkedDataUrl }));
    } catch (e) {
      if (watermarkRequestRef.current[field] !== requestId) return;
      setError(`No se pudo aplicar la marca de agua: ${(e as Error).message}`);
    } finally {
      if (watermarkRequestRef.current[field] === requestId) {
        setWatermarkingField(null);
      }
    }
  }, []);

  useEffect(() => {
    clearTimeout(clearPendingTimer.current);
    if (saveState === 'saved') {
      clearPendingTimer.current = setTimeout(() => {
        setPendingSaveByField({});
        setPendingActionByField({});
      }, 1200);
    }
    return () => clearTimeout(clearPendingTimer.current);
  }, [saveState]);

  useEffect(() => {
    if (report.camera_view_photo_watermark_enabled) {
      void ensureWatermarkedPhoto('camera_view_photo_url');
    }
    if (report.service_entrance_photo_watermark_enabled) {
      void ensureWatermarkedPhoto('service_entrance_photo_url');
    }
  }, [
    report.camera_view_photo_watermark_enabled,
    report.camera_view_photo_url,
    report.service_entrance_photo_watermark_enabled,
    report.service_entrance_photo_url,
    report.date,
    report.address?.latitude,
    report.address?.longitude,
    report.address?.distrito,
    report.address?.site_name,
  ]);

  const handleFileChange = async (field: PhotoField, file: File | null) => {
    setError(null);

    const originalField = field.replace('_url', '_original_url');
    const shapesField = field.replace('_url', '_shapes');

    if (!file) {
      markFieldPending(field, 'delete');
      let newReport: any = { ...report, updated_at: Date.now() };
      delete newReport[field];
      delete newReport[originalField];
      delete newReport[shapesField];
      newReport = clearImageSourceUrls(newReport, field, originalField);
      watermarkCacheKeyRef.current[field] = '';
      setWatermarkedPreview((p) => { const np = { ...p }; delete np[field]; return np; });
      setReport(newReport as Report);
      return;
    }

    try {
      setCompressing(field);
      const dataUrl = await compressAndEncode(file);
      markFieldPending(field, 'upload');
      setReport(clearImageSourceUrls({
        ...report,
        [field]: dataUrl,
        [originalField]: dataUrl,
        updated_at: Date.now(),
      } as Report, field, originalField));
      watermarkCacheKeyRef.current[field] = '';
      setWatermarkedPreview((p) => { const np = { ...p }; delete np[field]; return np; });
    } catch (e) {
      console.error('Error compressing image:', e);
      setError(`Error al comprimir la imagen: ${(e as Error).message}`);
    } finally {
      setCompressing(null);
    }
  };

  const clearPhoto = (field: PhotoField) => {
    markFieldPending(field, 'delete');
    const originalField = field.replace('_url', '_original_url');
    const shapesField = field.replace('_url', '_shapes');

    let newReport: any = { ...report, updated_at: Date.now() };
    delete newReport[field];
    delete newReport[originalField];
    delete newReport[shapesField];
    newReport = clearImageSourceUrls(newReport, field, originalField);
    watermarkCacheKeyRef.current[field] = '';
    setWatermarkedPreview((p) => { const np = { ...p }; delete np[field]; return np; });
    setReport(newReport as Report);
  };

  const openViewer = (field: PhotoField) => {
    const items = PHOTO_SECTIONS
      .map(({ field: sectionField, label }) => {
        const src = getPhotoDisplaySource(reportRef.current, sectionField, watermarkedPreview);
        return src ? { field: sectionField, label, src } : null;
      })
      .filter(Boolean) as ViewerItem[];

    if (items.length === 0) return;
    const index = Math.max(0, items.findIndex((item) => item.field === field));

    setViewerItems(items);
    setViewerIndex(index);
    setViewerImageLabel(items[index].label);
    setViewerImageSrc(null);
    setViewerOpen(true);
    setViewerLoading(true);
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!viewerOpen || viewerItems.length === 0) return;
    const current = viewerItems[viewerIndex];
    if (!current) return;

    const requestId = Date.now() + Math.random();
    viewerLoadRequestRef.current = requestId;
    setViewerLoading(true);
    setViewerImageLabel(current.label);
    setViewerImageSrc(null);
    setViewerScale(1);
    setViewerOffset({ x: 0, y: 0 });

    void (async () => {
      try {
        const resolved = await resolveImageSource(current.src);
        if (viewerLoadRequestRef.current !== requestId) return;
        setViewerImageSrc(resolved);
      } catch {
        if (viewerLoadRequestRef.current !== requestId) return;
        setError('No se pudo cargar la imagen para visualizacion.');
        setViewerImageSrc(current.src);
      } finally {
        if (viewerLoadRequestRef.current === requestId) {
          setViewerLoading(false);
        }
      }
    })();
  }, [viewerOpen, viewerItems, viewerIndex]);

  const closeViewer = () => {
    setViewerOpen(false);
    setViewerDragging(false);
    viewerDragRef.current = null;
    setViewerItems([]);
    setViewerIndex(0);
  };

  const clampScale = (value: number) => Math.max(0.5, Math.min(6, value));

  const handleViewerWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    setViewerScale((prev) => clampScale(prev + delta));
  };

  const handleViewerMouseDown = (e: MouseEvent) => {
    e.preventDefault();
    viewerDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: viewerOffset.x,
      originY: viewerOffset.y,
    };
    setViewerDragging(true);
  };

  const handleViewerMouseMove = (e: MouseEvent) => {
    const drag = viewerDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setViewerOffset({ x: drag.originX + dx, y: drag.originY + dy });
  };

  const handleViewerMouseUp = () => {
    viewerDragRef.current = null;
    setViewerDragging(false);
  };

  const handleViewerDownload = () => {
    if (!viewerImageSrc) return;
    const ext = viewerImageSrc.includes('image/png') ? 'png' : 'jpg';
    const anchor = document.createElement('a');
    anchor.href = viewerImageSrc;
    anchor.download = `${report.id}-${viewerImageLabel.replace(/\s+/g, '_').toLowerCase()}.${ext}`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  };

  const handleViewerImageLoad = (e: Event) => {
    const img = e.target as HTMLImageElement;
    const container = viewerContainerRef.current;
    if (!container || !img.naturalWidth || !img.naturalHeight) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let fitScale: number;
    if (imgAspect > containerAspect) {
      fitScale = containerWidth / img.naturalWidth;
    } else {
      fitScale = containerHeight / img.naturalHeight;
    }
    fitScale = Math.max(0.5, Math.min(fitScale * 0.95, 1));
    setViewerScale(fitScale);
    setViewerOffset({ x: 0, y: 0 });
  };

  const resetViewerToFit = () => {
    const img = viewerContainerRef.current?.querySelector('img') as HTMLImageElement | null;
    if (!img || !img.naturalWidth || !img.naturalHeight) {
      setViewerScale(1);
      setViewerOffset({ x: 0, y: 0 });
      return;
    }

    const container = viewerContainerRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerWidth / containerHeight;

    let fitScale: number;
    if (imgAspect > containerAspect) {
      fitScale = containerWidth / img.naturalWidth;
    } else {
      fitScale = containerHeight / img.naturalHeight;
    }
    fitScale = Math.max(0.5, Math.min(fitScale * 0.95, 1));
    setViewerScale(fitScale);
    setViewerOffset({ x: 0, y: 0 });
  };

  const showViewerControls = () => {
    clearTimeout(viewerControlsTimeoutRef.current);
    setViewerShowControls(true);
    viewerControlsTimeoutRef.current = setTimeout(() => {
      setViewerShowControls(false);
    }, 3000);
  };

  const handleViewerContainerDoubleTap = (e: React.TouchEvent) => {
    const now = Date.now();
    if (!viewerDoubleTapRef.current) viewerDoubleTapRef.current = { lastTap: 0 };

    if (now - viewerDoubleTapRef.current.lastTap < 300) {
      showViewerControls();
    }
    viewerDoubleTapRef.current.lastTap = now;
  };

  const handlePhotoDoubleTap = (field: PhotoField) => {
    return (e: React.TouchEvent) => {
      const now = Date.now();
      const lastTap = photoDoubleTapRef.current[field] ?? 0;

      if (now - lastTap < 300) {
        setHoveredPhotoField(field);
        const timeout = setTimeout(() => setHoveredPhotoField(null), 3000);
        return () => clearTimeout(timeout);
      }
      photoDoubleTapRef.current[field] = now;
    };
  };

  const openEditor = async (field: PhotoField) => {
    const originalField = field.replace('_url', '_original_url');
    const originalSrc = (report as any)[originalField];
    let src = originalSrc || report[field];
    if (!src) return;

    src = await resolveImageSource(src);

    const img = new Image();
    img.onload = () => {
      setEditorImageMeta({ width: img.width, height: img.height });
      setEditingField(field);
      setEditorOpen(true);
    };
    img.onerror = () => {
      setError('No se pudo cargar la imagen para editar. Intente de nuevo o vuelva a cargar la foto.');
    };
    img.src = src;
  };

  const handleEditorSave = (dataUrl: string, shapes: Shape[]) => {
    if (editingField) {
      const originalField = editingField.replace('_url', '_original_url');
      const shapesField = editingField.replace('_url', '_shapes');
      const currentReport = { ...report };
      // Ensure we preserve the original clean image if it wasn't tracked yet
      // This handles cases where the image was uploaded before this version update
      const originalUrl = (currentReport as any)[originalField];
      if (!originalUrl && currentReport[editingField]) {
         (currentReport as any)[originalField] = currentReport[editingField];
       }

      markFieldPending(editingField, 'upload');

      setReport(clearImageSourceUrls({
        ...currentReport,
        [editingField]: dataUrl,
        [shapesField]: shapes,
        updated_at: Date.now(),
      } as Report, editingField));
      watermarkCacheKeyRef.current[editingField] = '';
      setWatermarkedPreview((p) => { const np = { ...p }; delete np[editingField]; return np; });
    }
    setEditorOpen(false);
    setEditingField(null);
    setEditorImageMeta(null);
  };

  /* ── Read-only view ── */
  if (readOnly) {
    return (
      <Stack gap="lg">
        {PHOTO_SECTIONS.map(({ field, label }) => {
          const displaySrc = getPhotoDisplaySource(report, field, watermarkedPreview);
          return (
          <Box key={field}>
            <Text size="sm" fw={500} c="dimmed" mb="sm">{label}</Text>
            {displaySrc ? (
              <>
                <Box
                  onMouseEnter={() => setHoveredPhotoField(field)}
                  onMouseLeave={() => setHoveredPhotoField(null)}
                  onTouchEnd={handlePhotoDoubleTap(field)}
                  style={{
                    maxWidth: 400,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <StorageImage
                    src={displaySrc}
                    alt={label}
                    loading="lazy"
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                  <ActionIcon
                    variant="light"
                    onClick={() => openViewer(field)}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      opacity: hoveredPhotoField === field ? 1 : 0,
                      pointerEvents: hoveredPhotoField === field ? 'auto' : 'none',
                      transition: 'opacity 0.2s ease-in-out',
                      zIndex: 10,
                    }}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                </Box>
              </>
            ) : (
              <Text size="sm" c="dimmed">—</Text>
            )}
          </Box>
          );
        })}
      </Stack>
    );
  }

  /* ── Editable view ── */
  return (
    <Stack gap="xl">
      <Text size="sm" c="dimmed">
        Las imágenes se comprimen automáticamente para optimizar el almacenamiento local.
      </Text>

      {error && (
        <Alert color="red" withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {PHOTO_SECTIONS.map(({ field, label, placeholder }) => {
      const displaySrc = getPhotoDisplaySource(report, field, watermarkedPreview);
        const hasPhoto = Boolean(displaySrc?.trim());
        const isCompressing = compressing === field;
        const isWatermarking = watermarkingField === field;
        const { enabledField, watermarkedField } = WATERMARK_CONFIG[field];
        const watermarkEnabled = Boolean(report[enabledField]);
        const showFieldSaveStatus = Boolean(pendingSaveByField[field]);
        const fieldAction = pendingActionByField[field] ?? 'upload';
        const fieldStatusLabel =
          saveState === 'pending'
            ? (fieldAction === 'delete' ? 'Procesando eliminación…' : 'Procesando imagen…')
            : saveState === 'saving'
              ? (fieldAction === 'delete' ? 'Eliminando imagen…' : 'Subiendo imagen…')
              : saveState === 'saved'
                ? (fieldAction === 'delete' ? 'Imagen eliminada' : 'Imagen guardada')
                : saveState === 'error'
                  ? (fieldAction === 'delete' ? 'Error al eliminar imagen' : 'Error al guardar imagen')
                  : null;
        const fieldStatusColor =
          saveState === 'error'
            ? 'red'
            : saveState === 'saved'
              ? 'teal'
              : saveState === 'saving'
                ? 'blue'
                : 'yellow';
        const statusIcon = saveState === 'saved'
              ? <IconCheck size={16} />
              : saveState === 'error'
                ? <IconAlertCircle size={16} />
                : null;

        return (
          <Stack key={field} gap="sm">
            <Text size="sm" fw={500}>
              <IconPhoto size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
              {label}
            </Text>

            {isCompressing && (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">Comprimiendo imagen…</Text>
              </Group>
            )}

            {isWatermarking && (
              <Group gap="xs">
                <Loader size="xs" />
                <Text size="sm" c="dimmed">Aplicando marca de agua…</Text>
              </Group>
            )}

            <Checkbox
              size="xs"
              label="Marca de Agua"
              checked={watermarkEnabled}
              onChange={(e) => {
                const checked = e.currentTarget.checked;
                watermarkCacheKeyRef.current[field] = '';
                if (!checked) {
                  setReport({
                    ...report,
                    [enabledField]: false,
                    [watermarkedField]: undefined,
                    updated_at: Date.now(),
                  } as Report);
                  return;
                }

                setReport({
                  ...report,
                  [enabledField]: true,
                  updated_at: Date.now(),
                } as Report);
              }}
              disabled={isCompressing || !report[field]}
            />

            {hasPhoto ? (
              <Stack gap="sm">
                <Box
                  onMouseEnter={() => setHoveredPhotoField(field)}
                  onMouseLeave={() => setHoveredPhotoField(null)}
                  onTouchEnd={handlePhotoDoubleTap(field)}
                  style={{
                    maxWidth: 400,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <StorageImage
                    src={displaySrc!}
                  alt={label}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                {showFieldSaveStatus && fieldStatusLabel && (
                  <Box
                    style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                      background: 'rgba(0,0,0,0.45)',
                      backdropFilter: 'blur(1.5px)',
                    }}
                  >
                    <Box
                      style={{
                        margin: 12,
                        padding: '10px 14px',
                        borderRadius: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        color: 'white',
                        fontSize: 13,
                        fontWeight: 700,
                        background:
                          fieldStatusColor === 'red'
                            ? 'rgba(224,49,49,0.96)'
                            : fieldStatusColor === 'teal'
                              ? 'rgba(12,166,120,0.96)'
                              : fieldStatusColor === 'blue'
                                ? 'rgba(25,113,194,0.96)'
                                : 'rgba(245,159,0,0.96)',
                        boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
                      }}
                    >
                      {saveState === 'saving' || saveState === 'pending'
                        ? <Loader size={16} color="white" />
                        : statusIcon}
                      <span>{fieldStatusLabel}</span>
                    </Box>
                  </Box>
                )}
                {!showFieldSaveStatus && (
                  <ActionIcon
                    variant="light"
                    onClick={() => openViewer(field)}
                    disabled={isCompressing || isWatermarking}
                    style={{
                      position: 'absolute',
                      top: 16,
                      right: 16,
                      opacity: hoveredPhotoField === field ? 1 : 0,
                      pointerEvents: hoveredPhotoField === field ? 'auto' : 'none',
                      transition: 'opacity 0.2s ease-in-out',
                      zIndex: 10,
                    }}
                  >
                    <IconEye size={16} />
                  </ActionIcon>
                )}
                </Box>
                <Group gap="xs">
                  <FileInput
                    accept="image/*"
                    placeholder="Cambiar imagen"
                    onChange={(f) => handleFileChange(field, f)}
                    disabled={isCompressing || isWatermarking}
                    style={{ flex: '1', minWidth: 140 }}
                  />
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => openEditor(field)}
                    disabled={isCompressing || isWatermarking}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => clearPhoto(field)}
                    disabled={isCompressing || isWatermarking}
                  >
                    Quitar
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Stack gap={4}>
                <FileInput
                  accept="image/*"
                  placeholder={placeholder}
                  onChange={(f) => handleFileChange(field, f)}
                  disabled={isCompressing || isWatermarking}
                />
                {showFieldSaveStatus && fieldStatusLabel && (
                  <Text size="xs" fw={500} c={fieldStatusColor}>
                    {fieldStatusLabel}
                  </Text>
                )}
              </Stack>
            )}
          </Stack>
        );
      })}

      <Modal
        opened={editorOpen}
        onClose={() => setEditorOpen(false)}
        title="Editar Imagen"
        size="xl"
      >
        {editorOpen && editingField && report[editingField] && editorImageMeta && (
          <Box p="md">
            <ImageEditor
              width={editorImageMeta.width}
              height={editorImageMeta.height}
              baseImage={(report as any)[editingField.replace('_url', '_original_url')] || report[editingField]!}
              initialShapes={(report as any)[editingField.replace('_url', '_shapes')] || []}
              onSave={handleEditorSave}
              onCancel={() => setEditorOpen(false)}
            />
          </Box>
        )}
      </Modal>

      <Modal
        opened={viewerOpen}
        onClose={closeViewer}
        title={viewerImageLabel}
        size="90%"
        centered
      >
        <Stack gap="sm">
          <Group justify="space-between" wrap="wrap">
            <Group gap="xs">
              <Button
                size="xs"
                variant="default"
                disabled={viewerItems.length <= 1}
                onClick={() => setViewerIndex((idx) => (idx - 1 + viewerItems.length) % viewerItems.length)}
              >
                Anterior
              </Button>
              <Button
                size="xs"
                variant="default"
                disabled={viewerItems.length <= 1}
                onClick={() => setViewerIndex((idx) => (idx + 1) % viewerItems.length)}
              >
                Siguiente
              </Button>
              <ActionIcon variant="light" onClick={() => setViewerScale((v) => clampScale(v - 0.2))}>
                <IconZoomOut size={16} />
              </ActionIcon>
              <ActionIcon variant="light" onClick={() => setViewerScale((v) => clampScale(v + 0.2))}>
                <IconZoomIn size={16} />
              </ActionIcon>
              <Text size="sm" c="dimmed">Zoom: {Math.round(viewerScale * 100)}%</Text>
              {viewerItems.length > 1 && (
                <Text size="sm" c="dimmed">{viewerIndex + 1}/{viewerItems.length}</Text>
              )}
            </Group>
            <Button size="xs" leftSection={<IconDownload size={14} />} onClick={handleViewerDownload} disabled={!viewerImageSrc}>
              Descargar
            </Button>
          </Group>

          <Box
            ref={viewerContainerRef}
            onWheel={handleViewerWheel}
            onMouseDown={handleViewerMouseDown}
            onMouseMove={handleViewerMouseMove}
            onMouseUp={handleViewerMouseUp}
            onMouseEnter={() => setViewerShowControls(true)}
            onMouseLeave={() => {
              handleViewerMouseUp();
              setViewerShowControls(false);
            }}
            onTouchEnd={handleViewerContainerDoubleTap}
            style={{
              height: '70vh',
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
              overflow: 'hidden',
              position: 'relative',
              background: '#111',
              cursor: viewerDragging ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            {viewerLoading && (
              <Box
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Loader size="sm" />
              </Box>
            )}
            {!viewerLoading && viewerImageSrc && (
              <img
                src={viewerImageSrc}
                alt={viewerImageLabel}
                draggable={false}
                onLoad={handleViewerImageLoad}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  maxWidth: 'none',
                  maxHeight: 'none',
                  transform: `translate(calc(-50% + ${viewerOffset.x}px), calc(-50% + ${viewerOffset.y}px)) scale(${viewerScale})`,
                  transformOrigin: 'center center',
                }}
              />
            )}
            {!viewerLoading && viewerImageSrc && (
              <ActionIcon
                variant="light"
                onClick={resetViewerToFit}
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  opacity: viewerShowControls ? 1 : 0,
                  pointerEvents: viewerShowControls ? 'auto' : 'none',
                  transition: 'opacity 0.2s ease-in-out',
                  zIndex: 10,
                }}
              >
                <IconRefresh size={16} />
              </ActionIcon>
            )}
          </Box>

          <Text size="xs" c="dimmed">
            Use la rueda del mouse para zoom y arrastre para desplazarse.
          </Text>
        </Stack>
      </Modal>
    </Stack>
  );
}
