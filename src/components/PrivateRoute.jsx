import { useAuth } from '../features/auth/AuthContext';
import { useLocation } from 'preact-iso';
import { useEffect } from 'preact/hooks';

export function PrivateRoute({ component: Component, ...rest }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      location.route('/login');
    }
  }, [user, loading, location]);

  if (loading) {
      return <div>Loading...</div>;
  }

  return user ? <Component {...rest} /> : null;
}
