# Módulo de Edición de Imagen

El editor de imágenes permite anotar y dibujar sobre las fotografías de evidencia (Visual de cámara y Acometida) directamente desde el formulario de reporte.

## Ubicación en la Aplicación

Se accede desde el **Paso 4: Evidencia Fotográfica** del formulario de reporte. Una vez cargada una imagen, aparece el botón **"Editar"** que abre el editor en un modal.

## Flujo de Uso

1. El usuario sube una fotografía en el paso de evidencia.
2. La imagen se comprime automáticamente (máx. 500 KB, 1920px).
3. Al presionar **"Editar"**, se abre el editor en un modal a pantalla completa.
4. El usuario dibuja anotaciones sobre la imagen usando las herramientas disponibles.
5. Al presionar **"Guardar Edición"**, la imagen editada reemplaza la vista actual y las formas se persisten para edición futura.
6. La imagen original se conserva internamente, permitiendo re-editar sin pérdida de calidad.

## Herramientas Disponibles

| Herramienta | Icono | Descripción |
|---|---|---|
| **Seleccionar** | Cursor | Permite seleccionar, mover, redimensionar y rotar formas existentes |
| **Lápiz** | Lápiz | Dibujo libre a mano alzada |
| **Línea** | Línea | Traza líneas rectas entre dos puntos |
| **Cuadrado (Borde)** | Cuadrado | Dibuja un rectángulo con solo borde |
| **Cuadrado (Relleno)** | Cuadrado relleno | Dibuja un rectángulo con relleno |
| **Círculo (Borde)** | Círculo | Dibuja un círculo con solo borde |
| **Círculo (Relleno)** | Círculo relleno | Dibuja un círculo con relleno |
| **Borrador** | Borrador | Elimina formas al hacer clic sobre ellas |

## Controles Adicionales

- **Deshacer / Rehacer:** Soporte completo con `Ctrl+Z` y `Ctrl+Shift+Z`.
- **Eliminar:** Seleccionar una forma y presionar `Supr` o el botón de eliminar.
- **Color:** Paleta de 7 colores predefinidos (Negro, Azul, Rojo, Verde, Marrón, Gris, Blanco).
- **Grosor:** Slider de 1 a 10 px para ajustar el grosor del trazo.

## Interacción con Formas

### Selección
- Clic sobre una forma para seleccionarla.
- `Shift + Clic` para seleccionar múltiples formas.
- Las formas seleccionadas muestran un borde punteado azul con controles de redimensión en las esquinas.

### Mover
- Arrastrar una forma seleccionada para moverla.
- Soporta arrastre de múltiples formas seleccionadas simultáneamente.

### Redimensionar
- Arrastrar los controles de las esquinas para cambiar el tamaño.
- Para líneas: los controles están en los extremos.

### Rotar
- Doble clic sobre una forma seleccionada para alternar al modo de rotación.
- En modo rotación, los controles de esquina rotan la forma en lugar de redimensionar.
- El borde cambia de azul punteado a naranja sólido para indicar el modo de rotación.

## Soporte Táctil

El editor soporta dispositivos táctiles:
- Toque equivale a clic.
- Arrastrar con el dedo para dibujar o mover.
- Doble toque para alternar modo de rotación.

## Persistencia

- **Imagen original:** Se almacena en `{field}_original_url` para permitir re-edición.
- **Imagen editada:** Se almacena en `{field}_url` como PNG en base64.
- **Formas:** Se persisten en `{field}_shapes` como array de objetos `Shape`, permitiendo reabrir el editor y continuar editando.

## Arquitectura Técnica

- **Componente principal:** `src/components/ImageEditor/ImageEditor.tsx`
- **Tipos:** `src/types/Shape.ts` (LineShape, RectShape, CircleShape, PencilShape)
- **Uso:** `src/pages/ReportEdit/ReportEditStep4.tsx`
- **Renderizado:** Canvas HTML5 con dos capas (dibujo permanente + trazo temporal).
- **Compresión:** `browser-image-compression` (500 KB, 1920px máx.).
