# Plan de Implementación: Pestaña "Resumen" en AdminDashboard

Este documento describe el plan de implementación para agregar una nueva pestaña de resumen en la vista del `AdminDashboard`.

## 1. Crear el Componente `SitesSummary`

**Archivo:** `src/pages/Home/SitesSummary.tsx`

**Descripción:**
- Importará los componentes de interfaz de `@mantine/core` (`Card`, `Grid`, `Table`, `RingProgress`, `ScrollArea`, `Loader`, `Text`, `Badge`, `Group`, `Title`).
- Fetch de los datos:
  - Importará `getAllReports` de `../../services/reportsService`.
  - Importará `fetchSitesAndPersist` de `../../services/sitesService`.
  - Hará el fetch inicial de los reportes y sitios directamente dentro del componente o los recibirá como *props* (es preferible que `AdminDashboard` los pase o que `SitesSummary` los haga de manera asíncrona. En este caso haremos que el componente `SitesSummary` cargue su propia información para no sobrecargar el componente principal).
- Procesará los datos para relacionar cada sitio con su último reporte (buscando coincidencias entre `site.id` y `report.address.site_id`).
- Si un sitio no tiene ningún reporte asocidado, su estado se clasificará como `'sin_iniciar'`.
- De lo contrario, se usará el estado actual del último reporte actualizado (`'en_campo'`, `'en_revision'`, `'listo_para_generar'`, `'generado'`).
- Calculará las métricas:
  - **Global:** Totales por cada estado para todo el universo de sitios.
  - **Por Distrito y Municipio:** Agrupación jerárquica para llenar la tabla.
- **Renderizado:**
  - Una sección superior con Tarjetas (`Cards`) y gráficos de anillos (`RingProgress`) mostrando los porcentajes globales y totales (ej. `3 (30%)`).
  - Una sección inferior con una Tabla Jerárquica donde las filas principales sean los Distritos y las filas secundarias los Municipios, mostrando el desglose.

## 2. Modificar el Componente Principal `AdminDashboard`

**Archivo:** `src/pages/Home/AdminDashboard.tsx`

**Descripción:**
- Actualmente `AdminDashboard.tsx` usa el componente `Tabs` (`<Tabs value={activeTab}>`).
- Se añadirá un nuevo `Tabs.Tab` llamado "Resumen" (`<Tabs.Tab value="resumen">Resumen</Tabs.Tab>`).
- Se importará el nuevo componente `<SitesSummary />`.
- Se creará un `<Tabs.Panel value="resumen">` que contendrá el componente `<SitesSummary />`.
- El Tab por defecto será "Resumen" o se dejará como "En Campo" según preferencia, pero añadiremos "Resumen" como la primera opción de la lista.

## 3. Verificación y Pruebas

- Asegurar que la aplicación compile sin errores de tipado (`npm run tsc` o equivalente).
- Verificar que el diseño de las tarjetas (grids) sea completamente responsive (`span={{ base: 12, md: ... }}`).
- Validar visualmente que los conteos de la tabla jerárquica coincidan con el total global de sitios y de estados.
