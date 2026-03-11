# Mapa y Marcadores (Paso 3: Diagrama)

El paso de diagrama permite al usuario visualizar la ubicación del sitio en un mapa interactivo, colocar marcadores para representar la infraestructura y generar una imagen del diagrama para el reporte.

## Ubicación en la Aplicación

Se accede desde el **Paso 3** del formulario de edición de reporte (`/reporte/:id`).

## Flujo General

1. Al abrir el paso, se carga el mapa centrado en las coordenadas del sitio seleccionado en el Paso 1.
2. El usuario selecciona el tipo de mapa (OSM o Satélite) y ajusta el zoom.
3. Se colocan marcadores sobre el mapa para representar la infraestructura del sitio.
4. Se ajusta la leyenda y la escala.
5. Se presiona **"Guardar Mapa"** para capturar el mapa como imagen PNG del reporte.

## Tipos de Mapa

| Tipo | Fuente | Descripción |
|---|---|---|
| **OSM** | OpenStreetMap | Mapa callejero estándar |
| **Satélite** | Esri World Imagery | Vista satelital |

El zoom va de **15 a 21**, con soporte de "overzoom" (zoom digital más allá del zoom nativo de los tiles).

## Marcador Principal

Cada reporte tiene un marcador principal que se posiciona automáticamente en las coordenadas del sitio. Sus propiedades son:

- **Etiqueta:** Texto que aparece junto al marcador.
- **Icono:** Tipo de estructura (ver tabla de iconos).
- **Color:** Color del marcador.
- **Mostrar etiqueta:** Toggle para mostrar/ocultar el texto.

## Flujo para Agregar Marcadores Adicionales

1. Presionar el botón **"Agregar Pin"** en la sección de marcadores adicionales.
2. Se crea un nuevo marcador con coordenadas iniciales iguales a las del sitio.
3. Para posicionar el marcador:
   - Presionar el botón **"Mover"** junto al marcador.
   - Se activa el modo de posicionamiento: aparece una alerta indicando *"Haga clic en el mapa para posicionar el marcador"*.
   - Hacer clic sobre el mapa en la ubicación deseada.
   - El marcador se mueve a esa posición y el modo de posicionamiento se desactiva.
4. Opcionalmente, editar las coordenadas manualmente en formato GMS (Grados, Minutos, Segundos).
5. Configurar las propiedades del marcador (etiqueta, icono, color).
6. Repetir para cada marcador adicional necesario.

## Tipos de Iconos (Marcadores)

| Icono | Identificador | Uso |
|---|---|---|
| **Pin** | `Pin` | Marcador genérico |
| **Estructura T** | `T` | Estructura LPR tipo T |
| **Estructura L** | `L` | Estructura LPR tipo L |
| **Estructura C** | `C` | Estructura LPR tipo C |
| **Caja 60x60** | `box60` | Caja de registro 60×60 cm |
| **Caja 40x40** | `box40` | Caja de registro 40×40 cm |
| **Círculo** | `circle` | Punto genérico (poste, cámara) |

## Leyenda del Mapa

La leyenda se dibuja automáticamente sobre el mapa y contiene la simbología estándar:

| Símbolo | Descripción |
|---|---|
| Círculo azul con barra | Poste de Cámara |
| Línea azul | Línea Aérea |
| Círculo blanco con borde gris | Poste de Apoyo |
| Círculo rojo con barra | Poste de Energía |
| Línea roja | Línea Subterránea |
| Cuadrado verde | Caja 60 × 60 |
| Cuadrado marrón | Caja 40 × 40 |
| T gris + [LPR] | Estructura LPR Tipo T |
| L gris + [LPR] | Estructura LPR Tipo L |
| C gris + bracket | Estructura LPR Tipo C |

### Ajuste de Leyenda
- Presionar **"Ajustar Leyenda"** para entrar en modo de ajuste.
- Arrastrar la leyenda para reposicionarla en el mapa.
- Usar el slider de escala (0.5× – 1.5×) para cambiar su tamaño.
- La posición y escala se guardan en el reporte.

## Controles del Mapa

| Control | Función |
|---|---|
| **Tipo de mapa** | Alternar entre OSM y Satélite |
| **Zoom** | Slider de zoom (15–21) |
| **Tamaño de Pins** | Ajustar el tamaño visual de los marcadores |
| **Ajustar Leyenda** | Activar modo de arrastre/escala de la leyenda |
| **Guardar Mapa** | Capturar el mapa actual como PNG y guardarlo en el reporte |
| **Ver en Google Maps** | Abrir las coordenadas del sitio en Google Maps (nueva pestaña) |

## Modo Offline

Cuando no hay conexión a internet, el mapa muestra un placeholder con un ícono de WiFi desconectado y un mensaje indicando que se requiere conexión para cargar los tiles del mapa.

## Arquitectura Técnica

- **Componente principal:** `src/pages/ReportEdit/ReportEditStep3.tsx`
- **Leyenda:** `src/utils/mapLegend.ts`
- **Tipos:** `MapPinData` en `src/types/Report.ts`
- **Conectividad:** `src/hooks/useConnectivity.ts`
- **Canvas:** 1732 × 974 px de resolución interna.
- **Tiles:** Cálculo de lat/lon a pixel con funciones de Mercator.
