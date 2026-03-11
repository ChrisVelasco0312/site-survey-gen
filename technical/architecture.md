# Arquitectura del Sistema

Site Survey Generator es una aplicación web moderna diseñada para facilitar la recolección de datos en campo y la generación automática de reportes técnicos.

## Stack Tecnológico

El proyecto utiliza un conjunto de tecnologías robustas y modernas centradas en el rendimiento y la experiencia de usuario:

### Frontend
- **Framework:** [Preact](https://preactjs.com/) (v10) - Una alternativa ligera y rápida a React.
- **Build Tool:** [Vite](https://vitejs.dev/) - Para un entorno de desarrollo rápido y builds optimizados.
- **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) - Para tipado estático y mayor seguridad en el código.
- **UI Library:** [Mantine](https://mantine.dev/) - Componentes de interfaz de usuario accesibles y personalizables.
- **Iconos:** Tabler Icons.
- **Estado Global/Contexto:** React Context API (via `AuthContext`, `ConnectivityContext`).

### Backend & Servicios (Serverless)
- **Plataforma:** [Firebase](https://firebase.google.com/).
- **Base de Datos:** Cloud Firestore (NoSQL).
- **Autenticación:** Firebase Authentication.
- **Almacenamiento:** Firebase Storage (para imágenes y PDFs generados).
- **Hosting:** (Implícito) Firebase Hosting o similar para servir los estáticos.

### Generación de Reportes
- **Motor PDF:** [@pdfme/generator](https://pdfme.com/) - Generación de PDFs basada en esquemas y plantillas JSON.

## Estructura del Proyecto

La organización del código sigue una estructura modular:

```
/
├── src/
│   ├── assets/          # Recursos estáticos (imágenes, SVGs)
│   ├── components/      # Componentes UI reutilizables
│   │   ├── ImageEditor/ # Editor de imágenes (anotaciones sobre fotos)
│   │   ├── ProtectedLayout.tsx
│   │   └── RoleBasedRoute.tsx
│   ├── features/        # Módulos de negocio
│   │   └── auth/        # Autenticación (Login, AuthContext)
│   ├── hooks/           # Custom Hooks (useConnectivity, etc.)
│   ├── pages/           # Vistas principales (Rutas)
│   │   ├── Home/        # Dashboard admin (AdminDashboard, SitesSummary)
│   │   ├── MisReportes/ # Lista de reportes del técnico
│   │   ├── ReportEdit/  # Formulario de reporte (6 pasos + variantes)
│   │   ├── ReportesFinales/ # Reportes generados
│   │   ├── SitesAdmin/  # Administración de sitios (CRUD, Excel)
│   │   └── UsersAdmin/  # Administración de usuarios
│   ├── services/        # Capa de comunicación con Firebase
│   │   ├── reportsService.ts
│   │   ├── sitesService.ts
│   │   ├── userAdminService.ts
│   │   ├── generatedReportsService.ts
│   │   └── SyncService.ts
│   ├── types/           # Definiciones de tipos (Report, User, Site, Shape)
│   └── utils/           # Utilidades
│       ├── pdfGenerator.ts   # Generación de PDF con @pdfme
│       ├── indexedDB.ts      # Persistencia offline
│       ├── mapLegend.ts      # Leyenda del mapa
│       └── sitesExcel.ts     # Importación/exportación Excel
├── service/             # Scripts de administración / Backend scripts
├── docs/                # Documentación del sistema
└── ...config files      # (vite.config.ts, firebase config, etc.)
```

## Arquitectura de Datos

El sistema sigue un patrón de "Documentos" en Firestore:

| Colección | Descripción |
|---|---|
| **users** | Perfiles y roles (`superadmin`, `admin`, `field_worker`, `read_only`) |
| **sites** | Catálogo de sitios predefinidos (LPR, Cotejo Facial, PTZ) |
| **reports** | Documento central que evoluciona a través de estados |
| **generated_reports** | Metadatos y referencia a los PDFs finales en Storage |
| **distrito_municipio** | Catálogo de distritos y municipios |

### Almacenamiento (Firebase Storage)
- **Imágenes de reportes:** Fotos de evidencia (visual de cámara, acometida).
- **PDFs generados:** Reportes finales firmados.

### Sincronización y Offline
La aplicación implementa estrategias para funcionamiento offline/red inestable:
- **IndexedDB:** Guardado local de reportes, sitios, usuario y cola de sincronización.
- **SyncService:** Procesa la cola de sincronización al recuperar conexión y cada 5 minutos.
- **Debounced Save:** Escritura optimizada en Firestore para reducir lecturas/escrituras y ancho de banda.

## Autenticación y Autorización

- **Firebase Authentication:** Login con email/contraseña.
- **AuthContext:** Contexto global con estado del usuario y datos del perfil.
- **ProtectedLayout:** Redirige a `/login` si no está autenticado.
- **RoleBasedRoute:** Restringe acceso a rutas según el rol del usuario.
