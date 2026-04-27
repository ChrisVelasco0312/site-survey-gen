import { useEffect, useRef, useState } from 'preact/hooks';
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
} from '@mantine/core';
import { IconPhoto, IconTrash, IconEdit, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import imageCompression from 'browser-image-compression';
import type { Report } from '../../types/Report';
import { Shape } from '../../types/Shape';
import { ImageEditor } from '../../components/ImageEditor/ImageEditor';
import { StorageImage } from '../../components/StorageImage/StorageImage';
import { resolveStorageUrl } from '../../hooks/useStorageUrl';

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

interface PhotoSectionConfig {
  field: PhotoField;
  label: string;
  placeholder: string;
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

/* ── Helpers ──────────────────────────────────────────────── */

async function compressAndEncode(file: File): Promise<string> {
  const compressed = await imageCompression(file, COMPRESSION_OPTIONS);
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsDataURL(compressed);
  });
}

/* ── Component ────────────────────────────────────────────── */

export function ReportEditStep4({ report, setReport, readOnly, saveState = 'idle' }: ReportEditStep4Props) {
  const [compressing, setCompressing] = useState<PhotoField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<PhotoField | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImageMeta, setEditorImageMeta] = useState<{ width: number; height: number } | null>(null);
  const [pendingSaveByField, setPendingSaveByField] = useState<Partial<Record<PhotoField, boolean>>>({});
  const [pendingActionByField, setPendingActionByField] = useState<Partial<Record<PhotoField, FieldAction>>>({});
  const clearPendingTimer = useRef<ReturnType<typeof setTimeout>>();

  const markFieldPending = (field: PhotoField, action: FieldAction) => {
    setPendingSaveByField((prev) => ({ ...prev, [field]: true }));
    setPendingActionByField((prev) => ({ ...prev, [field]: action }));
  };

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

  const handleFileChange = async (field: PhotoField, file: File | null) => {
    setError(null);

    const originalField = field.replace('_url', '_original_url');
    const shapesField = field.replace('_url', '_shapes');

    if (!file) {
      markFieldPending(field, 'delete');
      const newReport = { ...report, updated_at: Date.now() };
      delete (newReport as any)[field];
      delete (newReport as any)[originalField];
      delete (newReport as any)[shapesField];
      setReport(newReport as Report);
      return;
    }

    try {
      setCompressing(field);
      const dataUrl = await compressAndEncode(file);
      markFieldPending(field, 'upload');
      setReport({ 
        ...report, 
        [field]: dataUrl, 
        [originalField]: dataUrl,
        // Keep existing shapes if any, so user can re-apply them to new image
        // [shapesField]: [], 
        updated_at: Date.now() 
      } as Report);
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

    const newReport = { ...report, updated_at: Date.now() };
    delete (newReport as any)[field];
    delete (newReport as any)[originalField];
    delete (newReport as any)[shapesField];
    setReport(newReport as Report);
  };

  const openEditor = async (field: PhotoField) => {
    const originalField = field.replace('_url', '_original_url');
    const originalSrc = (report as any)[originalField];
    let src = originalSrc || report[field];
    if (!src) return;

    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      try {
        src = await resolveStorageUrl(src);
      } catch {
        /* keep raw */
      }
    }

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

      setReport({ 
        ...currentReport, 
        [editingField]: dataUrl, 
        [shapesField]: shapes,
        updated_at: Date.now() 
      } as Report);
    }
    setEditorOpen(false);
    setEditingField(null);
    setEditorImageMeta(null);
  };

  /* ── Read-only view ── */
  if (readOnly) {
    return (
      <Stack gap="lg">
        {PHOTO_SECTIONS.map(({ field, label }) => (
          <Box key={field}>
            <Text size="sm" fw={500} c="dimmed" mb="sm">{label}</Text>
            {report[field] ? (
              <Box
                style={{
                  maxWidth: 400,
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  overflow: 'hidden',
                }}
              >
                <StorageImage
                  src={report[field]}
                  alt={label}
                  loading="lazy"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
              </Box>
            ) : (
              <Text size="sm" c="dimmed">—</Text>
            )}
          </Box>
        ))}
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
        const hasPhoto = Boolean(report[field]?.trim());
        const isCompressing = compressing === field;
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

            {hasPhoto ? (
              <Stack gap="sm">
                <Box
                  style={{
                    maxWidth: 400,
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 'var(--mantine-radius-sm)',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                <StorageImage
                  src={report[field]}
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
                </Box>
                <Group gap="xs">
                  <FileInput
                    accept="image/*"
                    placeholder="Cambiar imagen"
                    onChange={(f) => handleFileChange(field, f)}
                    disabled={isCompressing}
                    style={{ flex: '1', minWidth: 140 }}
                  />
                  <Button
                    variant="light"
                    size="xs"
                    leftSection={<IconEdit size={14} />}
                    onClick={() => openEditor(field)}
                    disabled={isCompressing}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="light"
                    color="red"
                    size="xs"
                    leftSection={<IconTrash size={14} />}
                    onClick={() => clearPhoto(field)}
                    disabled={isCompressing}
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
                  disabled={isCompressing}
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
    </Stack>
  );
}
