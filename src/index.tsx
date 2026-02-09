import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';

import { Home } from './pages/Home';
import { Login } from './pages/auth';
import { NotFound } from './pages/_404';
import { MisSitios } from './pages/MisSitios';
import { EnRevision } from './pages/EnRevision';
import { Generados } from './pages/Generados';
import { AuthProvider } from './features/auth/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { SideMenu } from './components/SideMenu';
import './style.css';

function ProtectedLayout() {
	return (
		<SideMenu>
			<Router>
				<Route path="/" component={Home} />
				<Route path="/mis-sitios" component={MisSitios} />
				<Route path="/en-revision" component={EnRevision} />
				<Route path="/generados" component={Generados} />
				<Route default component={Home} />
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
						<PrivateRoute path="/" component={ProtectedLayout} />
						<PrivateRoute path="/mis-sitios" component={ProtectedLayout} />
						<PrivateRoute path="/en-revision" component={ProtectedLayout} />
						<PrivateRoute path="/generados" component={ProtectedLayout} />
						<Route default component={NotFound} />
					</Router>
				</AuthProvider>
			</LocationProvider>
		</MantineProvider>
	);
}

render(<App />, document.getElementById('app'));
