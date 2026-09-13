import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../lib/appConfig';
import { clearSession, getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

// Manager Components
import ManagerSidebar from '../components/manager/ManagerSidebar';
import ManagerTopNav from '../components/manager/ManagerTopNav';
import ManagerNewOrderModal from '../components/manager/ManagerNewOrderModal';
import ManagerTableDetailModal from '../components/manager/ManagerTableDetailModal';
import ManagerBillingReviewModal from '../components/manager/ManagerBillingReviewModal';

// Manager Views
import ManagerDashboardOverview from './manager/ManagerDashboardOverview';
import ManagerOrdersView from './manager/ManagerOrdersView';
import ManagerTablesView from './manager/ManagerTablesView';
import ManagerMenuView from './manager/ManagerMenuView';
import ManagerInventoryView from './manager/ManagerInventoryView';
import ManagerStaffView from './manager/ManagerStaffView';
import ManagerCustomersView from './manager/ManagerCustomersView';
import ManagerBillingView from './manager/ManagerBillingView';
import ManagerPaymentsView from './manager/ManagerPaymentsView';
import ManagerReportsView from './manager/ManagerReportsView';
import ManagerSettingsView from './manager/ManagerSettingsView';

const LIVE_REFRESH_MS = 5000;
const FEED_LIMIT = 15;

const createFeedEntry = (message, tone = 'info') => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  message,
  tone,
  timestamp: new Date().toISOString(),
});

