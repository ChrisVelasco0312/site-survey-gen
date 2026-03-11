# Plan: Switch from `pdfme_template.json` to `template_v2.json`

## Overview

This document outlines the changes required to switch the PDF generation from using `pdfme_template.json` to `template_v2.json`.

---

## 1. Field Differences Between Templates

### Fields REMOVED (in pdfme_template, not in template_v2)
| Field Name | Description |
|------------|-------------|
| `input_description` | Description text (Distancia energía, ruta acometida, infraestructura) |
| `input_desc_facade` | Facade description section |
| `input_pa_other` | "Other" pipe type for service entrance |

### Fields NEW (in template_v2, not in pdfme_template)
| Field Name | Type | Description |
|------------|------|-------------|
| `input_inv_box_40` | number | 40x40 boxes count |
| `input_inv_box_60` | number | 60x60 boxes count |
| `input_inv_facial` | number | Facial camera count |
| `lbl_inv_box_40_40` | label | "40x40" label |
| `lbl_inv_box_60_60` | label | "60x60" label |
| `lbl_inv_facial` | label | "Facial" label |
| `lbl_inv_title_cam` | label | "Cámaras:" label |
| `field75` | rectangle | Visual element |
| `field75_rect_60` | rectangle | Visual element |
| `legend` | text | Valley Secure project description |
| `logo` | image | Valley Secure logo |
| `lbl_route_underground` | label | "Distancia de la ruta de canalización subterránea..." |
| `input_total_ruta` | text | Underground route distance (meters) |
| `lbl_installation_type` | label | "El punto de cámara se instalará con:" |
| `input_soporte_T` | text | "Soporte T [{chk_soporte_T}]" checkbox |
| `input_support_pole` | text | "Poste [{chk_poste}]" checkbox |
| `input_soporte_L` | text | "Soporte L [{chk_soporte_L}]" checkbox |
| `lbl_requires_support` | label | "Requiere instalación de punto de apoyo:" |
| `input_apoyo_si` | text | "SI [{chk_apoyo_si}]" checkbox |
| `input_apoyo_no` | text | "NO [{chk_apoyo_no}]" checkbox |
| `lbl_pa_material` | label | "Material:" for pole support |
| `input_pa_material` | text | Material value for pole support |
| `lbl_distance_electrical` | label | "DISTANCIA DE ACOMETIDA DE RED ELÉCTRICA..." |
| `lbl_distance_fiber` | label | "DISTANCIA DE ACOMETIDA FIBRA ÓPTICA..." |
| `input_distancia_electrica` | text | Electrical distance value |
| `input_distancia_fibra` | text | Fiber distance value |

---

## 2. Required Code Changes

### 2.1. Changes to `src/types/Report.ts`

Need to add new properties to support the new PDF fields:

```typescript
// New fields to add to HardwareInventory
interface HardwareInventory {
  additional_boxes: number;
  cameras_multisensor: number;
  cameras_ptz: number;
  cameras_fixed: number;
  // NEW:
  boxes_40x40?: number;     // 40x40 boxes
  boxes_60x60?: number;      // 60x60 boxes
  cameras_facial?: number;   // Facial cameras
}

// note: `input_inv_box` is the sum of boxes_40x40 + boxes_60x60

// New fields to add to PoleInfrastructure
interface PoleInfrastructure {
  aerial_meters: number;
  grass_meters: number;
  asphalt_meters: number;
  adoquin_meters: number;
  concrete_meters: number;
  fill_meters: number;
  other_surface_meters: number;
  // NEW:
  underground_route_meters?: number;  // Route distance
}

// NEW: Installation Support structure
interface InstallationSupport {
  soporte_T: boolean;
  soporte_L: boolean;
  pole: boolean;
  requires_support: boolean | null;  // null = not selected, true = SI, false = NO
}

// NEW: Distance measurements
interface InfrastructureDistances {
  electrical_meters?: number;
  fiber_meters?: number;
}

// Update InfrastructureDetails
interface InfrastructureDetails {
  service_entrance: InfrastructureDetailItem;
  camera_point: CameraPointDetail;
  // NEW:
  support?: InstallationSupport;
  distances?: InfrastructureDistances;
  pole_material?: string;
}
```

### 2.2. Changes to `src/utils/pdfGenerator.ts`

**Remove these field mappings:**
- `input_description`
- `input_desc_facade`
- `input_pa_other`

**Add these field mappings:**
- `input_inv_box_40` → `report.hardware.boxes_40x40 ?? 0`
- `input_inv_box_60` → `report.hardware.boxes_60x60 ?? 0`
- `input_inv_facial` → `report.hardware.cameras_facial ?? 0`
- `input_total_ruta` → `report.pole_infrastructure.underground_route_meters ?? ''`
- `input_soporte_T` → checkbox based on `report.infrastructure_details.support?.soporte_T`
- `input_support_pole` → checkbox based on `report.infrastructure_details.support?.pole`
- `input_soporte_L` → checkbox based on `report.infrastructure_details.support?.soporte_L`
- `input_apoyo_si` → checkbox based on `report.infrastructure_details.support?.requires_support === true`
- `input_apoyo_no` → checkbox based on `report.infrastructure_details.support?.requires_support === false`
- `input_pa_material` → `report.infrastructure_details.pole_material ?? ''`
- `input_distancia_electrica` → `report.infrastructure_details.distances?.electrical_meters ?? ''`
- `input_distancia_fibra` → `report.infrastructure_details.distances?.fiber_meters ?? ''`

**Also update:**
- `input_site_name` - Currently uses `report.address?.site_name.replace(/\D/g, "")` but should use full site name

### 2.3. Changes to `src/pages/ReportEdit/`

#### ReportEditStep3.tsx
Add new inputs for hardware inventory:
- 40x40 boxes (NumberInput)
- 60x60 boxes (NumberInput)
- Facial cameras (NumberInput)

#### ReportEditStep5.tsx (or create new section)
Add new inputs for:
- Installation support options (T-support, L-support, Pole) - checkboxes
- Requires support (Yes/No) - radio buttons
- Electrical distance (meters) - NumberInput
- Fiber distance (meters) - NumberInput

#### ReportEditStep6.tsx (Cableado)
Add:
- Underground route distance (meters) - NumberInput
- Pole support material (text input)

---

## 3. Summary of Work

| Task | Priority | Notes |
|------|----------|-------|
| Update Report.ts type definitions | Required | Add new interfaces |
| Update pdfGenerator.ts field mappings | Required | Add new fields, remove old |
| Add UI for 40x40, 60x60 boxes in Step3 | Required | Hardware inventory |
| Add UI for facial cameras in Step3 | Required | Hardware inventory |
| Add UI for installation support in Step5 | Required | T/L/Pole checkboxes |
| Add UI for requires support in Step5 | Required | Yes/No radio |
| Add UI for distances in Step5 or Step6 | Required | Electrical & Fiber meters |
| Add UI for underground route in Step6 | Required | Pole infrastructure |
| Add UI for pole material | Optional | If needed |

---

## 4. Questions/Decisions Needed

1. **Field naming**: Should the new hardware fields be `boxes_40x40` / `boxes_60x60` or `cameras_boxes_40` / `cameras_boxes_60`?

2. **Default values**: What should be the default values for the new checkbox fields?

3. **Required fields**: Should any of the new fields be mandatory for report submission?

4. **UI placement**: Where exactly should the new fields be placed in the ReportEdit wizard?

5. **Backward compatibility**: Should we keep the old `input_description` data somewhere even though it's not in the PDF anymore?
