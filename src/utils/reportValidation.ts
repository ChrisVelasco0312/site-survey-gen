import { Report } from '../types/Report';

export interface ValidationResult {
  isValid: boolean;
  missingFields: string[];
}

export function validateReportForReview(report: Report): ValidationResult {
  const missingFields: string[] = [];

  // 1. Site is required
  // We check site_id to ensure it's a valid site from the database, 
  // but site_name is also acceptable if legacy data exists.
  if (!report.address?.site_id && !report.address?.site_name) {
    missingFields.push('Sitio / Dirección');
  }

  // 2. Map photo is required (Diagrama)
  if (!report.edited_map_image_url) {
    missingFields.push('Diagrama del sitio (Mapa editado)');
  }

  // 3. All photos are required
  if (!report.camera_view_photo_url) {
    missingFields.push('Foto de vista de cámara');
  }
  if (!report.service_entrance_photo_url) {
    missingFields.push('Foto de acometida');
  }

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
}
