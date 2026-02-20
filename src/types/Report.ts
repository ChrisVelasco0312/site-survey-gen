import { GroupAssignment } from './User';

// HU-04, HU-07, HU-08, HU-09
export type ReportStatus = 'en_campo' | 'en_revision' | 'listo_para_generar' | 'generado';

// HU-12
export type InstallationType = 'fachada_mastil' | 'poste' | 'torre';

// HU-14
export type SecurityLevel = 'alto' | 'medio' | 'bajo';
export type ContractComponent = 'valle_seguro' | 'lpr' | 'cotejo_facial';

// HU-15
export type TransmissionMedium = 'fibra_optica' | 'na';
export type CablingType = 'aereo' | 'subterraneo' | 'mixto';

/** Site record as stored in Firestore and IndexedDB (sites collection). */
export interface SiteRecord {
  id: string;
  site_code: string;
  site_type: 'lpr' | 'cotejo_facial' | 'ptz';
  distrito: string;
  municipio: string;
  name: string;
  address: string;
  location?: { latitude: number; longitude: number } | null;
  cameras_count: number;
  description: string;
}

export interface AddressData {
  pm_number: string;      // PM - N° / site_code
  latitude: number;
  longitude: number;
  site_name: string;
  full_address: string;
  /** Set when selected from sites catalog (for filters and sync). */
  site_id?: string;
  site_type?: 'lpr' | 'cotejo_facial' | 'ptz';
  distrito?: string;
  municipio?: string;
}

export interface ConnectivityData {
  has_line_of_sight: boolean;
  transmission_medium: TransmissionMedium;
  cabling_type: CablingType;
}

export interface HardwareInventory {
  additional_boxes: number;
  cameras_multisensor: number;
  cameras_ptz: number;
  cameras_fixed: number;
}

// HU-18
export interface PoleInfrastructure {
  aerial_meters: number;
  grass_meters: number;
  asphalt_meters: number;
  adoquin_meters: number;
  concrete_meters: number;
  fill_meters: number; // Relleno
  other_surface_meters: number;
}

export interface FacadeInfrastructure {
  description: string;
}

export interface InfrastructureDetailItem {
  pipe_type: string;
  height: string; // string to allow "3m" or descriptions if needed, or number if strict
  other: string;
}

export interface CameraPointDetail extends InfrastructureDetailItem {
  material: string; // 'Concreto', etc.
  other_material: string;
}

export interface InfrastructureDetails {
  service_entrance: InfrastructureDetailItem; // Acometida
  camera_point: CameraPointDetail;            // Punto de Cámara
}

// Main Report Interface
export interface Report {
  id: string;
  user_id: string;
  group: GroupAssignment;
  status: ReportStatus;
  created_at: number; // Timestamp
  updated_at: number; // Timestamp

  // HU-12: Datos Generales
  installation_type: InstallationType[]; // Selection multiple as per HU-12 description? Text says "Selección múltiple"
  date: string; // DD/MM/YYYY string or ISO date? Keeping string for display or ISO
  address: AddressData;

  // HU-13: Observaciones
  observations: string[]; // List of observation strings

  // HU-14: Seguridad y Contrato
  security_level: SecurityLevel;
  contract_component: ContractComponent;

  // HU-15: Datos Técnicos
  connectivity: ConnectivityData;
  hardware: HardwareInventory;

  // HU-16: Diagrama del Sitio
  map_image_url?: string;        // Original satellite image
  edited_map_image_url?: string; // Diagrammed image

  // HU-17: Evidencia Fotográfica
  camera_view_photo_url?: string;
  service_entrance_photo_url?: string;

  // HU-18: Metrajes y Adecuaciones
  pole_infrastructure: PoleInfrastructure;
  facade_infrastructure: FacadeInfrastructure;
  infrastructure_details: InfrastructureDetails;

  // HU-19: Cierre
  owner_name: string; // "Este punto de Cámara pertenece a"
  final_observations: string;
  
  // PDF Generation metadata (HU-09)
  pdf_url?: string;
}

// Helper to create an empty/initial report
export const createInitialReport = (userId: string, group: GroupAssignment): Report => ({
  id: crypto.randomUUID(),
  user_id: userId,
  group: group,
  status: 'en_campo',
  created_at: Date.now(),
  updated_at: Date.now(),
  
  installation_type: [],
  date: new Date().toLocaleDateString('es-CO'), // Default to current date DD/MM/YYYY format roughly
  address: {
    pm_number: '',
    latitude: 0,
    longitude: 0,
    site_name: '',
    full_address: ''
  },
  
  observations: [],
  
  security_level: 'medio', // Default
  contract_component: 'valle_seguro', // Default
  
  connectivity: {
    has_line_of_sight: false,
    transmission_medium: 'fibra_optica',
    cabling_type: 'aereo'
  },
  
  hardware: {
    additional_boxes: 0,
    cameras_multisensor: 0,
    cameras_ptz: 0,
    cameras_fixed: 0
  },
  
  pole_infrastructure: {
    aerial_meters: 0,
    grass_meters: 0,
    asphalt_meters: 0,
    adoquin_meters: 0,
    concrete_meters: 0,
    fill_meters: 0,
    other_surface_meters: 0
  },
  
  facade_infrastructure: {
    description: ''
  },
  
  infrastructure_details: {
    service_entrance: { pipe_type: '', height: '', other: '' },
    camera_point: { pipe_type: '', height: '', other: '', material: '', other_material: '' }
  },
  
  owner_name: '',
  final_observations: ''
});
