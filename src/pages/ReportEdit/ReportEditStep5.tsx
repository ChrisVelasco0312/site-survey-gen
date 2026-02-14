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
} from '@mantine/core';
import { IconPhoto, IconTrash } from '@tabler/icons-react';
import imageCompression from 'browser-image-compression';
import type { Report } from '../../types/Report';

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

  const handleFileChange = async (field: PhotoField, file: File | null) => {
    setError(null);

    if (!file) {
      setReport({ ...report, [field]: undefined, updated_at: Date.now() });
      return;
    }

    try {
      setCompressing(field);
      const dataUrl = await compressAndEncode(file);
      setReport({ ...report, [field]: dataUrl, updated_at: Date.now() });
    } catch (e) {
      console.error('Error compressing image:', e);
      setError(`Error al comprimir la imagen: ${(e as Error).message}`);
    } finally {
      setCompressing(null);
    }
  };

  const clearPhoto = (field: PhotoField) => {
    setReport({ ...report, [field]: undefined, updated_at: Date.now() });
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
    </Stack>
  );
}
