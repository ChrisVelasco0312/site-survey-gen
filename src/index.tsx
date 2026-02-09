import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Home } from './pages/Home';
import { Login } from './pages/auth';
import { NotFound } from './pages/_404';
import { AuthProvider } from './features/auth/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import { Header } from './components/Header';
import './style.css';

export function App() {
	return (
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
	);
}

render(<App />, document.getElementById('app'));
