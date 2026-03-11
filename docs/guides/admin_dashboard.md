# Dashboard Administrativo

El dashboard es la vista principal para usuarios con rol de administrador o superadministrador. Proporciona una visión general del estado de los reportes y sitios del sistema.

## Acceso

- **Ruta:** `/` (página de inicio para administradores)
- **Roles:** `admin`, `superadmin`
- Los técnicos de campo son redirigidos automáticamente a **Mis Reportes**.

## Pestañas del Dashboard

### Resumen (SitesSummary)

Vista consolidada del progreso de los sitios con respecto a los reportes.

**Métricas globales:**
- Total de sitios registrados.
- Conteo por estado: Sin Iniciar, En Campo, En Revisión, Listos para Generar, Generados.
- Gráficos de anillo (Ring Progress) para cada estado.

**Tabla jerárquica:**
La tabla muestra el desglose de sitios por nivel geográfico:

| Nivel | Ejemplo |
|---|---|
| **Distrito** | Fila en negrita con totales del distrito |
| **Municipio** | Fila indentada con totales del municipio |
| **Tipo de Sitio** | Fila más indentada (LPR, PTZ, Cotejo Facial) |

Columnas: Total, Sin Iniciar, En Campo, En Revisión, Listos, Generados.

**Filtros:**
- Distrito
- Municipio
- Tipo de Sitio
- Botón "Limpiar Filtros" para restablecer.

### En Campo

Lista de todos los reportes en estado `en_campo` (actualmente siendo editados por técnicos).

**Información mostrada:**
- Fecha del reporte
- Dirección del sitio
- Grupo del técnico (Administrador, Grupo 1, Grupo 2)
- Estado con badge de color
- Botón "Ver Detalles" que navega a `/reporte/{id}`

### En Revisión

Lista de reportes en estado `en_revision` (enviados por técnicos, pendientes de aprobación).

**Misma estructura que la pestaña "En Campo"**, filtrada por estado `en_revision`.

## Vista Responsiva

- **Escritorio:** Tabla con columnas.
- **Móvil:** Tarjetas (cards) apiladas verticalmente con la misma información.

## Arquitectura Técnica

- **Dashboard:** `src/pages/Home/AdminDashboard.tsx`
- **Resumen:** `src/pages/Home/SitesSummary.tsx`
- **Servicios:** `getAllReports()`, `fetchSitesAndPersist()`
- **Datos:** Cruza información de las colecciones `reports` y `sites` para calcular el progreso.