const isTableOccupied = (order) => (
  Boolean(order) && !['completed', 'cancelled'].includes(order.status) && !(order.status === 'waiting_bill' && order.table_cleared)
);

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Navigation & View State
  const [activeSection, setActiveSection] = useState('dashboard');
  const [ordersFilterParam, setOrdersFilterParam] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Core Data
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [staff, setStaff] = useState([]);
  const [databaseStatus, setDatabaseStatus] = useState({
    engine: 'SQLite',
    file_name: 'smart_cafe.sqlite',
    exists: true,
    size_bytes: 0,
    updated_at: null,
  });

  // Modals
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [inspectedTableNum, setInspectedTableNum] = useState(null);
  const [reviewingBillOrder, setReviewingBillOrder] = useState(null);

  // Live System State
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [notifications, setNotifications] = useState([
    createFeedEntry('Manager SaaS Command Center initialized.', 'info'),
  ]);

  const pushNotification = useCallback((message, tone = 'info') => {
    setNotifications((prev) => [createFeedEntry(message, tone), ...prev].slice(0, FEED_LIMIT));
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your manager session and log out?')) {
      clearSession();
      navigate('/');
    }
  };

  // Data Fetching
  const fetchOrders = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/orders`);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    }
  }, []);

  const fetchMenu = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`);
      setMenu(res.data.menu || []);
    } catch (err) {
      console.error('Failed to fetch menu:', err);
    }
  }, []);

  const fetchStaff = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/users`);
      setStaff(res.data.users || []);
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    }
  }, []);

  const fetchDatabaseStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/api/system/database/status`);
      setDatabaseStatus((prev) => ({ ...prev, ...(res.data.data || {}) }));
    } catch (err) {
      console.error('Failed to fetch database status:', err);
    }
  }, []);

  const fetchAllData = useCallback(() => {
    fetchOrders();
    fetchMenu();
    fetchStaff();
    fetchDatabaseStatus();
  }, [fetchOrders, fetchMenu, fetchStaff, fetchDatabaseStatus]);

  // Sockets & Realtime Setup
  useEffect(() => {
    fetchAllData();

    const handleNewOrder = (order) => {
      pushNotification(`New order #${order.serial_no || order.id} placed for Table ${order.table_number || ''}.`, 'alert');
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === order.id);
        if (!exists) return [order, ...prev];
        return prev.map((o) => (o.id === order.id ? order : o));
      });
      fetchMenu();
    };

    const handleOrderStatus = (order) => {
      if (order.status === 'waiting_bill') {
        pushNotification(`🔔 NEW BILLING REQUEST: Table ${order.table_number || ''} sent to counter for final billing!`, 'alert');
      } else {
        pushNotification(`Order #${order.serial_no || order.id} updated to ${order.status?.toUpperCase()}.`, 'info');
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      fetchMenu();
    };

    const handleOrderItems = (order) => {
      pushNotification(`Add-on items added to order #${order.serial_no || order.id}.`, 'info');
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      fetchMenu();
    };

    const handleOrderCustomer = (order) => {
      setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
    };

    const handleMenu = () => {
      pushNotification('Menu item catalog was updated.', 'info');
      fetchMenu();
    };

    const handleConnect = () => {
      setSocketConnected(true);
      pushNotification('Realtime connection active.', 'info');
      fetchAllData();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      pushNotification('Realtime connection interrupted. Fallback polling active.', 'alert');
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderStatus);
    socket.on('orderUpdated', handleOrderItems);
    socket.on('orderCustomerUpdated', handleOrderCustomer);
    socket.on('menuUpdated', handleMenu);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderStatus);
      socket.off('orderUpdated', handleOrderItems);
      socket.off('orderCustomerUpdated', handleOrderCustomer);
      socket.off('menuUpdated', handleMenu);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchAllData, fetchMenu, pushNotification]);

  // Fallback Polling & Visibility Resync
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAllData();
    }, LIVE_REFRESH_MS);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchAllData();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchAllData]);

  // Sidebar Badge Calculations
  const activeOrdersCount = useMemo(() => {
    return orders.filter((o) => isTableOccupied(o)).length;
  }, [orders]);

  const occupiedTablesCount = useMemo(() => {
    return new Set(
      orders
        .filter((o) => isTableOccupied(o) && o.table_label !== 'Packing')
        .map((o) => Number(o.table_number))
        .filter((n) => Number.isInteger(n) && n > 0)
    ).size;
  }, [orders]);

  const lowStockCount = useMemo(() => {
    return menu.filter((i) => Number(i.stock_quantity ?? 0) <= 5).length;
  }, [menu]);

  const unpaidBillsCount = useMemo(() => {
    return orders.filter((o) => !o.payment_received && o.payment_status !== 'paid' && o.status !== 'cancelled').length;
  }, [orders]);

  // Navigation Helper with optional initial filter parameter
  const handleNavigate = (section, filterParam = 'all') => {
    setActiveSection(section);
    if (section === 'orders') {
      setOrdersFilterParam(filterParam);
    }
  };

  // Dynamic Page Headers
  const sectionMeta = {
    dashboard: { title: 'Dashboard', subtitle: 'Monitor your restaurant performance in real time.' },
    orders: { title: 'Orders Management', subtitle: 'Live status tracking and order history across dining rooms.' },
    tables: { title: 'Table Floor Management', subtitle: 'Real-time floor occupancy, reservations, and table service.' },
    menu: { title: 'Menu Master', subtitle: 'Catalog administration, dish pricing, variants, and stock control.' },
    inventory: { title: 'Inventory & Stock Control', subtitle: 'Stock balances, low-stock warnings, and restock batches.' },
    staff: { title: 'Staff Performance', subtitle: 'Team performance, orders serviced, and shift sales volume.' },
    customers: { title: 'Customer Database', subtitle: 'Patron dining history, visit frequency, and loyalty spending.' },
    billing: { title: 'Billing Desk', subtitle: 'Customer invoices, receipt print simulation, and payment tracking.' },
    payments: { title: 'Payments Overview', subtitle: 'Cash, UPI QR, and card collections audit and ledger.' },
    reports: { title: 'Reports & Analytics', subtitle: 'Operational sales, order throughput, and business performance reports.' },
    settings: { title: 'Settings & System Health', subtitle: 'Restaurant profile, tax policies, hardware printers, and database backup.' },
  };

  // Find active order for inspected table
  const inspectedTableOrder = useMemo(() => {
    if (!inspectedTableNum) return null;
    return orders.find((o) => Number(o.table_number) === inspectedTableNum && isTableOccupied(o)) || null;
  }, [orders, inspectedTableNum]);

  return (
    <div className="pos-layout">
      {/* 1. Dedicated Manager Sidebar */}
      <ManagerSidebar
        activeSection={activeSection}
        onSectionChange={(sec) => setActiveSection(sec)}
        currentUser={currentUser}
        onLogout={handleLogout}
        badgeCounts={{
          activeOrders: activeOrdersCount,
          occupiedTables: occupiedTablesCount,
          lowStockCount,
          unpaidBills: unpaidBillsCount,
        }}
      />

      {/* 2. Main POS Surface */}
      <div className="pos-main flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <ManagerTopNav
          title={sectionMeta[activeSection]?.title || 'Dashboard'}
          subtitle={sectionMeta[activeSection]?.subtitle}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          socketConnected={socketConnected}
          currentUser={currentUser}
          notificationCount={notifications.length}
          notifications={notifications}
          onNotificationClick={() => setActiveSection('orders')}
          onLogout={handleLogout}
        />

        {/* Scrollable Main Content Surface */}
        <div className="pos-content flex-1 overflow-auto p-6 bg-[var(--color-background)]">
          {activeSection === 'dashboard' && (
            <ManagerDashboardOverview
              orders={orders}
              menu={menu}
              staff={staff}
              currentUser={currentUser}
              onNavigate={handleNavigate}
              onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
              onSelectTable={(tableNum) => setInspectedTableNum(tableNum)}
              onReviewBill={(order) => setReviewingBillOrder(order)}
            />
          )}

          {activeSection === 'orders' && (
            <ManagerOrdersView
              orders={orders}
              initialFilter={ordersFilterParam}
              onOrderUpdated={fetchAllData}
              onOpenNewOrder={() => setIsNewOrderModalOpen(true)}
            />
          )}

          {activeSection === 'tables' && (
            <ManagerTablesView
              orders={orders}
              staff={staff}
              onOpenNewOrder={(tableNum) => {
                setIsNewOrderModalOpen(true);
              }}
              onOrderUpdated={fetchAllData}
              onNavigateToBilling={(orderId) => {
                const targetOrder = orders.find((o) => o.id === orderId);
                if (targetOrder?.status === 'waiting_bill') {
                  setReviewingBillOrder(targetOrder);
                } else {
                  setActiveSection('billing');
                }
              }}
            />
          )}

          {activeSection === 'menu' && (
            <ManagerMenuView
              menu={menu}
              onMenuUpdated={fetchMenu}
            />
          )}

          {activeSection === 'inventory' && (
            <ManagerInventoryView
              menu={menu}
              onMenuUpdated={fetchMenu}
            />
          )}

          {activeSection === 'staff' && (
            <ManagerStaffView
              staff={staff}
              orders={orders}
            />
          )}

          {activeSection === 'customers' && (
            <ManagerCustomersView
              orders={orders}
            />
          )}

          {activeSection === 'billing' && (
            <ManagerBillingView
              orders={orders}
              onOrderUpdated={fetchAllData}
              onReviewBill={(order) => setReviewingBillOrder(order)}
            />
          )}

          {activeSection === 'payments' && (
            <ManagerPaymentsView
              orders={orders}
              onOrderUpdated={fetchAllData}
            />
          )}

          {activeSection === 'reports' && (
            <ManagerReportsView
              orders={orders}
              menu={menu}
              staff={staff}
            />
          )}

          {activeSection === 'settings' && (
            <ManagerSettingsView
              databaseStatus={databaseStatus}
              currentUser={currentUser}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>

      {/* Quick "+ New Order" Modal */}
      <ManagerNewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        menu={menu}
        currentUser={currentUser}
        onOrderCreated={() => {
          fetchAllData();
          pushNotification('New order created successfully from Manager Desk.', 'success');
        }}
      />

      {/* Table Detail Inspector Modal */}
      <ManagerTableDetailModal
        tableNumber={inspectedTableNum}
        tableOrder={inspectedTableOrder}
        isOpen={Boolean(inspectedTableNum)}
        onClose={() => setInspectedTableNum(null)}
        onOpenNewOrder={(tbl) => {
          setInspectedTableNum(null);
          setIsNewOrderModalOpen(true);
        }}
        onNavigateToBilling={(orderId) => {
          setInspectedTableNum(null);
          const targetOrder = orders.find((o) => o.id === orderId);
          if (targetOrder?.status === 'waiting_bill') {
            setReviewingBillOrder(targetOrder);
          } else {
            setActiveSection('billing');
          }
        }}
        onReviewBill={(order) => {
          setInspectedTableNum(null);
          setReviewingBillOrder(order);
        }}
        onClearTable={async (orderId) => {
          try {
            await axios.put(`${API_BASE_URL}/api/orders/${orderId}/table-clear`, { table_cleared: true });
            fetchAllData();
            setInspectedTableNum(null);
          } catch (err) {
            console.error('Failed to clear table:', err);
          }
        }}
      />

      {/* Consolidated Bill Review & Settlement Modal */}
      <ManagerBillingReviewModal
        isOpen={Boolean(reviewingBillOrder)}
        order={reviewingBillOrder}
        onClose={() => setReviewingBillOrder(null)}
        onSettleSuccess={(settledOrder) => {
          fetchAllData();
          pushNotification(`Final bill for Table ${settledOrder.table_number || ''} settled and table released.`, 'success');
        }}
        onReturnSuccess={() => {
          fetchAllData();
          pushNotification('Order returned to waiter floor for additional ordering.', 'info');
        }}
      />
    </div>
  );
};

export default ManagerDashboard;
