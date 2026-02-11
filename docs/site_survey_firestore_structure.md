Esta estructura de base de datos en Firestore está diseñada para soportar todas las Historias de Usuario (HU) detalladas, optimizando para funcionamiento *offline* (HU-02) y la sincronización (HU-03).

La estrategia principal es la **Desnormalización**: Los datos del sitio (`site`) se copian dentro del reporte. Esto garantiza que el reporte sea inmutable incluso si el catálogo de sitios cambia en el futuro y facilita la lectura offline sin realizar múltiples consultas (joins).

### 1. Colección: `users`

**Propósito:** Gestión de autenticación, roles y perfiles (HU-01).

```json
{
  "uid": "string", // ID único de Firebase Auth
  "email": "string",
  "full_name": "string",
  "role": "string", // Opciones: "admin", "field_worker"
  "group_assignment": "string", // Opciones: "grupo_a", "grupo_b" (Para filtrar HU-01)
  "is_active": true, // Para bloquear acceso sin borrar el usuario
  "created_at": "timestamp",
  "last_login": "timestamp"
}

```

---

### 2. Colección: `sites`

**Propósito:** Catálogo maestro de sitios predefinidos para autocompletado (HU-12). Origen: base de datos de sitios (LPR y Cotejo Facial). Es una colección de solo lectura para los trabajadores de campo. Los listados se filtran por **tipo** (LPR / Cotejo Facial), **distrito** y **municipio**.

```json
{
  "id": "string", // ID del documento (ej: "lpr-1", "f-1")
  "site_code": "string", // Código del punto (ej: "LPR 1", "F.1")
  "name": "string", // Nombre o referencia corta del sitio
  "address": "string", // Dirección / Ubicación (texto completo)
  "site_type": "string", // "lpr" | "cotejo_facial" (origen en base de datos sitios)
  "distrito": "string", // Ej: "DISTRITO PALMIRA", "DISTRITO BUGA"
  "municipio": "string", // Ej: "PALMIRA", "CANDELARIA", "BUGA"
  "location": "geopoint", // Coordenadas (Latitud, Longitud)
  "cameras_count": 0, // Solo LPR: cantidad de cámaras (opcional)
  "description": "string" // Información extra (opcional)
}

```

**Consultas típicas:** Listar sitios filtrados por `site_type`, `distrito` y/o `municipio` para el selector de dirección (HU-12). Índices compuestos recomendados: `site_type` + `distrito` + `municipio`, o combinaciones de dos campos.

---

### 3. Colección: `reports`

**Propósito:** Colección principal. Cada documento es un Site Survey completo.
**Soporte:** Cubre desde HU-04 hasta HU-19.

#### A. Metadatos y Flujo de Estado (HU-04, HU-07, HU-08, HU-09)

Campos para controlar en qué etapa se encuentra el reporte.

```json
{
  "id": "string", // Auto-ID de Firestore
  "status": "string", // CRÍTICO: "en_campo", "en_revision", "listo_generar", "generado"
  "created_by_uid": "string", // Referencia al worker (HU-01)
  "created_by_name": "string", // Nombre guardado para no consultar 'users' constantemente
  "assigned_group": "string", // "grupo_a" o "grupo_b"
  "created_at": "timestamp", // Fecha de creación (HU-04)
  "updated_at": "timestamp", // Para control de sincronización (HU-03)
  "completed_at": "timestamp", // Fecha cuando pasa a "En Revisión"
  "is_cloned": false, // Flag para saber si vino de un duplicado (HU-11)
  "cloned_from_id": "string", // Referencia al reporte original (HU-11)
  "pdf_url": "string" // URL del PDF final generado (HU-09)
}

```

#### B. Datos Generales del Sitio (HU-12, HU-13)

Estos datos se copian desde la colección `sites` al crear el reporte, pero pueden ser editados si la realidad en campo es diferente.

```json
{
  "site_data": {
    "reference_site_id": "string", // ID del doc en colección 'sites'
    "code": "string", // Código del punto (ej: "LPR 1", "F.1")
    "site_type": "string", // "lpr" | "cotejo_facial" (para filtros y offline)
    "distrito": "string", // Copiado del sitio (para filtros y offline)
    "municipio": "string", // Copiado del sitio (para filtros y offline)
    "name": "string", // Nombre del sitio
    "address": "string", // Dirección / Ubicación
    "location": "geopoint", // Coordenadas Lat/Lng (Editables o automáticas)
    "installation_types": [ // Array de strings (Selección múltiple HU-12)
      "fachada",
      "poste",
      "torre",
      "mastil"
    ],
    "observations": [ // Lista dinámica de textos (HU-13)
      "Observación 1: El terreno es irregular...",
      "Observación 2: Acceso difícil por zona norte..."
    ]
  }
}

```

