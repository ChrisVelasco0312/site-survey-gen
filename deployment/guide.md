# Guía de Despliegue de Documentación

Esta documentación está construida con **Docsify**, un generador de sitios estáticos que transforma archivos Markdown en un sitio web navegable al vuelo.

## 1. Configuración Inicial en GitHub

Para que la documentación sea accesible públicamente (o dentro de su organización) a través de GitHub Pages, debe habilitar la característica en la configuración del repositorio.

### Paso 1: Habilitar GitHub Pages

1.  Vaya a la pestaña **Settings** de su repositorio en GitHub.
2.  En el menú lateral izquierdo, seleccione **Pages**.
3.  En la sección **Build and deployment**, bajo **Source**, seleccione **Deploy from a branch**.
4.  En **Branch**, seleccione `gh-pages` y la carpeta `/ (root)`.
    *   **Nota:** La rama `gh-pages` se creará automáticamente la primera vez que se ejecute el flujo de trabajo de GitHub Actions. Si no aparece aún, espere a que el Action se complete tras su primer push.

## 2. Flujo de Trabajo Automático (GitHub Actions)

El archivo `.github/workflows/docs.yml` se encarga de publicar automáticamente cualquier cambio realizado en la carpeta `docs/`.

**Cómo funciona:**
1.  Cada vez que hace un `push` a la rama `main` (o `master`), se dispara el flujo de trabajo.
2.  El flujo toma el contenido de la carpeta `docs/`.
3.  Lo publica en la rama `gh-pages`.
4.  GitHub Pages sirve el contenido de esa rama como un sitio web.

## 3. Verificar el Despliegue

Una vez completado el flujo de trabajo (puede ver el estado en la pestaña **Actions**), su documentación estará disponible en:

`https://<usuario-o-org>.github.io/<nombre-del-repo>/`

## 4. Desarrollo Local

Si desea previsualizar la documentación en su máquina local antes de subir cambios:

1.  Asegúrese de tener `docsify-cli` instalado (opcional pero recomendado):
    ```bash
    npm i docsify-cli -g
    ```
2.  Ejecute el servidor local desde la raíz del proyecto:
    ```bash
    docsify serve docs
    ```
3.  Abra `http://localhost:3000` en su navegador.
