import { useAuth } from '../../features/auth/AuthContext';
import { useLocation } from 'preact-iso';
import { useEffect } from 'preact/hooks';
import { Loader, Center } from '@mantine/core';
import { AdminDashboard } from './AdminDashboard';

export function Home() {
  const { userData, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && userData) {
      if (userData.role === 'field_worker') {
        location.route('/mis-reportes');
      }
    }
  }, [userData, loading, location]);

  if (loading || !userData) {
    return (
      <Center h="100vh">
        <Loader size="xl" />
      </Center>
    );
  }

  // If role is admin, show dashboard
  if (userData.role === 'admin') {
    return <AdminDashboard />;
  }

  // Fallback (should have redirected)
  return null;
}
