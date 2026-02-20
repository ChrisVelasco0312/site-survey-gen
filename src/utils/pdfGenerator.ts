import { generate } from '@pdfme/generator';
import { text, image, line, table } from '@pdfme/schemas';
import type { Template } from '@pdfme/common';
import type { Report } from '../types/Report';

let cachedTemplate: Template | null = null;

async function loadTemplate(): Promise<Template> {
  if (cachedTemplate) return cachedTemplate;
  const res = await fetch('/pdfme_template.json');
  if (!res.ok) throw new Error('No se pudo cargar la plantilla PDF');
  cachedTemplate = await res.json();
  return cachedTemplate!;
}

/** Parse date string (DD/MM/YYYY or YYYY-MM-DD) into parts. */
function parseDate(dateStr: string): { dia: string; mes: string; anio: string } {
  if (!dateStr) return { dia: '', mes: '', anio: '' };
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return { dia: d ?? '', mes: m ?? '', anio: y ?? '' };
  }
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return { dia: d ?? '', mes: m ?? '', anio: y ?? '' };
  }
  return { dia: dateStr, mes: '', anio: '' };
}

/** Checkbox mark: returns 'X' when checked, two spaces when unchecked. */
const chk = (v: boolean) => (v ? 'X' : '  ');

/** Convert decimal degrees to DMS (Degrees Minutes Seconds) string. */
function toDMS(decimal: number, isLat: boolean): string {
  if (decimal == null || isNaN(decimal)) return '';
  const dir = isLat ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W');
  const abs = Math.abs(decimal);
  const deg = Math.floor(abs);
  const minFloat = (abs - deg) * 60;
  const min = Math.floor(minFloat);
  const sec = ((minFloat - min) * 60).toFixed(2);
  return `${deg}° ${min}' ${sec}" ${dir}`;
}

/**
 * Build the pdfme inputs record by mapping every Report field
 * to the corresponding template schema name.
 */
