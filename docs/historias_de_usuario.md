# Historias de Usuario - Sistema de Reportes Site Survey

Este documento detalla las historias de usuario para el desarrollo de la aplicación móvil/web de generación de reportes de Site Survey.

## Roles de Usuario
*   **Trabajador de Campo (Representante Grupo A / Grupo B):** Usuario que realiza la visita técnica, recolecta datos y fotos en sitio. Requiere funcionamiento offline.
*   **Administrador:** Usuario que gestiona, revisa, aprueba reportes y genera los entregables finales (PDF).

---

## Épica 1: Gestión de Sesión y Conectividad

### HU-01: Acceso y Roles
**Como** usuario del sistema,
**Quiero** ingresar con mis credenciales y tener un rol asignado (Grupo A, Grupo B o Admin),
**Para** acceder a las funciones correspondientes a mi perfil.

**Criterios de Aceptación:**
*   El sistema debe validar usuario y contraseña.
*   Si es Trabajador de Campo, la vista inicial debe ser la lista de sus reportes.
*   Si es Admin, la vista inicial debe ser el Dashboard general.
*   La aplicación debe persistir la sesión para permitir el trabajo offline posterior.

### HU-02: Funcionamiento Offline (Modo Desconectado)
**Como** Trabajador de Campo,
**Quiero** poder crear y editar reportes sin conexión a internet,
**Para** poder trabajar en sitios remotos o sin cobertura.

**Criterios de Aceptación:**
*   La aplicación debe permitir abrir formularios, guardar cambios y crear nuevos reportes sin red.
*   Los datos deben guardarse localmente en el dispositivo.
*   Las imágenes tomadas o subidas deben almacenarse localmente hasta que haya conexión.
*   No se debe bloquear ninguna funcionalidad de edición por falta de internet (excepto aquellas que requieran consultas externas en tiempo real explícitas, aunque se deben buscar estrategias de caché).

### HU-03: Sincronización Automática y Estado de Conexión
**Como** usuario,
**Quiero** que el sistema sincronice mis datos automáticamente cuando recupere la conexión y me informe del estado,
**Para** asegurar que la información no se pierda y esté disponible en la nube.

**Criterios de Aceptación:**
*   Debe existir un indicador visual de estado: "Sincronizado", "Sincronizando...", "Sin conexión / Cambios pendientes".
*   La sincronización debe ocurrir en segundo plano cuando se detecte internet.
*   Si hay conflictos de sincronización, se debe notificar (aunque por flujo, el trabajador edita "En Campo" y el Admin "En Revisión", minimizando conflictos).

---

## Épica 2: Gestión y Flujo de Reportes

### HU-04: Creación de Nuevo Reporte (En Campo)
**Como** Trabajador de Campo,
**Quiero** crear un nuevo reporte con un solo clic,
**Para** iniciar el trabajo rápidamente.

**Criterios de Aceptación:**
*   Al hacer clic en "Nuevo Reporte", se crea inmediatamente un registro.
*   El estado inicial es **"En campo (en edición)"**.
*   Se asigna automáticamente la fecha de creación.
*   El reporte aparece en la lista de "Reportes en campo".
*   Si el usuario sale, al volver puede retomar la edición desde la lista.

### HU-05: Listado de Reportes (Vista Trabajador)
**Como** Trabajador de Campo,
**Quiero** ver una lista de mis reportes filtrada por estado,
**Para** organizar mi trabajo y saber qué está pendiente.

**Criterios de Aceptación:**
*   Pestañas o filtros para: "En Campo", "En Revisión", "Historial/Generados".
*   En "En Campo", puedo seleccionar un reporte para seguir editando.
*   En "En Revisión", puedo ver los reportes enviados pero no editarlos.
*   Indicadores visuales claros del estado de cada reporte.

### HU-06: Dashboard General (Vista Admin)
**Como** Administrador,
**Quiero** ver un dashboard con todos los reportes de todos los grupos,
**Para** monitorear el avance del proyecto.

