# Plan de Implementación - Sistema de Reportes Site Survey

Este documento detalla el plan paso a paso para la implementación del sistema de reportes basado en las historias de usuario y requerimientos del proyecto.

## Fase 1: Cimientos y Datos (Offline First)

Esta fase establece las bases para que la aplicación funcione sin conexión (HU-02) y maneje los datos correctamente.

1.  **Definición de Modelos de Datos (TypeScript Interfaces)**
    *   [x] Crear `src/types/Report.ts`: Definir la estructura completa del reporte (campos de todas las HUs: General, Técnico, Fotos, etc.) y los tipos auxiliares (Estado, Rol, Coordenadas).
    *   [x] Crear `src/types/User.ts`: Definir interfaces para los roles de usuario (Admin, Trabajador).

2.  **Configuración de Base de Datos Local (IndexedDB)**
    *   [x] Actualizar `src/utils/indexedDB.ts`: Agregar stores para `reports` (guardar reportes) y `syncQueue` (cola de cambios pendientes de subir).
    *   [x] Crear métodos CRUD básicos para reportes en IndexedDB (`saveReport`, `getReport`, `getAllReports`, `deleteReport`).

3.  **Servicio de Sincronización (HU-03)**
    *   [x] Crear `src/services/SyncService.ts`: Lógica para detectar conexión a internet, subir reportes pendientes de `syncQueue` a Firebase Firestore y bajar actualizaciones.
    *   [x] Crear Hook `useConnectivity`: Para que la UI sepa si hay internet o no y muestre el estado ("Sincronizado", "Sincronizando...", "Sin conexión").

## Fase 2: Gestión y Navegación (Roles y Listas)

Aquí implementaremos las vistas principales donde los usuarios gestionan sus reportes (HU-01, HU-05, HU-06).

4.  **Ruteo por Roles y Dashboard Admin (HU-01, HU-06)**
    *   [x] Modificar `src/pages/Home/index.tsx`: Si es Admin, mostrar Dashboard General (tabla con todos los reportes, filtros por estado). Si es Trabajador, redirigir a "Mis Reportes".
    *   [x] Implementar `src/components/RoleBasedRoute.tsx`: Para proteger rutas según el rol del usuario.

5.  **Vista "Mis Reportes" (HU-05)**
    *   [x] Implementar en `src/pages/MisReportes/index.tsx`: Tabs para "En Campo" (editables) y "En Revisión/Finalizados" (solo lectura).
    *   [x] Conectar con IndexedDB para listar reportes locales.
    *   [x] Añadir indicadores visuales del estado de cada reporte.

6.  **Acción "Crear Reporte" (HU-04, HU-11)**
    *   [x] Crear botón flotante o principal para iniciar un nuevo reporte.
    *   [x] Lógica para inicializar un objeto `Report` vacío con ID único, fecha actual y estado "En campo".
    *   [x] Implementar "Duplicar Reporte" (HU-11): Crear una copia de un reporte existente como nuevo.

## Fase 3: El Formulario de Site Survey (El Núcleo)

Desarrollaremos el formulario dividido en pasos lógicos o pestañas para manejar la complejidad (HU-12 a HU-19). Crearemos un componente `ReportFormContainer`.

7.  **Estructura del Formulario**
    *   [ ] Crear `src/pages/ReportEdit/index.tsx`: Componente contenedor del formulario.
    *   [ ] Implementar navegación por pasos/tabs dentro del formulario.

8.  **Paso 1: Datos Generales y Ubicación (HU-12)**
    *   [ ] Formulario con Fecha, Tipo Instalación.
    *   [ ] Selector de Dirección (Mock o base de datos simple de sitios) que autocompleta Lat/Long y Nombre.

9.  **Paso 2: Seguridad y Contrato (HU-14) + Observaciones (HU-13)**
    *   [ ] Selectores para Nivel de Seguridad y Componentes del Contrato.
    *   [ ] Lista dinámica para agregar múltiples observaciones.

10. **Paso 3: Datos Técnicos e Infraestructura (HU-15)**
    *   [ ] Checks de Línea de Vista, Medio de Transmisión.
    *   [ ] Campos para Inventario de Hardware (cámaras, PTZ, fijas).
    *   [ ] Campos para Infraestructura Adicional.

11. **Paso 4: Diagrama y Mapa (HU-16)**
    *   [ ] Integración básica de mapa (OpenStreetMap/Leaflet o Google Static) para mostrar ubicación.
    *   [ ] Input para subir la imagen del diagrama editado.
    *   [ ] Validar que la imagen editada esté presente antes de enviar.

12. **Paso 5: Evidencia Fotográfica (HU-17)**
    *   [ ] Inputs para subir fotos (Visual cámara, Acometida).
    *   [ ] Implementar compresión de imagen antes de guardar en IndexedDB (usando `browser-image-compression` o canvas).

13. **Paso 6: Metrajes y Civil (HU-18)**
    *   [ ] Tablas para ingresar metros de cableado (Poste/Fachada) y detalles de tubería.
    *   [ ] Validaciones: Al menos un campo debe tener valor > 0.

14. **Paso 7: Cierre y Guardado (HU-19)**
    *   [ ] Campos finales: "Este punto pertenece a", Observaciones finales.
    *   [ ] Guardado automático en cada paso hacia IndexedDB.

## Fase 4: Flujo de Trabajo y Salida

Finalizar el ciclo de vida del reporte y generar los entregables.

15. **Transiciones de Estado (HU-07, HU-08)**
    *   [ ] Botón "Enviar a Revisión" (Trabajador): Valida y cambia estado a "En Revisión", bloquea edición.
    *   [ ] Botón "Aprobar/Corregir" (Admin): Permite editar y cambiar a "Listo para generar".

16. **Generación de PDF (HU-09, HU-10)**
    *   [ ] Instalar librería de generación de PDF (`jspdf` + `jspdf-autotable` o `@react-pdf/renderer`).
    *   [ ] Diseñar el layout del PDF según requerimientos.
    *   [ ] Implementar "Vista Previa" (con marca de agua) y "Generar Final" (subir a Storage y vincular URL).
