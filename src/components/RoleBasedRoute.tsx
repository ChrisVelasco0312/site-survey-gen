import { useAuth } from '../features/auth/AuthContext';
import { useLocation } from 'preact-iso';
import { useEffect } from 'preact/hooks';
import { ComponentType, h } from 'preact';
import { UserRole } from '../types/User';

interface RoleBasedRouteProps {
  component: ComponentType<any>;
  allowedRoles: UserRole[];
  [key: string]: any;
}

export function RoleBasedRoute({ component: Component, allowedRoles, ...rest }: RoleBasedRouteProps) {
  const { userData, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!loading && userData) {
      if (!allowedRoles.includes(userData.role)) {
        // Redirect unauthorized users
        // If worker tries to access admin, send to home (which redirects to mis-reportes)
        // If admin tries to access worker, send to home (which shows dashboard)
        location.route('/');
      }
    }
  }, [userData, loading, allowedRoles, location]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // If no user data yet (but AuthContext.user exists), wait or show unauthorized?
  // AuthContext should load userData if user is logged in.
  
  return (userData && allowedRoles.includes(userData.role)) ? (
    <Component {...rest} />
  ) : null;
}
