import { useState } from 'preact/hooks';
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
import { IconPhoto, IconTrash, IconEdit } from '@tabler/icons-react';
import imageCompression from 'browser-image-compression';
import type { Report } from '../../types/Report';
import { Shape } from '../../types/Shape';
import { ImageEditor } from '../../components/ImageEditor/ImageEditor';

/* ── Compression options ──────────────────────────────────── */

const COMPRESSION_OPTIONS = {
  maxSizeMB: 0.5,          // Target ≤ 500 KB
  maxWidthOrHeight: 1920,  // Max dimension
  useWebWorker: true,
  fileType: 'image/jpeg' as const,
};

/* ── Types ────────────────────────────────────────────────── */

interface ReportEditStep5Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

type PhotoField = 'camera_view_photo_url' | 'service_entrance_photo_url';

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

export function ReportEditStep5({ report, setReport, readOnly }: ReportEditStep5Props) {
  const [compressing, setCompressing] = useState<PhotoField | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<PhotoField | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorImageMeta, setEditorImageMeta] = useState<{ width: number; height: number } | null>(null);

  const handleFileChange = async (field: PhotoField, file: File | null) => {
    setError(null);

    const originalField = field.replace('_url', '_original_url');
    const shapesField = field.replace('_url', '_shapes');

    if (!file) {
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
    const originalField = field.replace('_url', '_original_url');
    const shapesField = field.replace('_url', '_shapes');

    const newReport = { ...report, updated_at: Date.now() };
    delete (newReport as any)[field];
    delete (newReport as any)[originalField];
    delete (newReport as any)[shapesField];
    setReport(newReport as Report);
  };

  const openEditor = (field: PhotoField) => {
    const originalField = field.replace('_url', '_original_url');
    // Prefer original unedited image if available
    const originalSrc = (report as any)[originalField];
    const src = originalSrc || report[field];
    if (!src) return;

    const img = new Image();
    img.onload = () => {
      setEditorImageMeta({ width: img.width, height: img.height });
      setEditingField(field);
      setEditorOpen(true);
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
                <img
                  src={report[field]}
                  alt={label}
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
                  }}
                >
                  <img
                    src={report[field]}
                    alt={label}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
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
              <FileInput
                accept="image/*"
                placeholder={placeholder}
                onChange={(f) => handleFileChange(field, f)}
                disabled={isCompressing}
              />
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