**Criterios de Aceptación:**
*   Lista consolidada de reportes.
*   Columnas/Datos visibles: Fecha reporte, Dirección, Grupo Reportante (Nombre Representante), Estado actual.
*   Capacidad de filtrar por estado ("En revisión", "Listo para generar", etc.).

### HU-07: Cambio de Estado a "En Revisión"
**Como** Trabajador de Campo,
**Quiero** enviar un reporte completado a revisión,
**Para** que el administrador valide la información.

**Criterios de Aceptación:**
*   Botón "Enviar a revisión" disponible solo en estado "En campo".
*   Al accionar, el estado cambia a **"En revisión"**.
*   El reporte desaparece de la lista de editables del trabajador y pasa a solo lectura.
*   El reporte se hace visible/notorio para el Admin como pendiente de revisar.

### HU-08: Revisión y Aprobación (Admin)
**Como** Administrador,
**Quiero** revisar un reporte y marcarlo como "Listo para generar",
**Para** autorizar la creación del entregable final.

**Criterios de Aceptación:**
*   El Admin puede editar cualquier campo del reporte si encuentra errores menores.
*   Botón "Marcar como Listo para generar" disponible para el Admin en reportes "En Revisión".
*   El estado cambia a **"Listo para generar"**.

### HU-09: Generación de Reporte Final (PDF)
**Como** Administrador,
**Quiero** generar el reporte final en PDF desde el sistema,
**Para** vincularlo al registro y finalizar el proceso.

**Criterios de Aceptación:**
*   Botón "Generar Reporte" disponible solo en estado "Listo para generar" y solo para Admin.
*   La acción debe generar el PDF con el formato definido.
*   El PDF se sube automáticamente a la nube y se vincula al registro.
*   El estado cambia a **"Reporte generado"**.
*   Esta acción requiere conexión a internet (validación explícita).

### HU-10: Previsualización de PDF
**Como** Trabajador de Campo,
**Quiero** generar una vista previa del PDF con una marca de agua,
**Para** verificar cómo se verán los datos antes de enviar.

**Criterios de Aceptación:**
*   Opción disponible en estado "En campo".
*   Genera el PDF con los datos actuales.
*   El PDF debe tener una marca de agua visible: "PREVISUALIZACIÓN - NO VÁLIDO COMO REPORTE FINAL".

### HU-11: Duplicar Reporte
**Como** usuario (Trabajador o Admin),
**Quiero** duplicar un reporte existente (incluso uno finalizado),
**Para** usarlo como base para un nuevo punto cercano o similar.

**Criterios de Aceptación:**
*   Opción "Duplicar/Copiar" disponible en reportes "En Revisión" y "Generados".
*   La copia se crea como un NUEVO reporte en estado **"En campo"**.
*   Toda la información se copia excepto: Fecha de creación (se actualiza a hoy), Fotos (opcional, definir si se limpian o mantienen, por defecto mantener datos de texto y limpiar fotos específicas del sitio suele ser mejor, pero según requerimiento: "copia de reporte"). *Nota técnica: Copiar todo el contenido editable.*

---

## Épica 3: Formulario de Site Survey

### HU-12: Datos Generales y Selección de Dirección
**Como** usuario,
**Quiero** seleccionar la dirección de una lista predefinida y que se autocompleten los datos geográficos,
**Para** evitar errores de digitación en coordenadas y nomenclatura.

**Criterios de Aceptación:**
*   Campo "Fecha": Automático (Día/Mes/Año).
*   Campo "Tipo Instalación": Selección múltiple (Fachada/mástil, Poste, Torre).
*   Campo "Dirección": Modal/Buscador conectado a base de datos de sitios predefinidos.
*   Al seleccionar dirección:
    *   Se autocompleta: "PM - N°".
    *   Se autocompleta: Latitud, Longitud, Nombre del sitio.
    *   Se descargan estos valores para disponibilidad offline si se sincronizó previamente.

