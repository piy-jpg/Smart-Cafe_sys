import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import WaiterDashboard from './pages/WaiterDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import OwnerDashboard from './pages/OwnerDashboard';
import PublicOrderPage from './pages/PublicOrderPage';
import { Typography, Button, IconButton, TextField, Alert } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { API_BASE_URL } from './lib/appConfig';
import { canAccessRoute, clearSession, getAllowedRoutesForRole, getDefaultRouteForRole, getStoredUser, storeSession } from './lib/session';

const NavbarLinks = ({ navItems, onNavigate }) => (
  <>
    {navItems.map((item) => (
      <NavLink
        key={item.path}
        to={item.path}
        className={({ isActive }) => (
          `whitespace-nowrap rounded-full px-4 py-2 font-semibold transition-all md:py-2 ${
            isActive
              ? 'bg-slate-900 text-white shadow-sm'
              : `text-slate-700 ${item.classes}`
          }`
        )}
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

  const navItems = [
    { path: '/waiter', label: 'Waiter Dashboard', classes: 'hover:bg-indigo-50 hover:text-indigo-700' },
    { path: '/kitchen', label: 'Chef Dashboard', classes: 'hover:bg-amber-50 hover:text-amber-700' },
    { path: '/manager', label: 'Manager Dashboard', classes: 'hover:bg-emerald-50 hover:text-emerald-700' },
    { path: '/owner', label: 'Owner Dashboard', classes: 'hover:bg-slate-100 hover:text-slate-900' }
  ].filter((item) => allowedRoutes.includes(item.path));

  const roleLabel = role === 'chef'
    ? 'Chef'
    : role === 'manager'
      ? 'Manager'
      : role === 'owner'
        ? 'Owner'
        : 'Waiter';

  return (
    <nav className="sticky top-0 z-[80] border-b border-slate-200/80 bg-white/92 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.34)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 md:gap-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 text-sm font-black text-white shadow-lg">
            SC
          </div>
          <div className="min-w-0">
            <Typography variant="h6" className="font-black tracking-tight text-slate-900">SmartCafe</Typography>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Operations Suite</p>
          </div>
        </div>
        
        {/* Desktop Links */}
        {hasMultipleDashboards ? (
          <div className="hidden min-w-0 flex-1 items-center justify-center lg:flex">
            <div className="flex min-w-0 max-w-full items-center gap-2 overflow-x-auto rounded-full border border-slate-200 bg-slate-50/90 p-1.5 scrollbar-thin">
            <NavbarLinks navItems={navItems} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : (
          <div className="hidden rounded-full border border-slate-200 bg-slate-50/90 px-4 py-2 text-sm font-bold uppercase tracking-[0.22em] text-slate-500 lg:flex">
            {roleLabel}
          </div>
        )}

        {/* Desktop Logout & Mobile Toggle */}
        <div className="flex items-center gap-2">
          <Button 
            variant="outlined" 
            color="inherit"
            className="hidden rounded-full border-slate-300 text-slate-700 lg:flex"
            onClick={() => {
              clearSession();
              navigate('/');
            }}
          >
            Logout
          </Button>
          
          {hasMultipleDashboards ? (
            <IconButton color="inherit" className="shrink-0 border border-slate-200 bg-white text-slate-700 lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <CloseIcon /> : <MenuIcon />}
            </IconButton>
          ) : null}
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`overflow-hidden border-t border-slate-200/70 bg-white/96 shadow-lg backdrop-blur-xl transition-all duration-300 ease-in-out lg:hidden ${hasMultipleDashboards && mobileOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="flex flex-col gap-2 px-4 py-4">
          <NavbarLinks navItems={navItems} onNavigate={() => setMobileOpen(false)} />
          <Button 
            variant="outlined" 
            color="inherit"
            fullWidth
            className="mt-4 rounded-full border-slate-300 text-slate-700"
            onClick={() => {
              setMobileOpen(false);
              clearSession();
              navigate('/');
            }}
          >
            Logout
          </Button>
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
            <Route path="/waiter" element={<ProtectedRoute path="/waiter"><WaiterDashboard /></ProtectedRoute>} />
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
