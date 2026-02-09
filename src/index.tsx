import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { Home } from './pages/Home';
import { Login } from './pages/auth';
import { NotFound } from './pages/_404';
import { AuthProvider } from './features/auth/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Header } from './components/Header';
import './style.css';

export function App() {
	return (
		<MantineProvider>
			<LocationProvider>
				<AuthProvider>
					<Header />
					<main>
						<Router>
							<PrivateRoute path="/" component={Home} />
							<Route path="/login" component={Login} />
							<Route default component={NotFound} />
						</Router>
					</main>
				</AuthProvider>
			</LocationProvider>
		</MantineProvider>
	);
}

render(<App />, document.getElementById('app'));
