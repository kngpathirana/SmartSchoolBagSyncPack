import { createBrowserRouter } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { SensorDetails } from './components/SensorDetails';
import { Alerts } from './components/Alerts';
import { Items } from './components/Items';
import { Timetable } from './components/Timetable';
import { Settings } from './components/Settings';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { ProtectedRoute } from './components/ProtectedRoute';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/register',
    Component: Register,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      { index: true,           Component: Dashboard    },
      { path: 'items',         Component: Items        },
      { path: 'timetable',     Component: Timetable    },
      { path: 'sensors',       Component: SensorDetails },
      { path: 'alerts',        Component: Alerts       },
      { path: 'settings',      Component: Settings     },
    ],
  },
]);
