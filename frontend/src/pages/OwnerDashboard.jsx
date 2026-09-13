import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/appConfig';
import { clearSession, getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

import OwnerSidebar from '../components/owner/OwnerSidebar';
import OwnerTopNav from '../components/owner/OwnerTopNav';
import OwnerExecutiveOverview from './owner/OwnerExecutiveOverview';
import OwnerOrdersView from './owner/OwnerOrdersView';
import OwnerMenuView from './owner/OwnerMenuView';
import OwnerTablesView from './owner/OwnerTablesView';
import OwnerBackupView from './owner/OwnerBackupView';
import OwnerReportsView from './owner/OwnerReportsView';
import OwnerSettingsView from './owner/OwnerSettingsView';
import OwnerQrGeneratorView from './owner/OwnerQrGeneratorView';

const LIVE_REFRESH_MS = 5000;

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Navigation & Filter State
  const [activeSection, setActiveSection] = useState('dashboard');
  const [dateRange, setDateRange] = useState('today');
  const [qrTargetTable, setQrTargetTable] = useState(null);

  // Real Database Data State
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [users, setUsers] = useState([]);
  const [databaseStatus, setDatabaseStatus] = useState({
    engine: 'SQLite',
    file_name: 'smart_cafe.sqlite',
    size_bytes: 0,
    updated_at: null,
  });
  const [ownerControl, setOwnerControl] = useState({});

  // Loading & Connection State
  const [loading, setLoading] = useState(true);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [notice, setNotice] = useState('');

  // Fetch all primary datasets
  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

    try {
      const [ordersRes, menuRes, usersRes, dbRes, controlRes] = await Promise.allSettled([
        axios.get(`${API_BASE_URL}/api/orders`),
        axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`),
        axios.get(`${API_BASE_URL}/api/users`),
        axios.get(`${API_BASE_URL}/api/system/database/status`),
        axios.get(`${API_BASE_URL}/api/system/owner-control`),
      ]);

      if (ordersRes.status === 'fulfilled') {
        setOrders(ordersRes.value.data.orders || []);
      }
      if (menuRes.status === 'fulfilled') {
        setMenu(menuRes.value.data.menu || []);
      }
      if (usersRes.status === 'fulfilled') {
        setUsers(usersRes.value.data.users || []);
      }
      if (dbRes.status === 'fulfilled') {
        setDatabaseStatus(dbRes.value.data.database || {});
      }
      if (controlRes.status === 'fulfilled') {
        setOwnerControl(controlRes.value.data || {});
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      console.error('Failed to sync owner data:', err);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, []);

  // WebSockets & Real-time Listeners
  useEffect(() => {
    fetchData(true);

    const handleOrderEvent = (incomingOrder) => {
      if (!incomingOrder) return;
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === incomingOrder.id);
        if (!exists) return [incomingOrder, ...prev];
        return prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o));
      });
      setLastSyncedAt(new Date());
    };

    const handleMenuEvent = () => {
      axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`)
        .then((res) => {
          setMenu(res.data.menu || []);
          setLastSyncedAt(new Date());
        })
        .catch(console.error);
    };

    const handleConnect = () => {
      setSocketConnected(true);
      fetchData(false);
      setNotice('Realtime connection restored.');
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setNotice('Realtime connection lost. Reconnecting...');
    };

    socket.on('newOrder', handleOrderEvent);
    socket.on('orderStatusUpdated', handleOrderEvent);
    socket.on('orderUpdated', handleOrderEvent);
    socket.on('orderCustomerUpdated', handleOrderEvent);
    socket.on('tableCleared', handleOrderEvent);
    socket.on('menuUpdated', handleMenuEvent);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleOrderEvent);
      socket.off('orderStatusUpdated', handleOrderEvent);
      socket.off('orderUpdated', handleOrderEvent);
      socket.off('orderCustomerUpdated', handleOrderEvent);
      socket.off('tableCleared', handleOrderEvent);
      socket.off('menuUpdated', handleMenuEvent);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchData]);

  // Polling Fallback (5s) & Window Focus Sync
  useEffect(() => {
    const interval = setInterval(() => fetchData(false), LIVE_REFRESH_MS);
    const onFocus = () => fetchData(false);

    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [fetchData]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your executive session and log out?')) {
      clearSession();
      navigate('/');
    }
  };

  const handleDownloadBackup = () => {
    const link = document.createElement('a');
    link.href = `${API_BASE_URL}/api/system/database/download`;
    link.setAttribute('download', databaseStatus.file_name || 'smart_cafe.sqlite');
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="flex min-h-screen bg-[#f6f8fc]">
      
      {/* Fixed Dark Sidebar (240px) */}
      <OwnerSidebar
        activeSection={activeSection}
        onSectionChange={(sec) => setActiveSection(sec)}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Executive Top Navigation Header */}
        <OwnerTopNav
          currentUser={currentUser}
          socketConnected={socketConnected}
          lastSyncedAt={lastSyncedAt}
          dateRange={dateRange}
          onDateRangeChange={(r) => setDateRange(r)}
          onLogout={handleLogout}
        />

        {/* Global Alert / Toast Notification */}
        {notice && (
          <div className="bg-blue-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice('')}
              className="text-blue-200 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content Workspace */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {loading ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="text-sm font-bold text-slate-700">Loading SmartCafe Executive Control Center...</div>
              <p className="text-xs text-slate-400">Syncing verified database records</p>
            </div>
          ) : (
            <>
              {/* 1. Executive Dashboard (The primary 5-second business command center) */}
              {(activeSection === 'dashboard' || activeSection === 'analytics' || activeSection === 'revenue') && (
                <OwnerExecutiveOverview
                  orders={orders}
                  menu={menu}
                  users={users}
                  databaseStatus={databaseStatus}
                  dateRange={dateRange}
                  onNavigate={(sec) => setActiveSection(sec)}
                  onDownloadBackup={handleDownloadBackup}
                />
              )}

              {/* 2. Orders Manager */}
              {activeSection === 'orders' && (
                <OwnerOrdersView
                  orders={orders}
                  users={users}
                  onOrdersUpdated={() => fetchData(false)}
                />
              )}

              {/* 3. Tables & Floor Plan */}
              {activeSection === 'tables' && (
                <OwnerTablesView
                  orders={orders}
                  onNavigateOrder={() => setActiveSection('orders')}
                  onNavigateQr={(tbl) => {
                    setQrTargetTable(tbl || null);
                    setActiveSection('qr');
                  }}
                />
              )}

              {/* 3b. Table QR Code Generator & Standees */}
              {activeSection === 'qr' && (
                <OwnerQrGeneratorView initialTable={qrTargetTable} />
              )}

              {/* 4. Menu Master & Inventory */}
              {(activeSection === 'menu' || activeSection === 'inventory') && (
                <OwnerMenuView
                  menu={menu}
                  onMenuUpdated={() => fetchData(false)}
                />
              )}

              {/* 5. Staff Overview */}
              {activeSection === 'staff' && (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
                        Staff Accounts &amp; Roster
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Registered restaurant staff accounts with system access and performance metrics.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                          <th className="pb-2.5">Name</th>
                          <th className="pb-2.5">Email</th>
                          <th className="pb-2.5">Role</th>
                          <th className="pb-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {users.map((u) => (
                          <tr key={u.id} className="hover:bg-slate-50">
                            <td className="py-3 font-bold text-slate-900">{u.name}</td>
                            <td className="py-3 text-slate-500">{u.email}</td>
                            <td className="py-3 font-semibold text-slate-700 capitalize">{u.role}</td>
                            <td className="py-3 text-center">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Active
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 6. Customers */}
              {activeSection === 'customers' && (
                <OwnerExecutiveOverview
                  orders={orders}
                  menu={menu}
                  users={users}
                  databaseStatus={databaseStatus}
                  dateRange={dateRange}
                  onNavigate={(sec) => setActiveSection(sec)}
                  onDownloadBackup={handleDownloadBackup}
                />
              )}

              {/* 7. Payments Ledger */}
              {activeSection === 'payments' && (
                <OwnerExecutiveOverview
                  orders={orders}
                  menu={menu}
                  users={users}
                  databaseStatus={databaseStatus}
                  dateRange={dateRange}
                  onNavigate={(sec) => setActiveSection(sec)}
                  onDownloadBackup={handleDownloadBackup}
                />
              )}

              {/* 8. Reports Center */}
              {activeSection === 'reports' && (
                <OwnerReportsView
                  orders={orders}
                  menu={menu}
                  users={users}
                />
              )}

              {/* 9. Database Backup & Data */}
              {activeSection === 'backup' && (
                <OwnerBackupView
                  databaseStatus={databaseStatus}
                  ownerControl={ownerControl}
                  onBackupSaved={() => fetchData(false)}
                />
              )}

              {/* 10. Settings */}
              {activeSection === 'settings' && (
                <OwnerSettingsView
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              )}
            </>
          )}
        </main>

      </div>

    </div>
  );
};

export default OwnerDashboard;
