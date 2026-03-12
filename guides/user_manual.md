# Manual de Usuario: Site Survey Generator

Bienvenido al manual de usuario del sistema Site Survey Generator. Esta guía le explicará paso a paso cómo utilizar la aplicación para realizar levantamientos de información en campo y generar reportes técnicos profesionales.

## 1. Acceso al Sistema

Para comenzar a utilizar la aplicación:

1.  Abra la dirección web proporcionada por su administrador.
2.  Ingrese sus credenciales (correo electrónico y contraseña).
3.  Haga clic en **Iniciar Sesión**.

> **Nota:** Si es la primera vez que ingresa, asegúrese de tener una conexión a internet estable para descargar los datos iniciales.

## 2. Panel Principal (Dashboard)

Dependiendo de su rol, verá una pantalla diferente:

### Para Técnicos de Campo
Será redirigido automáticamente a **Mis Reportes**. Aquí encontrará:
-   Una lista de los reportes que ha creado o que tiene asignados.
-   El estado de cada reporte (En Campo, En Revisión, etc.).
-   Un botón para **+ Nuevo Reporte** (o seleccionar uno existente para editar).
-   Opción de **duplicar** un reporte existente como base para uno nuevo.

### Para Administradores
Verá un [Dashboard Administrativo](admin_dashboard.md) con:
-   Pestaña **Resumen:** Progreso de sitios con desglose por distrito, municipio y tipo.
-   Pestaña **En Campo:** Reportes actualmente en edición por los técnicos.
-   Pestaña **En Revisión:** Reportes pendientes de aprobación.

### Para Superadministradores
Además del dashboard, tienen acceso a:
-   [Administración de Usuarios](user_admin.md) (`/admin/usuarios`).
-   [Administración de Sitios](site_admin.md) (`/admin/sitios`).

## 3. Realizar un Levantamiento (Crear/Editar Reporte)

El formulario de levantamiento está dividido en **6 pasos** para facilitar la captura de datos en dispositivos móviles. Puede navegar entre ellos usando los botones "Siguiente" y "Anterior", o tocando el número del paso en la parte superior.

### Paso 1: Datos Generales y Ubicación
-   Seleccione el **Sitio** del catálogo.
-   Indique la fecha del levantamiento.
-   Seleccione el **Tipo de Instalación** (Fachada, Poste, Torre).
-   Defina el **Nivel de Seguridad** del sitio (Alto, Medio, Bajo).

### Paso 2: Datos Técnicos e Infraestructura

Este paso varía según el **tipo de sitio** seleccionado:

-   **LPR:** Formulario especializado con datos de sentido vial, tipo de estructura y campos específicos para lectura de placas.
-   **Cotejo Facial:** Formulario especializado con datos de reconocimiento facial.
-   **Otros tipos:** Formulario general con:
    -   **Conectividad:** Línea de vista, tipo de transmisión (Fibra Óptica/Radio), tipo de cableado.
    -   **Hardware:** Inventario de equipos existentes (Cámaras Fijas, PTZ, Multisensor, Cajas adicionales).

### Paso 3: Diagrama y Mapa
-   Visualización de la ubicación en mapa interactivo (OSM o Satélite).
-   Colocación de [marcadores de infraestructura](map_markers.md) sobre el mapa.
-   Leyenda técnica con simbología estándar.
-   Captura del mapa como imagen PNG para incluir en el reporte.
-   Ver detalles completos en [Mapa y Marcadores](map_markers.md).

### Paso 4: Evidencia Fotográfica
Suba las fotos requeridas para el reporte. El sistema comprimirá automáticamente las imágenes (máx. 500 KB).
-   **Visual de Cámara:** Foto de lo que ve la cámara.
-   **Acometida:** Foto del punto de conexión eléctrica/datos.
-   Cada foto puede editarse con el [Editor de Imágenes](image_editor.md) para agregar anotaciones.

### Paso 5: Metrajes y Obra Civil
Detalle los materiales necesarios para la instalación:
-   Metros de cableado aéreo o subterráneo.
-   Metros de canalización en tierra/asfalto.
-   Detalles de la acometida eléctrica (tipo de tubería, altura).
-   Detalles del punto de cámara (material del poste, altura).
-   Detalles de PTZ (si aplica).

### Paso 6: Cierre y Guardado
-   Ingrese el nombre del responsable del sitio (propietario/contacto).
-   Añada **Observaciones Finales**.
-   Guardar el reporte.

## 4. Guardado y Sincronización

El sistema cuenta con dos mecanismos de guardado:
1.  **Guardado Local (Automático):** Mientras edita, sus cambios se guardan en su dispositivo cada segundo. Esto evita la pérdida de datos si se cierra la pestaña accidentalmente.
2.  **Guardado en la Nube (Sincronización):** Los datos se envían al servidor cada 5 segundos (si hay cambios) o al pulsar el botón de **Guardar** (ícono de disquete).

> **Importante:** Antes de cerrar la aplicación, asegúrese de ver el mensaje "Guardado correctamente" en color verde.

## 5. Vista Previa y Validación

### Vista Previa del PDF
En cualquier momento durante la edición, puede acceder a una **Vista Previa** del reporte final pulsando el botón con el ícono de "ojo" (👁️) en la barra lateral o menú superior.

*   Esta vista genera un PDF en tiempo real con los datos ingresados hasta el momento.
*   Puede descargar este archivo para revisión personal.
*   **Importante:** Este documento es un **BORRADOR**. No tiene validez oficial hasta que el reporte haya sido aprobado y generado por un administrador.

### Validación de Campos
El sistema permite guardar el progreso con campos incompletos para facilitar el trabajo en campo. Sin embargo, para que un reporte sea considerado completo y válido, debe diligenciar campos críticos, incluyendo:

*   **Paso 1:** Fecha y Selección del Sitio.
*   **Paso 3:** Imagen del **Diagrama/Mapa guardado**. (Requisito obligatorio para enviar a revisión).
*   **Paso 5:** Metrajes de instalación (al menos un valor mayor a 0 si aplica).

## 6. Finalizar y Enviar

Una vez completada toda la información:
1.  Vaya al último paso o pulse el botón de opciones en la parte superior.
2.  Seleccione **Enviar a Revisión**.
3.  Confirme la acción. El reporte cambiará de estado y ya no podrá editarlo a menos que un administrador se lo devuelva.

## 7. Generación de PDF (Solo Administradores)

Como administrador, cuando un reporte está en estado "Listo para generar":
1.  Abra el reporte en modo lectura.
2.  Revise que toda la información esté correcta.
3.  Haga clic en **Generar PDF Final**.
4.  El sistema procesará las imágenes y datos, creando un documento PDF descargable.
5.  El reporte pasará a estado "Generado" y estará disponible en la sección de **Reportes Finales**.
