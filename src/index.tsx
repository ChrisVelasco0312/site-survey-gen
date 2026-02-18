import { render } from 'preact';
import { LocationProvider, Router, Route } from 'preact-iso';
import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

import { Home } from './pages/Home';
import { Login } from './pages/auth';
import { NotFound } from './pages/_404';
import { MisReportes } from './pages/MisReportes';
import { ReportEdit } from './pages/ReportEdit';
import { ReportNew } from './pages/ReportNew';
import { ReportesFinales } from './pages/ReportesFinales';
import { SitesAdmin } from './pages/SitesAdmin';
import { AuthProvider } from './features/auth/AuthContext';
import { withProtectedLayout } from './components/ProtectedLayout';
import './style.css';

// Un solo Router evita que el Router anidado reciba rest='' y no coincida /mis-reportes, etc.
export function App() {
  return (
    <MantineProvider>
      <LocationProvider>
        <AuthProvider>
          <Router>
            <Route path="/login" component={Login} />
            <Route path="/" component={withProtectedLayout(Home)} />
            <Route path="/mis-reportes" component={withProtectedLayout(MisReportes)} />
            <Route path="/crear-reporte" component={withProtectedLayout(ReportNew)} />
            <Route path="/reportes-finales" component={withProtectedLayout(ReportesFinales)} />
            <Route path="/reporte/:id" component={withProtectedLayout(ReportEdit)} />
            <Route path="/admin/sitios" component={withProtectedLayout(SitesAdmin)} />
            <Route default component={NotFound} />
          </Router>
        </AuthProvider>
      </LocationProvider>
    </MantineProvider>
  );
}

render(<App />, document.getElementById('app'));
