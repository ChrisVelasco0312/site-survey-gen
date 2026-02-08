import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';

import { Header } from './components/Header.jsx';
import { Home } from './pages/Home/index.jsx';
import { Login } from './pages/auth/index.jsx';
import { NotFound } from './pages/_404.jsx';
import { AuthProvider } from './features/auth/AuthContext.jsx';
import { PrivateRoute } from './components/PrivateRoute.jsx';
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
