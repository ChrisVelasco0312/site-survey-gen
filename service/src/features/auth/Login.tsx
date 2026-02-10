import { useState } from 'preact/hooks';
import { useAuth } from './AuthContext';
import { useLocation } from 'preact-iso';
import { JSX } from 'preact';
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Container,
  Alert,
  Stack,
  LoadingOverlay
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const location = useLocation();

  async function handleSubmit(e: JSX.TargetedEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      setError('');
      await login(email, password);
      location.route('/'); // Redirect to home on successful login
    } catch (err: any) {
      setError('Failed to log in: ' + err.message);
    } finally {
        setLoading(false);
    }
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center">
        Bienvenido a Site Survey
      </Title>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md" pos="relative">
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: "sm", blur: 2 }} />
        {error && (
            <Alert icon={<IconAlertCircle size="1rem" />} title="Error" color="red" mb="md">
                {error}
            </Alert>
        )}
        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
                label="Email"
                placeholder="tu@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
                label="Password"
                placeholder="Tu contraseña"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
            />
            <Button fullWidth mt="xl" type="submit" disabled={!email || !password}>
                Iniciar sesión
            </Button>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
