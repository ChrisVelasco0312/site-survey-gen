# Administración de Sitios

El módulo de administración de sitios permite gestionar el catálogo de sitios del sistema: crear, editar, eliminar, importar y exportar sitios.

## Acceso

- **Ruta:** `/admin/sitios`
- **Roles permitidos:** `superadmin`, `admin`, `read_only`
- Los usuarios `read_only` pueden consultar pero no modificar.

## Funcionalidades

### Listado y Búsqueda

La vista principal muestra una tabla (escritorio) o tarjetas (móvil) con todos los sitios registrados.

- **Búsqueda:** Filtro por texto que busca en código, nombre, dirección, distrito y municipio.
- **Paginación:** 10 sitios por página.
- **Selección múltiple:** Checkboxes para seleccionar sitios (preparado para acciones en lote).

Cada sitio muestra:
- Código del sitio
- Nombre
- Tipo (LPR, PTZ, Cotejo Facial) con badges de color
- Distrito / Municipio
- Dirección
- Coordenadas

### Crear Sitio

1. Presionar el botón **"Nuevo Sitio"**.
2. Completar el formulario:
   - **Código del sitio** (requerido, único)
   - **Tipo de sitio** (LPR, PTZ, Cotejo Facial)
   - **Distrito** (selección de catálogo)
   - **Municipio** (filtrado por distrito seleccionado)
   - **Nombre del sitio**
   - **Dirección**
   - **Coordenadas:** Soporte para entrada en formato GMS (Grados, Minutos, Segundos) o decimal
   - **Cantidad de cámaras**
   - **Descripción**
3. Al guardar, el sitio se crea en Firestore y en la caché local (IndexedDB).

### Editar Sitio

1. Presionar el ícono de edición en la fila del sitio.
2. El modal se abre con los datos actuales precargados.
3. Modificar los campos necesarios y guardar.

### Ver Detalle

- Presionar el ícono de "ojo" para abrir una vista de solo lectura con toda la información del sitio.

### Eliminar Sitio

- Presionar el ícono de eliminar.
- Confirmar en el modal de confirmación.

## Importación desde Excel

El módulo permite importar sitios masivamente desde archivos Excel (`.xlsx`).

### Flujo de Importación

1. Presionar **"Excel" → "Importar desde Excel"**.
2. Seleccionar un archivo `.xlsx`.
3. El sistema analiza el archivo y genera un **plan de upsert**:
   - **Crear:** Sitios nuevos (código no existe en el sistema).
   - **Actualizar:** Sitios existentes con datos diferentes.
   - **Sin cambios:** Sitios ya existentes con datos idénticos.
   - **Fallidos:** Filas con errores de validación (se muestran los detalles del error).
4. Revisar el resumen del plan con contadores por categoría.
5. Confirmar la importación para ejecutar las operaciones.

### Plantilla Excel

- Presionar **"Excel" → "Descargar Plantilla"** para obtener un archivo `.xlsx` con las columnas esperadas y formato correcto.

## Exportación a Excel

- Presionar **"Excel" → "Exportar a Excel"** para descargar todos los sitios actuales en formato `.xlsx`.

## Coordenadas GMS

El formulario de sitios soporta entrada de coordenadas en formato **GMS** (Grados, Minutos, Segundos):

```
Ejemplo: 14° 38' 12.5" N, 90° 30' 45.2" W
```

Las coordenadas GMS se convierten automáticamente a formato decimal para almacenamiento.

## Arquitectura Técnica

- **Página:** `src/pages/SitesAdmin/index.tsx`
- **Servicio:** `src/services/sitesService.ts` (`fetchSitesAndPersist`, `createSite`, `updateSite`, `deleteSite`)
- **Excel:** `src/utils/sitesExcel.ts` (`downloadTemplate`, `parseExcelFile`, `buildUpsertPlan`, `exportSitesToExcel`)
- **Colecciones Firestore:** `sites`, `distrito_municipio`
- **Caché local:** IndexedDB (`sites`, `distrito_municipio`)
