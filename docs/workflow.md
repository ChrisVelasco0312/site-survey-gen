# Flujos y Estados del Sistema

Esta sección describe el ciclo de vida de un reporte y cómo interactúan los diferentes roles en el sistema.

## Roles del Sistema

El sistema gestiona dos roles principales con permisos diferenciados:

1.  **Técnico de Campo (`field_worker`):**
    -   Crea y edita reportes en estado `en_campo`.
    -   Envía reportes para revisión (`en_revision`).
    -   Visualiza reportes asignados en "Mis Reportes".

2.  **Administrador (`admin`):**
    -   Acceso global a todos los reportes.
    -   Revisa reportes enviados (`en_revision`).
    -   Aprueba reportes para generación (`listo_para_generar`).
    -   Genera el PDF final y lo firma (`generado`).
    -   Capacidad de habilitar/deshabilitar edición en fases avanzadas.

## Ciclo de Vida del Reporte

El reporte avanza a través de una máquina de estados definida. Los cambios de estado son unidireccionales para asegurar la integridad de los datos, salvo intervenciones administrativas.

```mermaid
stateDiagram-v2
    [*] --> en_campo: Creación del Reporte (Técnico)
    
    en_campo --> en_revision: Envío a Revisión
    note right of en_campo
        Edición completa permitida
        Guardado local y remoto
    end note

    en_revision --> listo_para_generar: Aprobación (Admin)
    en_revision --> en_campo: Rechazo/Devolución (Admin)
    note right of en_revision
        Solo lectura para el Técnico
        Admin puede habilitar edición
    end note

    listo_para_generar --> generado: Generar PDF (Admin)
    note right of listo_para_generar
        Reporte bloqueado
        PDF listo para compilar
    end note

    generado --> [*]
    note right of generado
        PDF subido a Storage
        Documento finalizado
    end note
```

## Flujo de Trabajo del Usuario

El siguiente diagrama ilustra la interacción típica de un usuario con la aplicación:

```mermaid
graph TD
    A[Inicio de Sesión] --> B{Rol de Usuario}
    
    B -->|Técnico| C[Mis Reportes]
    B -->|Admin| D[Dashboard Admin]
    
    C --> E[Editar Reporte Existente]
    C --> F[Crear Nuevo Reporte]
    
    E --> G{Estado del Reporte}
    
    G -->|En Campo| H[Formulario de 7 Pasos]
    H --> I[Datos Generales]
    H --> J[Infraestructura]
    H --> K[Fotos y Evidencia]
    H --> L[Diagrama]
    
    L --> M[Guardar Cambios]
    M --> N[Enviar a Revisión]
    
    N --> O((Fin Flujo Técnico))
    
    D --> P[Revisar Reportes Pendientes]
    P --> Q[Aprobar Reporte]
    Q --> R[Generar PDF Final]
    R --> S[Descargar/Enviar]
```

## Descripción de los Pasos del Formulario

El proceso de edición (`ReportEdit`) se divide en 7 pasos lógicos para facilitar la recolección de datos en móviles:

1.  **Datos generales y ubicación:** Información básica del sitio (LPR, Cotejo, Dirección).
2.  **Seguridad, contrato y observaciones:** Niveles de seguridad y notas iniciales.
3.  **Datos técnicos e infraestructura:** Conectividad (Fibra, Radio), Hardware existente.
4.  **Diagrama y mapa:** Edición visual sobre mapa satelital (Croquis).
5.  **Evidencia fotográfica:** Carga de fotos de puntos clave (Acometida, Vista de cámara).
6.  **Metrajes y civil:** Distancias (Cables, Zanjas) y detalles de obra civil.
7.  **Cierre y guardado:** Observaciones finales y firma del responsable.
