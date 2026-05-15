import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Bell, Package, Calendar, Settings as SettingsIcon, BarChart3, LogOut, Moon, Sun } from 'lucide-react';
import { motion } from 'motion/react';
import { useFirebaseConnection } from '../hooks/useFirebaseConnection';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { BrandLogo } from './BrandLogo';

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const isFirebaseConnected = useFirebaseConnection();
  const { user, displayName, photoURL, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = [
    { path: '/',          label: 'Dashboard', icon: LayoutDashboard },
    { path: '/items',     label: 'Items',     icon: Package          },
    { path: '/timetable', label: 'Timetable', icon: Calendar         },
    { path: '/sensors',   label: 'Sensors',   icon: BarChart3        },
    { path: '/alerts',    label: 'Alerts',    icon: Bell             },
    { path: '/settings',  label: 'Settings',  icon: SettingsIcon     },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── Top Header Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <Link to="/" aria-label="SyncPack dashboard">
          <BrandLogo className="h-10 w-40 border border-gray-100 shadow-sm sm:w-48" />
        </Link>

        {/* Right side — online dot + user + logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            <div className={`size-2 rounded-full ${isFirebaseConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-500">
              {isFirebaseConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
          {user && (
            <div className="flex items-center gap-2">
              {photoURL ? (
                <img src={photoURL} alt={displayName} className="size-7 rounded-full object-cover border border-gray-200 hidden sm:block" />
              ) : null}
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-gray-700 leading-tight">{displayName || 'User'}</span>
                <span className="text-[10px] text-gray-400 leading-tight">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sign out"
              >
                <LogOut className="size-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="pt-16 pb-24 p-6 flex-1">
        <div className="max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Navigation Bar ── */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-1 py-1 sm:px-4 sm:py-2 flex items-center justify-around shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="flex-1 max-w-[80px] flex flex-col items-center justify-center py-2 transition-colors"
            >
              <motion.div
                whileTap={{ scale: 0.9 }}
                className={`flex flex-col items-center gap-1 ${isActive ? 'text-blue-600' : 'text-gray-500 hover:text-gray-900'}`}
              >
                <div className={`p-1 rounded-full ${isActive ? 'bg-blue-50' : ''}`}>
                  <Icon className="size-6" />
                </div>
                <span className={`text-[10px] font-medium leading-none ${isActive ? 'font-bold' : ''}`}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

    </div>
  );
}
