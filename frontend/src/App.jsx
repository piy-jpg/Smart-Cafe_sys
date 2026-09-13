import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import WaiterDashboardNew from './pages/WaiterDashboardNew';
import KitchenDashboard from './pages/KitchenDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import PublicOrderPage from './pages/PublicOrderPage';
import { Typography, Button, IconButton, TextField, Alert, Tooltip } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/Logout';
import { API_BASE_URL } from './lib/appConfig';
import { canAccessRoute, clearSession, getAllowedRoutesForRole, getDefaultRouteForRole, getStoredUser, storeSession } from './lib/session';

const NavbarLinks = ({ navItems, onNavigate }) => (
  <>
    {navItems.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) =>
          `whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            isActive
              ? 'bg-slate-800 text-white shadow-sm'
              : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
          }`
        }
        onClick={onNavigate}
      >
        {item.label}
      </NavLink>
    ))}
  </>
);

const Navbar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = getStoredUser();
  const role = user?.role || '';
  const allowedRoutes = useMemo(() => getAllowedRoutesForRole(role), [role]);
  const hasMultipleDashboards = allowedRoutes.length > 1;
  
  if (location.pathname === '/' || location.pathname === '/order') return null;
  if (!role || !allowedRoutes.length) return null;
  if (!hasMultipleDashboards && (location.pathname === '/waiter' || location.pathname === '/kitchen')) return null;

  const navItems = [
    { path: '/waiter', label: 'Waiter' },
    { path: '/kitchen', label: 'Chef' },
    { path: '/manager', label: 'Manager' },
    { path: '/owner', label: 'Owner' }
  ].filter((item) => allowedRoutes.includes(item.path));

  const roleLabel = role === 'chef'
    ? 'Chef'
    : role === 'manager'
      ? 'Manager'
      : role === 'owner'
        ? 'Owner'
        : 'Waiter';

  const roleInitial = roleLabel.charAt(0);

  const handleLogout = () => {
    setMobileOpen(false);
    clearSession();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-[80] border-b border-slate-200/60 bg-white/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 text-xs font-black text-white shadow-md">
            SC
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">SmartCafe</span>
        </div>
        
        {/* Desktop Nav Pills */}
        {hasMultipleDashboards ? (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="flex items-center gap-1 rounded-full border border-slate-100 bg-slate-50/60 p-1">
              <NavbarLinks navItems={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : (
          <div className="hidden flex-1 items-center justify-center lg:flex">
            <div className="rounded-full border border-slate-100 bg-slate-50/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
              {roleLabel}
            </div>
          </div>
        )}

        {/* Right: User Info + Logout + Mobile Toggle */}
        <div className="flex items-center gap-2.5">
          {/* User avatar + role label */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-xs font-bold text-white shadow-sm">
              {roleInitial}
            </div>
            <span className="hidden text-sm font-semibold text-slate-600 lg:block">{roleLabel}</span>
          </div>

          {/* Desktop Logout Icon */}
          <Tooltip title="Logout" arrow>
            <IconButton
              size="small"
              className="hidden text-slate-400 hover:bg-red-50 hover:text-red-500 lg:flex"
              onClick={handleLogout}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          
          {/* Mobile Menu Toggle */}
          {hasMultipleDashboards ? (
            <IconButton
              size="small"
              className="shrink-0 text-slate-500 lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          ) : (
            /* Mobile Logout for single-dashboard roles */
            <Tooltip title="Logout" arrow>
              <IconButton
                size="small"
                className="text-slate-400 hover:bg-red-50 hover:text-red-500 lg:hidden"
                onClick={handleLogout}
              >
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`overflow-hidden border-t border-slate-100 bg-white/95 backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden ${hasMultipleDashboards && mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 border-t-0 opacity-0'}`}>
        <div className="flex flex-col gap-1.5 px-4 py-4">
          {/* Mobile user header */}
          <div className="mb-2 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-sky-400 text-sm font-bold text-white shadow-sm">
              {roleInitial}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">{user?.name || roleLabel}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>
          </div>

          {/* Mobile nav links */}
          <NavbarLinks navItems={navItems} onNavigate={() => setMobileOpen(false)} />
          
          {/* Mobile Logout */}
          <button
            className="mt-3 flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
            onClick={handleLogout}
          >
            <LogoutIcon fontSize="small" />
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

const ProtectedRoute = ({ path, children }) => {
  const user = getStoredUser();

  if (!user?.role) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessRoute(user.role, path)) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  return children;
};

const HomeRoute = () => {
  const navigate = useNavigate();
  const user = getStoredUser();
  const [email, setEmail] = useState('demo@waiter.com');
  const [password, setPassword] = useState('demo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (user?.role) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  const handleLogin = async (nextEmail = email, nextPassword = password) => {
    try {
      setSubmitting(true);
      setError('');
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: nextEmail,
        password: nextPassword
      });

      if (!response.data?.success || !response.data?.user) {
        throw new Error('Login failed');
      }

      storeSession({
        token: response.data.token,
        user: response.data.user
      });
      navigate(getDefaultRouteForRole(response.data.user.role), { replace: true });
    } catch (loginError) {
      setError(loginError.response?.data?.message || 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  };

  const demoAccounts = [
    { label: 'Waiter', email: 'demo@waiter.com', password: 'demo' },
    { label: 'Chef', email: 'demo@chef.com', password: 'demo' },
    { label: 'Manager', email: 'demo@manager.com', password: 'demo' },
    { label: 'Owner', email: 'demo@owner.com', password: 'demo' }
  ];

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.2fr_0.9fr]">
        <div className="dashboard-hero">
          <div className="dashboard-kicker">SmartCafe Live System</div>
          <Typography variant="h2" className="dashboard-title mt-4">
            Frontend is ready.
          </Typography>
          <Typography className="dashboard-subtitle">
            Sign in with one of the built-in demo roles to open the complete waiter, kitchen, manager, or owner workflow without touching local storage.
          </Typography>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {demoAccounts.map((account) => (
              <button
                key={account.email}
                type="button"
                className="rounded-[24px] border border-white/60 bg-white/85 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => {
                  setEmail(account.email);
                  setPassword(account.password);
                  handleLogin(account.email, account.password);
                }}
                disabled={submitting}
              >
                <div className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">{account.label}</div>
                <div className="mt-2 text-lg font-bold text-slate-900">{account.email}</div>
                <div className="mt-1 text-sm text-slate-500">Password: demo</div>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-[24px] border border-sky-100 bg-sky-50/90 p-4 text-sm text-sky-900">
            Public QR ordering is also live at `/order?table=1&res=smartcafe_main`.
          </div>
        </div>

        <div className="dashboard-panel p-6 md:p-8">
          <Typography variant="h4" className="font-black text-slate-900">
            Sign In
          </Typography>
          <Typography className="mt-2 text-sm text-slate-500">
            Use a demo account or enter any real account that exists in the backend.
          </Typography>

          <form
            className="mt-6 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              handleLogin();
            }}
          >
            <TextField
              fullWidth
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <TextField
              fullWidth
              type="password"
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error ? <Alert severity="error">{error}</Alert> : null}
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={submitting}
              className="rounded-2xl bg-slate-900 py-3 font-bold"
            >
              {submitting ? 'Signing in...' : 'Open Dashboard'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

function App() {
  return (
    <Router>
      <div className="app-surface flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1 flex flex-col relative">
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/waiter" element={<ProtectedRoute path="/waiter"><WaiterDashboardNew /></ProtectedRoute>} />
            <Route path="/kitchen" element={<ProtectedRoute path="/kitchen"><KitchenDashboard /></ProtectedRoute>} />
            <Route path="/manager" element={<ProtectedRoute path="/manager"><ManagerDashboard /></ProtectedRoute>} />
            <Route path="/owner" element={<ProtectedRoute path="/owner"><OwnerDashboard /></ProtectedRoute>} />
            <Route path="/order" element={<PublicOrderPage />} />
            <Route path="*" element={<HomeRoute />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