#### C. Clasificación y Seguridad (HU-14)

```json
{
  "classification": {
    "security_level": "string", // "alto", "medio", "bajo"
    "contract_component": "string" // "valle_seguro", "lpr", "cotejo_facial"
  }
}

```

#### D. Datos Técnicos y Conectividad (HU-15)

```json
{
  "technical_details": {
    "has_line_of_sight": true, // Confirmación Línea de Vista (Check)
    "transmission_medium": "string", // "fibra_optica", "n/a"
    "cabling_type": "string", // "aereo", "subterraneo", "mixto"
    "infrastructure_inventory": {
      "boxes_to_install_qty": 0, // "Cajas a Instalar" (Numérico)
      "cameras_multisensor_qty": 0, // Inventario Hardware
      "cameras_ptz_qty": 0,
      "cameras_fixed_qty": 0
    }
  }
}

```

#### E. Evidencia Gráfica y Mapas (HU-16, HU-17)

Se almacenan las URLs de las imágenes subidas a Firebase Storage.

```json
{
  "media": {
    "map_satellite_base_url": "string", // Captura automática de Google Maps (HU-16)
    "map_diagram_edited_url": "string", // Imagen editada/dibujada por el usuario (HU-16)
    "photo_camera_view_url": "string", // Visual general de la cámara (HU-17)
    "photo_connection_view_url": "string" // Visual de la acometida (HU-17)
  }
}

```

#### F. Metrajes y Obra Civil (HU-18)

Estructura jerárquica para separar los tipos de superficie y detalles de infraestructura.

```json
{
  "measurements": {
    "post_installation": { // Sección Poste
      "aerial_length": 0.0, // Metros (float)
      "grass_length": 0.0, // Prado
      "asphalt_length": 0.0, // Asfalto
      "other_surface_length": 0.0
    },
    "facade_installation": { // Sección Fachada
      "description": "string" // Descripción breve
    }
  },
  "civil_works_details": { // Bloques A y B de infraestructura
    "connection_point": { // "Acometida"
      "conduit_type": "string", // Tipo de Tubería
      "height": 0.0, // Altura
      "other_details": "string"
    },
    "camera_point": { // "Punto de Cámara"
      "conduit_type": "string",
      "height": 0.0,
      "material": "string", // "concreto", etc.
      "other_details": "string"
    }
  }
}

```

#### G. Cierre (HU-19)

```json
{
  "closing_data": {
    "owner_entity": "string", // "Este punto pertenece a..."
    "final_observations": "string",
    // Nota: Las firmas son espacios visuales en el PDF, no datos capturados en app
    // sin embargo, guardamos los nombres de los responsables para el pie de página
    "project_director_name": "string",
    "audit_director_name": "string"
  }
}

```

---

### 4. Colección: `audit_logs`

**Propósito:** Historial de cambios de estado (Trazabilidad). Útil para saber quién aprobó qué y cuándo.

```json
{
  "id": "string",
  "report_id": "string", // Link al reporte
  "user_id": "string", // Quién hizo la acción
  "action": "string", // "create", "submit_review", "approve", "generate_pdf"
  "timestamp": "timestamp",
  "previous_status": "string",
  "new_status": "string"
}

```

### Resumen de Enumeradores (Enums)

Para mantener la integridad de los datos, utiliza estos valores exactos en el código (Dropdowns):

* **`status`**: `["en_campo", "en_revision", "listo_generar", "generado"]`
* **`site_type`** (en `sites`): `["lpr", "cotejo_facial"]`
* **`security_level`**: `["alto", "medio", "bajo"]`
* **`contract_component`**: `["valle_seguro", "lpr", "cotejo_facial"]`
* **`cabling_type`**: `["aereo", "subterraneo", "mixto"]`
* **`transmission_medium`**: `["fibra_optica", "na"]`

**Filtrado de reportes:** El dashboard (HU-06) y listados pueden filtrar por `site_data.site_type`, `site_data.distrito` y `site_data.municipio`. Conviene crear índices compuestos en `reports` para consultas por estado + tipo, estado + distrito o estado + municipio.