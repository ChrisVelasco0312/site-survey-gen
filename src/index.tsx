import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { Home } from './pages/Home';
import { Login } from './pages/auth';
import { NotFound } from './pages/_404';
import { MisReportes } from './pages/MisReportes';
import { AuthProvider } from './features/auth/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { SideMenu } from './components/SideMenu';
import './style.css';

function ProtectedLayout() {
	return (
		<SideMenu>
			<Router>
				<Route path="/" component={Home} />
				<Route path="/mis-reportes" component={MisReportes} />
				{/* Route for editing/viewing specific report */}
				<Route path="/reporte/:id" component={() => <div>Report Edit Page (Coming Soon)</div>} /> 
				<Route default component={NotFound} />
			</Router>
		</SideMenu>
	);
}

export function App() {
	return (
		<MantineProvider>
			<LocationProvider>
				<AuthProvider>
					<Router>
						<Route path="/login" component={Login} />
						{/* Capture all other routes and let ProtectedLayout handle them */}
						<PrivateRoute default component={ProtectedLayout} />
					</Router>
				</AuthProvider>
			</LocationProvider>
		</MantineProvider>
	);
}

render(<App />, document.getElementById('app'));
