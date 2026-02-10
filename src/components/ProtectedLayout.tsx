import { useEffect } from 'preact/hooks';
import { useLocation } from 'preact-iso';
import { Center, Loader } from '@mantine/core';
import { useAuth } from '../features/auth/AuthContext';
import { SideMenu } from './SideMenu';
import type { ComponentType } from 'preact';

/**
 * Envuelve una página con verificación de auth y SideMenu.
 * Se usa con un solo Router en la raíz para evitar que el Router anidado
 * reciba rest='' y no coincida con rutas como /mis-reportes.
 */
export function withProtectedLayout<P extends object>(Component: ComponentType<P>) {
  return function ProtectedLayoutWrapper(props: P) {
    const { user, loading } = useAuth();
    const location = useLocation();

    useEffect(() => {
      if (!loading && !user) {
        location.route('/login');
      }
    }, [user, loading, location]);

    if (loading) {
      return (
        <Center h="100vh">
          <Loader />
        </Center>
      );
    }

    if (!user) {
      return null;
    }

    return (
      <SideMenu>
        <Component {...props} />
      </SideMenu>
    );
  };
}
