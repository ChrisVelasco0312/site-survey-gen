import { useState } from 'preact/hooks';
import { useAuth } from './AuthContext';
import { useLocation } from 'preact-iso';
import { JSX } from 'preact';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const location = useLocation();

  async function handleSubmit(e: JSX.TargetedEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      setError('');
      await login(email, password);
      location.route('/'); // Redirect to home on successful login
    } catch (err: any) {
      setError('Failed to log in: ' + err.message);
    }
  }

  return (
    <div className="auth-container">
      <h2>Bienvenido a Site Survey</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onInput={(e) => setEmail(e.currentTarget.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onInput={(e) => setPassword(e.currentTarget.value)}
            required
          />
        </div>
        <button type="submit" disabled={!email || !password}>Iniciar sesión</button>
      </form>
    </div>
  );
}
