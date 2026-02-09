import { useAuth } from '../../features/auth/AuthContext';

export function Home() {
  const { user } = useAuth();

  return (
    <div className="home">
      <h1>Welcome to Site Survey Gen</h1>
      <p>Hello, {user?.email}!</p>
      <p>This is a protected area. You are successfully logged in.</p>
    </div>
  );
}
