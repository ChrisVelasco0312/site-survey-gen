# Administración de Usuarios

El módulo de administración de usuarios permite al superadministrador gestionar las cuentas de acceso al sistema.

## Acceso

- **Ruta:** `/admin/usuarios`
- **Rol requerido:** `superadmin` (exclusivo)

## Roles del Sistema

| Rol | Identificador | Permisos |
|---|---|---|
| **Superadministrador** | `superadmin` | Acceso total: gestión de usuarios, sitios, reportes, generación de PDF |
| **Administrador** | `admin` | Gestión de sitios, revisión y aprobación de reportes, generación de PDF |
| **Técnico de Campo** | `field_worker` | Crear y editar reportes propios, enviar a revisión |
| **Solo Lectura** | `read_only` | Consulta de sitios y reportes sin capacidad de modificación |

## Grupos de Trabajo

Los técnicos de campo (`field_worker`) se asignan a un grupo de trabajo:

| Grupo | Identificador |
|---|---|
| **Grupo 1** | `grupo_a` |
| **Grupo 2** | `grupo_b` |

Los grupos permiten segmentar y filtrar los reportes por equipo de trabajo en el dashboard administrativo.

## Funcionalidades

### Listado de Usuarios

La vista principal muestra una tabla con todos los usuarios registrados:

| Columna | Descripción |
|---|---|
| Nombre Completo | Nombre del usuario |
| Email | Correo electrónico (credencial de acceso) |
| Rol | Badge de color según el rol asignado |
| Grupo | Grupo de trabajo (solo para `field_worker`) |
| Estado | Activo (verde) o Inactivo (rojo) |

Los badges de rol usan colores diferenciados:
- **Rojo:** superadmin
- **Azul:** admin
- **Gris:** field_worker, read_only

### Crear Usuario

1. Presionar el botón **"Nuevo Usuario"**.
2. Completar el formulario:
   - **Nombre Completo** (requerido)
   - **Email** (requerido, será el login del usuario)
   - **Contraseña** (requerida, mínimo 6 caracteres)
   - **Rol** (seleccionar de la lista)
   - **Grupo** (solo aparece cuando el rol es `field_worker`)
3. Al crear, el sistema:
   - Crea la cuenta en **Firebase Authentication**.
   - Crea el perfil del usuario en la colección **`users`** de Firestore.

### Actualizar / Eliminar

Actualmente la actualización y eliminación de usuarios se realiza mediante scripts del servicio backend:

```bash
node service/firestore/users/deploy_user.js
```

## Arquitectura Técnica

- **Página:** `src/pages/UsersAdmin/index.tsx`
- **Servicio:** `src/services/userAdminService.ts` (`getUsers`, `createUser`)
- **Autenticación:** Firebase Authentication
- **Colección Firestore:** `users`