### HU-13: Información Geográfica y Observaciones
**Como** usuario,
**Quiero** ingresar observaciones detalladas sobre el nodo,
**Para** registrar particularidades del sitio.

**Criterios de Aceptación:**
*   Campo "Observaciones": Lista dinámica que permite agregar múltiples filas de texto.
*   (Opcional/Futuro) Selección de observaciones predefinidas.

### HU-14: Clasificación de Seguridad y Contrato
**Como** usuario,
**Quiero** clasificar el nivel de seguridad y el componente del contrato,
**Para** categorizar correctamente el punto.

**Criterios de Aceptación:**
*   Nivel de Seguridad: Selección única (ALTO, MEDIO, BAJO).
*   Componentes del Contrato: Selección única (VALLE SEGURO, LPR, COTEJO FACIAL).

### HU-15: Datos Técnicos Site Survey
**Como** usuario,
**Quiero** registrar los datos técnicos de conectividad e infraestructura,
**Para** detallar la viabilidad técnica.

**Criterios de Aceptación:**
*   Confirmación Línea de Vista (Check/Radio).
*   Medio de transmisión: Selección (Fibra óptica, N/A).
*   Tipo de Cableado: Selección única (Aéreo, Subterráneo, Mixto).
*   Infraestructura Adicional: Campo numérico para "Cajas a Instalar".
*   Inventario Hardware: Campos numéricos para Cámaras multisensor, PTZ y fijas.

### HU-16: Diagrama del Sitio (Integración Mapas)
**Como** usuario,
**Quiero** obtener una imagen satelital automática y poder subir una versión editada,
**Para** diagramar la instalación sobre el mapa real.

**Criterios de Aceptación:**
*   **Estado No Editada:** El sistema intenta obtener captura de Google Maps/proveedor usando Lat/Long.
*   Botón para descargar/compartir la imagen base.
*   Campo para subir "Imagen Editada" (diagramada).
*   Validación: No permite enviar a revisión si no se ha cargado la imagen editada.
*   Mensaje de ayuda: "Para completar descargue y suba la imagen editada con las señales de instalación".

### HU-17: Evidencia Fotográfica
**Como** usuario,
**Quiero** subir fotos de la visual de la cámara y la acometida,
**Para** documentar el estado físico.

**Criterios de Aceptación:**
*   Campo "Visual general de la cámara": Carga de imagen (cámara o galería).
*   Campo "Visual general de la acometida": Carga de imagen.
*   Soporte para compresión de imágenes en el cliente para optimizar sincronización.

### HU-18: Metrajes y Adecuaciones (Poste y Fachada)
**Como** usuario,
**Quiero** ingresar los metrajes de cableado por tipo de superficie y detalles de tubería,
**Para** cuantificar la obra civil necesaria.

**Criterios de Aceptación:**
*   **Sección Poste:**
    *   Listado superficies (Aérea, Prado, Asfalto, etc.): Campos numéricos (metros).
    *   Validación: Al menos un campo debe tener valor mayor a 0.
*   **Sección Fachada:**
    *   Descripción breve (Texto).
*   **Detalle Infraestructura (Bloques A y B):**
    *   Acometida: Tubería, Altura, Otro (Numéricos + Texto descriptivo).
    *   Punto de Cámara: Tubería, Altura, Otro, Material (Selección: Concreto, etc.), Otra (Texto).

### HU-19: Cierre y Firmas
**Como** usuario,
**Quiero** ingresar los datos finales de cierre,
**Para** completar el formulario.

**Criterios de Aceptación:**
*   Campo: "Este punto de Cámara pertenece a".
*   Campo: Observaciones finales.
*   **Nota para PDF:** Incluir espacios para firmas de "Director de Proyectos Union Temporal" y "Director de interventoria" (no son campos llenables en la app, son espacios en el diseño del PDF).
