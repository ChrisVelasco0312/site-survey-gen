import { GroupAssignment } from './User';
import { Shape } from './Shape';

// HU-04, HU-07, HU-08, HU-09
export type ReportStatus = 'en_campo' | 'en_revision' | 'listo_para_generar' | 'generado';

// HU-12
export type InstallationType = 'fachada_mastil' | 'poste' | 'torre' | 'terraza' | 'estructura';

// HU-14
export type SecurityLevel = 'alto' | 'medio' | 'bajo';
export type ContractComponent = 'valle_seguro' | 'lpr' | 'cotejo_facial';

// HU-15
export type TransmissionMedium = 'fibra_optica' | 'radio_enlace' | 'na';
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

export interface MapPinData {
  id: string;
  lat: number;
  lon: number;
  color: string;
  label: string;
  showLabel?: boolean;
}

export interface ConnectivityData {
  has_line_of_sight: boolean;
  transmission_medium: TransmissionMedium;
  cabling_type: CablingType;
}

export interface HardwareInventory {
  cameras_facial: number;
  cameras_multisensor: number;
  cameras_ptz: number;
  cameras_fixed: number;
  cameras_lpr: number;
  boxes_40: number;
  boxes_60: number;
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
  material: string; // Added material here for service_entrance (Acometida) too
  other: string;
}

export interface CameraPointDetail extends InfrastructureDetailItem {
  other_material: string;
}

export interface InfrastructureDetails {
  service_entrance: InfrastructureDetailItem; // Acometida
  camera_point: CameraPointDetail;            // Punto de Cámara
  
  // New fields
  camera_mounting?: 'soporte_t' | 'poste' | 'soporte_l';
  needs_support_point?: boolean;
  
  electrical_distance?: number;
  fiber_distance?: number;
  apoyo_cant?: number;
}

export interface CotejoFacialSurvey {
  zona_tipo?: 'peatonal' | 'mixta';
  estructura_tipo?: 'poste' | 'muro' | 'techo' | 'portico' | 'otro';
  estructura_otro?: string;
  altura_proyectada?: number;
  distancia_rostro_camara?: number;
  area_cobertura?: string;
  angulo_horizontal?: number;
  angulo_vertical?: number;
  iluminacion_estado?: 'con_iluminacion' | 'sin_iluminacion';
  punto_electrico_cercano?: boolean;
  distancia_punto_electrico?: number;
  tipo_enlace?: 'fibra_optica' | 'inalambrico';
  distancia_canalizacion?: number;
  riesgos_identificados?: ('vandalismo' | 'contraluz' | 'sombras' | 'obstaculos' | 'alto_trafico')[];
  detalle_riesgos?: string;
}

export interface LprSurvey {
  sentido_vial?: 'unidireccional_norte_sur' | 'unidireccional_sur_norte' | 'unidireccional_oriente_occidente' | 'unidireccional_occidente_oriente' | 'unidireccional_nororiente_suroccidente' | 'unidireccional_noroeste_sureste' | 'bidireccional_norte_sur' | 'bidireccional_sur_norte' | 'bidireccional_oriente_occidente' | 'bidireccional_occidente_oriente' | 'bidireccional_nororiente_suroccidente' | 'bidireccional_noroeste_sureste';
  numero_carriles?: 1 | 2 | 3 | 4;
  distancia_camara_placas?: number;
  altura_instalacion?: number;
  angulo_horizontal?: 'menor_30' | '30_a_45' | 'mayor_45';
  angulo_vertical?: number;
  fov_carriles?: 1 | 2 | 3 | 4;
  obstaculo_fov?: boolean;
  obstaculo_descripcion?: string;
  iluminacion_estado?: 'sin_iluminacion_publica' | 'con_iluminacion_publica';
  condiciones_sitio?: ('riesgo_electrico' | 'cables_aereos' | 'obra_interferencias' | 'alto_flujo' | 'otros')[];
  condiciones_sitio_otros?: string;
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
  map_pins?: MapPinData[];       // Additional map pins
  main_map_pin?: Partial<MapPinData>; // Customization for the main pin
  map_zoom?: number;             // Saved zoom level
  map_pin_size?: number;         // Saved pin size multiplier
  legend_config?: {
    x?: number; // relative to canvas width (or absolute pixels? let's stick to absolute for now or relative if we want responsivenes, but canvas is fixed size)
    // Actually canvas size is fixed const CANVAS_WIDTH = 1732;
    y?: number;
    scale?: number;
  };

  // HU-17: Evidencia Fotográfica
  camera_view_photo_url?: string;
  camera_view_photo_original_url?: string;
  camera_view_photo_shapes?: Shape[];

  service_entrance_photo_url?: string;
  service_entrance_photo_original_url?: string;
  service_entrance_photo_shapes?: Shape[];

  // HU-18: Metrajes y Adecuaciones
  pole_infrastructure: PoleInfrastructure;
  facade_infrastructure: FacadeInfrastructure;
  infrastructure_details: InfrastructureDetails;

  // HU-19: Cierre
  owner_name: string; // "Este punto de Cámara pertenece a"
  final_observations: string;
  
  // PDF Generation metadata (HU-09)
  pdf_url?: string;

  // HU-20: Cotejo Facial
  cotejo_facial_survey?: CotejoFacialSurvey;
  lpr_survey?: LprSurvey;
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
    cameras_facial: 0,
    cameras_multisensor: 0,
    cameras_ptz: 0,
    cameras_fixed: 0,
    cameras_lpr: 0,
    boxes_40: 0,
    boxes_60: 0
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
    service_entrance: { pipe_type: '', height: '', other: '', material: '' },
    camera_point: { pipe_type: '', height: '', other: '', material: '', other_material: '' },
    needs_support_point: false,
    apoyo_cant: 0,
    electrical_distance: 0,
    fiber_distance: 0
  },
  
  owner_name: '',
  final_observations: '',
  cotejo_facial_survey: {},
  lpr_survey: {}
});