export function buildPdfInputs(report: Report): Record<string, string> {
  const { dia, mes, anio } = parseDate(report.date);
  const inst = report.installation_type ?? [];

  const inputs: Record<string, string> = {
    // ─── Page 1: Header ──────────────────────────────────────
    input_day: dia,
    input_month: mes,
    input_year: anio,
    input_site_name: report.address?.site_name.replace(/\D/g, "") ?? '',

    chk_install_type:
      `TIPO INSTALACIÓN:   Fachada/mástil [${chk(inst.includes('fachada_mastil'))}]` +
      `    Poste [${chk(inst.includes('poste'))}]` +
      `    Torre [${chk(inst.includes('torre'))}]`,

    // ─── Section 1: Geographic Info ──────────────────────────
    input_address: report.address?.full_address ?? '',
    input_lat: report.address?.latitude ? String(report.address.latitude) : '',
    input_long: report.address?.longitude ? String(report.address.longitude) : '',
    input_gms: [
      report.address?.latitude ? toDMS(report.address.latitude, true) : '',
      report.address?.longitude ? toDMS(report.address.longitude, false) : '',
    ].filter(Boolean).join(' / '),

    input_description:
      `Descripción (Distancia energía, ruta acometida, infraestructura): ${(report.observations ?? []).join(', ')}`,

    // ─── Security & Components ───────────────────────────────
    chk_security:
      `NIVEL DE SEGURIDAD:   ALTO [${chk(report.security_level === 'alto')}]` +
      `    MEDIO [${chk(report.security_level === 'medio')}]` +
      `    BAJO [${chk(report.security_level === 'bajo')}]`,

    chk_components:
      `COMPONENTES:   LPR [${chk(report.contract_component === 'lpr')}]` +
      `    COTEJO FACIAL [${chk(report.contract_component === 'cotejo_facial')}]`,

    // ─── Section 2: Site Survey ──────────────────────────────
    chk_los: `N/A [${chk(!report.connectivity?.has_line_of_sight)}]`,

    chk_trans:
      `Fibra Óptica [${chk(report.connectivity?.transmission_medium === 'fibra_optica')}]` +
      `    Radio [  ]`,

    chk_cabling:
      `Aéreo [${chk(report.connectivity?.cabling_type === 'aereo')}]` +
      `    Subterráneo [${chk(report.connectivity?.cabling_type === 'subterraneo')}]` +
      `    Mixto [${chk(report.connectivity?.cabling_type === 'mixto')}]`,

    // ─── Hardware Inventory ──────────────────────────────────
    input_inv_box: String(report.hardware?.additional_boxes ?? 0),
    input_inv_multi: String(report.hardware?.cameras_multisensor ?? 0),
    input_inv_ptz: String(report.hardware?.cameras_ptz ?? 0),
    input_inv_fixed: String(report.hardware?.cameras_fixed ?? 0),

    // ─── Page 3: Civil works table ───────────────────────────
    table_civil_works: JSON.stringify([
      ['Aérea', String(report.pole_infrastructure?.aerial_meters ?? 0)],
      ['Prado', String(report.pole_infrastructure?.grass_meters ?? 0)],
      ['Asfalto', String(report.pole_infrastructure?.asphalt_meters ?? 0)],
      ['Adoquín', String(report.pole_infrastructure?.adoquin_meters ?? 0)],
      ['Concreto', String(report.pole_infrastructure?.concrete_meters ?? 0)],
      ['Relleno', String(report.pole_infrastructure?.fill_meters ?? 0)],
    ]),

    // ─── Facade ──────────────────────────────────────────────
    input_desc_facade: report.facade_infrastructure?.description ?? '',

    // ─── Infrastructure: Service Entrance (Acometida) ────────
    input_pa_tub: report.infrastructure_details?.service_entrance?.pipe_type ?? '',
    input_pa_alt: report.infrastructure_details?.service_entrance?.height ?? '',
    input_pa_other: report.infrastructure_details?.service_entrance?.other ?? '',

    // ─── Infrastructure: Camera Point ────────────────────────
    input_pc_tub: report.infrastructure_details?.camera_point?.pipe_type ?? '',
    input_pc_alt: report.infrastructure_details?.camera_point?.height ?? '',
    input_pc_mat: report.infrastructure_details?.camera_point?.material ?? '',

    // ─── Observations ────────────────────────────────────────
    input_observations: `Este punto de cámara pertenece a:  ${report.owner_name || '—'}\n\n\nOBSERVACIONES GENERALES:\n\n${report.final_observations ?? ''}`,
  };

  // ─── Images: only include when present ─────────────────────
  if (report.edited_map_image_url) {
    inputs.diagram_image = report.edited_map_image_url;
  }
  if (report.camera_view_photo_url) {
    inputs.photo_general = report.camera_view_photo_url;
  }
  if (report.service_entrance_photo_url) {
    inputs.photo_detail = report.service_entrance_photo_url;
  }

  return inputs;
}

/**
 * Extract default content from the template for every schema element.
 * pdfme replaces content for ALL non-readOnly schemas present in inputs,
 * and renders blanks for schemas NOT in inputs. So we must provide the
 * template's original content as fallback for every label, header, and
 * static element we don't explicitly override.
 */
function extractDefaults(template: Template): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const page of template.schemas as any[][]) {
    for (const schema of page) {
      if (schema.name && !schema.readOnly && schema.content !== undefined) {
        defaults[schema.name] = schema.content;
      }
    }
  }
  return defaults;
}

/**
 * Generate a PDF Uint8Array from a Report using the pdfme template.
 */
export async function generateReportPdf(report: Report): Promise<Uint8Array> {
  const template = await loadTemplate();
  const reportInputs = buildPdfInputs(report);

  // Merge: template defaults first, then our explicit overrides on top
  const defaults = extractDefaults(template);
  const inputs = { ...defaults, ...reportInputs };

  return generate({
    template,
    inputs: [inputs],
    plugins: { text, image, line, table },
  });
}
