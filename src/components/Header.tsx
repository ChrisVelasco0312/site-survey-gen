import { useLocation } from 'preact-iso';
import { useAuth } from '../features/auth/AuthContext';
import { JSX } from 'preact';

export function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await logout();
      location.route('/login');
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <header>
      <nav>
        <a href="/" class={location.url === '/' ? 'active' : ''}>Home</a>
      </nav>
      {user && (
        <a href="#" onClick={(e: JSX.TargetedEvent<HTMLAnchorElement>) => { e.preventDefault(); handleLogout(); }}>
          Cerrar sesión
        </a>
      )}
    </header>
  );
}
