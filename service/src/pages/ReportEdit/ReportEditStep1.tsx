import { useMemo, useState } from 'preact/hooks';
import {
  TextInput,
  MultiSelect,
  Stack,
  Text,
  Modal,
  Button,
  Box,
  ScrollArea,
} from '@mantine/core';
import { DateInput } from '@mantine/dates';
import type { Report, AddressData, InstallationType } from '../../types/Report';
import { MOCK_SITES, formatSiteOption, searchMockSites } from '../../data/mockSites';

const INSTALLATION_TYPE_OPTIONS: { value: InstallationType; label: string }[] = [
  { value: 'fachada_mastil', label: 'Fachada / Mástil' },
  { value: 'poste', label: 'Poste' },
  { value: 'torre', label: 'Torre' },
];

interface ReportEditStep1Props {
  report: Report;
  setReport: (report: Report) => void;
  readOnly?: boolean;
}

/** Parses stored date string (DD/MM/YYYY or YYYY-MM-DD) to Date, or null if invalid. */
function parseStoredDate(dateStr: string): Date | null {
  if (!dateStr?.trim()) return null;
  const ymd = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date(ymd + 'T12:00:00');
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parts = ymd.split(/[/.-]/).map(Number);
  if (parts.length !== 3) return null;
  const date = ymd.includes('-')
    ? new Date(parts[0], parts[1] - 1, parts[2]) // YYYY-MM-DD
    : new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Normalizes to YYYY-MM-DD (Mantine's DateStringValue). Accepts Date, dayjs, or string. */
function toStoredDateValue(value: Date | { toDate?: () => Date } | string): string {
  if (typeof value === 'string') {
    const parsed = parseStoredDate(value);
    return parsed ? parsed.toISOString().slice(0, 10) : '';
  }
  let date: Date;
  if (value instanceof Date) {
    date = value;
  } else if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else {
    return '';
  }
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function ReportEditStep1({ report, setReport, readOnly }: ReportEditStep1Props) {
  const [siteModalOpen, setSiteModalOpen] = useState(false);
  const [siteSearchQuery, setSiteSearchQuery] = useState('');

  const dateDisplayText = useMemo(() => {
    if (!report.date) return '—';
    const d = parseStoredDate(report.date);
    return d ? d.toLocaleDateString('es-CO') : report.date;
  }, [report.date]);

  const hasAddressSelected = useMemo(() => {
    const a = report.address;
    return !!(a?.site_name || a?.pm_number || a?.full_address);
  }, [report.address]);

  const addressDisplayValue = useMemo(() => {
    const a = report.address;
    if (!a?.site_name && !a?.pm_number && !a?.full_address) return '';
    return formatSiteOption(a);
  }, [report.address]);

  const onDateChange = (value: string | Date | null | unknown) => {
    if (value == null) {
      setReport({ ...report, date: '', updated_at: Date.now() });
      return;
    }
    const dateStr =
      typeof value === 'string'
        ? (/^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toStoredDateValue(value))
        : toStoredDateValue(value as Date | { toDate: () => Date });
    setReport({ ...report, date: dateStr, updated_at: Date.now() });
  };

  const onInstallationTypeChange = (values: string[]) => {
    setReport({
      ...report,
      installation_type: values as InstallationType[],
      updated_at: Date.now(),
    });
  };

  const onSelectSite = (site: AddressData) => {
    setReport({
      ...report,
      address: { ...site },
      updated_at: Date.now(),
    });
    setSiteModalOpen(false);
    setSiteSearchQuery('');
  };

  const filteredSites = useMemo(
    () => searchMockSites(siteSearchQuery),
    [siteSearchQuery]
  );

  if (readOnly) {
    return (
      <Stack gap="md">
        <Text size="sm" fw={500} c="dimmed">Fecha</Text>
        <Text>{dateDisplayText}</Text>
        <Text size="sm" fw={500} c="dimmed">Tipo de instalación</Text>
        <Text>
          {report.installation_type.length
            ? report.installation_type
                .map((t) => INSTALLATION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t)
                .join(', ')
            : '—'}
        </Text>
        <Text size="sm" fw={500} c="dimmed">Dirección / Sitio</Text>
        <Text>{addressDisplayValue || '—'}</Text>
        {report.address.latitude !== 0 && report.address.longitude !== 0 && (
          <Text size="xs" c="dimmed">
            Coordenadas: {report.address.latitude.toFixed(5)}, {report.address.longitude.toFixed(5)}
          </Text>
        )}
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <DateInput
        label="Fecha"
        value={
          report.date
            ? parseStoredDate(report.date)?.toISOString().slice(0, 10) ?? report.date
            : null
        }
        onChange={onDateChange}
        placeholder="Seleccione la fecha"
        valueFormat="DD/MM/YYYY"
        dateParser={(input) => {
          const parsed = parseStoredDate(input);
          return parsed ?? undefined;
        }}
        clearable
      />
      <MultiSelect
        label="Tipo de instalación"
        placeholder="Seleccione uno o más"
        data={INSTALLATION_TYPE_OPTIONS}
        value={report.installation_type}
        onChange={onInstallationTypeChange}
      />
      <Box>
        <Text size="sm" fw={500} mb="xs" component="label" display="block">
          Dirección / Sitio
        </Text>
        <Text size="xs" c="dimmed" mb="xs">
          Seleccione un sitio de la lista. La información quedará fija.
        </Text>
        {hasAddressSelected ? (
          <Stack gap="xs">
            <Box
              py="sm"
              px="md"
              style={{ border: '1px solid var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-sm)' }}
            >
              <Text size="sm" fw={500}>{report.address.site_name}</Text>
              <Text size="xs" c="dimmed">{report.address.pm_number} — {report.address.full_address}</Text>
              <Text size="xs" c="dimmed" mt={4}>
                Lat: {report.address.latitude.toFixed(5)}, Long: {report.address.longitude.toFixed(5)}
              </Text>
            </Box>
            <Button variant="light" size="xs" onClick={() => setSiteModalOpen(true)}>
              Cambiar sitio
            </Button>
          </Stack>
        ) : (
          <Button onClick={() => setSiteModalOpen(true)}>
            Seleccionar sitio
          </Button>
        )}
      </Box>

      <Modal
        title="Seleccionar sitio"
        opened={siteModalOpen}
        onClose={() => {
          setSiteModalOpen(false);
          setSiteSearchQuery('');
        }}
      >
        <Stack gap="md">
          <TextInput
            placeholder="Buscar por nombre, PM o dirección..."
            value={siteSearchQuery}
            onInput={(e) => setSiteSearchQuery((e.target as HTMLInputElement).value)}
          />
        <ScrollArea.Autosize mah={360}>
          <Stack gap="xs">
            {filteredSites.map((site) => (
              <Box
                key={site.pm_number}
                py="sm"
                px="md"
                style={{
                  border: '1px solid var(--mantine-color-default-border)',
                  borderRadius: 'var(--mantine-radius-sm)',
                  cursor: 'pointer',
                }}
                onClick={() => onSelectSite(site)}
                role="button"
              >
                <Text size="sm" fw={500}>{site.site_name}</Text>
                <Text size="xs" c="dimmed">{site.pm_number} — {site.full_address}</Text>
                <Text size="xs" c="dimmed">
                  {site.latitude.toFixed(5)}, {site.longitude.toFixed(5)}
                </Text>
              </Box>
            ))}
          </Stack>
        </ScrollArea.Autosize>
        </Stack>
      </Modal>
    </Stack>
  );
}
