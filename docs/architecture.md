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
│   ├── components/      # Componentes UI reutilizables y atómicos
│   ├── features/        # Módulos de negocio (ej. Auth)
│   ├── hooks/           # Custom Hooks (ej. useConnectivity)
│   ├── pages/           # Vistas principales (Rutas)
│   │   ├── Home/        # Dashboard principal
│   │   ├── MisReportes/ # Lista de reportes del técnico
│   │   ├── ReportEdit/  # Lógica principal del formulario (7 pasos)
│   │   └── ...
│   ├── services/        # Capa de comunicación con Firebase
│   ├── types/           # Definiciones de tipos TypeScript (Report, User, Site)
│   └── utils/           # Utilidades (generadores PDF, formateadores)
├── service/             # Scripts de administración / Backend scripts
├── docs/                # Documentación del sistema
└── ...config files      # (vite.config.ts, firebase config, etc.)
```

## Arquitectura de Datos

El sistema sigue un patrón de "Documentos" en Firestore:

1.  **users:** Almacena perfiles y roles (`admin`, `field_worker`).
2.  **sites:** Catálogo de sitios predefinidos (LPR, Cotejo Facial, etc.).
3.  **reports:** El documento central que evoluciona a través de estados.
4.  **generated_reports:** Metadatos de los PDFs finales.

### Sincronización y Offline
La aplicación implementa estrategias para funcionamiento offline/red inestable:
- **IndexedDB:** Guardado local temporal mientras se edita.
- **Debounced Save:** Escritura optimizada en Firestore para reducir lecturas/escrituras y ancho de banda.
