import { Report, ReportStatus } from '../types/Report';
import { GroupAssignment } from '../types/User';

// Simple toggle for preview mode
export const USE_MOCK_DATA = true;

const BASE_DATE = new Date();

const getRandomStatus = (): ReportStatus => {
  const statuses: ReportStatus[] = ['en_campo', 'en_revision', 'listo_para_generar', 'generado'];
  return statuses[Math.floor(Math.random() * statuses.length)];
};

const getRandomGroup = (): GroupAssignment => {
  const groups: GroupAssignment[] = ['grupo_a', 'grupo_b'];
  return groups[Math.floor(Math.random() * groups.length)];
};

export const generateMockReports = (userId?: string, count: number = 10): Report[] => {
  return Array.from({ length: count }).map((_, i) => {
    const status = getRandomStatus();
    const group = getRandomGroup();
    const date = new Date(BASE_DATE);
    date.setDate(BASE_DATE.getDate() - i); // Past dates

    return {
      id: `mock-report-${i + 1}`,
      user_id: userId || `mock-user-${i % 2 === 0 ? 'A' : 'B'}`,
      group: group,
      status: status,
      created_at: date.getTime(),
      updated_at: date.getTime(),
      date: date.toLocaleDateString('es-CO'),
      
      installation_type: i % 2 === 0 ? ['poste'] : ['fachada_mastil'],
      
      address: {
        pm_number: `PM-${100 + i}`,
        latitude: 4.6097 + (Math.random() * 0.1),
        longitude: -74.0817 + (Math.random() * 0.1),
        site_name: `Sitio de Prueba ${i + 1}`,
        full_address: `Calle ${10 + i} # ${20 + i} - ${30 + i}, Bogotá`
      },

      observations: [
        'Observación de prueba 1: El sitio tiene buen acceso.',
        'Observación de prueba 2: Requiere permiso especial.'
      ],

      security_level: i % 3 === 0 ? 'alto' : 'medio',
      contract_component: 'valle_seguro',

      connectivity: {
        has_line_of_sight: Math.random() > 0.5,
        transmission_medium: 'fibra_optica',
        cabling_type: 'aereo'
      },

      hardware: {
        additional_boxes: 1,
        cameras_multisensor: 0,
        cameras_ptz: 1,
        cameras_fixed: 0
      },

      pole_infrastructure: {
        aerial_meters: 50,
        grass_meters: 0,
        asphalt_meters: 10,
        other_surface_meters: 0
      },

      facade_infrastructure: {
        description: 'Fachada en ladrillo a la vista.'
      },

      infrastructure_details: {
        service_entrance: { pipe_type: 'IMC 3/4"', height: '4m', other: '' },
        camera_point: { pipe_type: 'EMT 1"', height: '3.5m', other: '', material: 'Concreto', other_material: '' }
      },

      owner_name: 'Propietario Demo',
      final_observations: 'Todo listo para instalación.'
    };
  });
};
