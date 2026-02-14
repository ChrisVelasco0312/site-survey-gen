import { useAuth } from '../features/auth/AuthContext';
import { useLocation } from 'preact-iso';
import { useEffect } from 'preact/hooks';
import { ComponentType } from 'preact';
import { Center, Loader } from '@mantine/core';

interface PrivateRouteProps {
  component: ComponentType<any>;
  [key: string]: any;
}

export function PrivateRoute({ component: Component, ...rest }: PrivateRouteProps) {
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

  return user ? (
    <>
      <Component {...rest} />
    </>
  ) : null;
}
