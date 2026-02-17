# Site Survey Generator

<div align="center">
  <h3>Sistema de Gestión de Levantamientos Técnicos</h3>
  <p>
    Una solución integral para la generación de reportes de campo y documentación técnica.
  </p>
</div>

---

## Descripción del Proyecto

**Site Survey Generator** es un sistema profesional diseñado para optimizar el flujo de trabajo de los técnicos en campo. Permite realizar levantamientos de información detallada, capturar evidencia fotográfica, gestionar inventarios y generar reportes PDF estandarizados a través de una interfaz intuitiva y fácil de usar, optimizada tanto para dispositivos móviles como de escritorio.

El sistema garantiza la integridad de los datos mediante sincronización en tiempo real con la nube y capacidades de funcionamiento offline temporal, asegurando que la información crítica del sitio no se pierda.

## Documentación

Para navegar por la documentación completa del proyecto, consulte las siguientes secciones:

- 📖 **[Manual de Usuario](./docs/user_manual.md):** Guía paso a paso para técnicos y administradores sobre cómo utilizar el sistema de principio a fin.
- 🏗️ **[Arquitectura Técnica](./docs/architecture.md):** Detalles sobre el stack tecnológico (Preact, Vite, Firebase), estructura del código y decisiones de diseño.
- 🔄 **[Flujos y Estados](./docs/workflow.md):** Diagramas explicativos sobre el ciclo de vida de los reportes, roles de usuario y lógica de negocio.

## Características Principales

- **Formularios Dinámicos:** Interfaz paso a paso dividida en 7 secciones lógicas.
- **Modo Offline/Online:** Sincronización inteligente con Firestore e IndexedDB.
- **Generación de PDF:** Motor de renderizado de reportes PDF de alta calidad en el cliente.
- **Gestión de Roles:** Perfiles diferenciados para Técnicos de Campo y Administradores.
- **Georreferenciación:** Integración con mapas y coordenadas GPS.
- **Evidencia Multimedia:** Carga optimizada y compresión de imágenes.

## Instalación y Desarrollo

### Requisitos Previos

- Node.js (v18 o superior)
- npm o yarn

### Pasos

1.  Clonar el repositorio:
    ```bash
    git clone <url-del-repo>
    cd site-survey-gen
    ```

2.  Instalar dependencias:
    ```bash
    npm install
    ```

3.  Iniciar el servidor de desarrollo:
    ```bash
    npm run dev
    ```

4.  Para construir para producción:
    ```bash
    npm run build
    ```

## Licencia

Este proyecto es propiedad privada y su uso está restringido a personal autorizado.
