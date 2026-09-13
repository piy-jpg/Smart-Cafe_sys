import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL, formatOrderSerial } from '../lib/appConfig';
import { clearSession, getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

import POSSidebar from '../components/POSSidebar';
import POSTopNav from '../components/POSTopNav';
import TableGrid from '../components/TableGrid';
import OrderPanel from '../components/OrderPanel';
import QuickActions from '../components/QuickActions';
import LiveOrders from '../components/LiveOrders';
import AddItemModal from '../components/AddItemModal';
import OrderDetailsModal from '../components/OrderDetailsModal';

import TablesPage from './TablesPage';
import OrdersPage from './OrdersPage';
import MenuPage from './MenuPage';
import KitchenPage from './KitchenPage';
import CustomersPage from './CustomersPage';
import PaymentsPage from './PaymentsPage';
import ReportsPage from './ReportsPage';
import SettingsPage from './SettingsPage';

const LIVE_REFRESH_MS = 5000;

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const isTableUsingOrder = (order) => (
  Boolean(order) &&
  !['completed', 'cancelled'].includes(order.status) &&
  !(order.status === 'waiting_bill' && order.table_cleared)
);

const WaiterDashboardNew = () => {
  const navigate = useNavigate();
  const currentUser = getStoredUser();

  // Data state
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState('1');
  const [activeTableFilter, setActiveTableFilter] = useState('all');
  const [activeSection, setActiveSection] = useState('dashboard');

  // Cart & Draft state
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [heldDrafts, setHeldDrafts] = useState({});

  // Modals & Drawers
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isOrderDetailsModalOpen, setIsOrderDetailsModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  // System & Connection
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [notifications, setNotifications] = useState([]);

  const selectedTableRef = useRef(selectedTable);
  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  // Fetch Menu from API
  const fetchMenu = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`)
      .then((res) => setMenu(res.data.menu || []))
      .catch((err) => console.error('Failed to load menu:', err));
  }, []);

  // Fetch Orders from API
  const fetchOrders = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/orders`)
      .then((res) => setOrders(res.data.orders || []))
      .catch((err) => console.error('Failed to load orders:', err));
  }, []);

  // WebSocket Listeners
  useEffect(() => {
    fetchMenu();
    fetchOrders();

    const handleOrderEvent = (incomingOrder) => {
      if (!incomingOrder) return;

      if (incomingOrder.status === 'ready' && incomingOrder.table_number) {
        setNotice(`Table ${incomingOrder.table_number} is ready for pickup from kitchen!`);
        setNotifications((prev) => [
          {
            id: Date.now(),
            title: `Table ${incomingOrder.table_number} Ready`,
            message: `Order #${formatOrderSerial(incomingOrder)} is plated on the pass.`,
            time: 'Just now',
          },
          ...prev.slice(0, 9),
        ]);
      } else if (incomingOrder.status === 'waiting_bill' && incomingOrder.table_number) {
        setNotice(`Table ${incomingOrder.table_number} bill requested at cashier desk.`);
      }

      setOrders((prev) => {
        const exists = prev.some((o) => o.id === incomingOrder.id);
        if (!exists) return [incomingOrder, ...prev];
        return prev.map((o) => (o.id === incomingOrder.id ? incomingOrder : o));
      });
    };

    const handleMenuEvent = () => fetchMenu();

    const handleConnect = () => {
      setSocketConnected(true);
      fetchOrders();
      fetchMenu();
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
  }, [fetchMenu, fetchOrders]);

  // Polling fallback every 5 seconds & visibility revalidation
  useEffect(() => {
    const interval = window.setInterval(() => {
      fetchOrders();
      fetchMenu();
    }, LIVE_REFRESH_MS);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchOrders();
        fetchMenu();
      }
    };

    window.addEventListener('focus', fetchOrders);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', fetchOrders);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchMenu, fetchOrders]);

  // Logout handler
  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your shift and log out?')) {
      clearSession();
      navigate('/');
    }
  };

  // Orders calculations
  const allDineInOrders = useMemo(() => (
    orders.filter((o) => Number(o.table_number || 0) > 0)
  ), [orders]);

  const liveFloorOrders = useMemo(() => (
    allDineInOrders
      .filter(isTableUsingOrder)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  ), [allDineInOrders]);

  // Today's Sales Calculation
  const todaySales = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTime = todayStart.getTime();

    return orders
      .filter((o) => o.status !== 'cancelled' && new Date(o.created_at).getTime() >= todayStartTime)
      .reduce((sum, o) => sum + getOrderTotal(o), 0);
  }, [orders]);

  // 30 Tables Matrix
  const tableTiles = useMemo(() => (
    Array.from({ length: 30 }, (_, idx) => {
      const tableNumber = idx + 1;
      const tableOrders = allDineInOrders
        .filter((o) => Number(o.table_number) === tableNumber)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const activeOrder = tableOrders.find(isTableUsingOrder) || null;

      let status = 'free';
      if (activeOrder) {
        if (activeOrder.status === 'waiting_bill') {
          status = 'waiting_bill';
        } else if (activeOrder.status === 'ready') {
          status = 'ready';
        } else if (activeOrder.status === 'preparing') {
          status = 'preparing';
        } else {
          status = 'occupied';
        }
      }

      const totalGuests = activeOrder
        ? (activeOrder.items || []).reduce((sum, item) => sum + item.quantity, 0)
        : 0;

      return {
        id: tableNumber,
        number: tableNumber,
        status,
        order: activeOrder ? {
          ...activeOrder,
          guest_count: totalGuests > 0 ? Math.min(totalGuests, 8) : 2,
          total: getOrderTotal(activeOrder),
        } : null,
      };
    })
  ), [allDineInOrders]);

  // Currently Selected Table Active Order
  const selectedTableNumber = selectedTable ? Number(selectedTable) : null;
  const selectedTableData = useMemo(() => (
    tableTiles.find((t) => t.number === selectedTableNumber) || null
  ), [tableTiles, selectedTableNumber]);

  const selectedTableActiveOrder = selectedTableData?.order || null;
  const selectedTableStatus = selectedTableData?.status || 'free';

  // KPI Metrics for Service Status Bar
  const openTablesCount = tableTiles.filter((t) => t.status === 'free').length;
  const activeOrdersCount = liveFloorOrders.length;
  const pendingOrdersCount = liveFloorOrders.filter((o) => o.status === 'pending').length;
  const preparingOrdersCount = liveFloorOrders.filter((o) => o.status === 'preparing').length;
  const readyOrdersCount = liveFloorOrders.filter((o) => o.status === 'ready').length;

  // Service Alerts List (Ready to serve, Bill requested, Delayed > 15m)
  const serviceAlerts = useMemo(() => {
    const alerts = [];

    // Ready to serve tickets
    liveFloorOrders
      .filter((o) => o.status === 'ready')
      .forEach((o) => {
        alerts.push({
          id: `ready-${o.id}`,
          type: 'ready',
          table: o.table_number,
          orderId: o.id,
          title: `TABLE ${String(o.table_number).padStart(2, '0')}`,
          message: o.handover_target === 'waiter' ? 'At Waiter Counter - Ready to run!' : 'Ready to serve from kitchen',
        });
      });

    // Bill requested tickets
    liveFloorOrders
      .filter((o) => o.status === 'waiting_bill')
      .forEach((o) => {
        alerts.push({
          id: `bill-${o.id}`,
          type: 'bill',
          table: o.table_number,
          order: o,
          title: `TABLE ${String(o.table_number).padStart(2, '0')}`,
          message: 'Bill requested at counter',
        });
      });

    return alerts.slice(0, 3);
  }, [liveFloorOrders]);

  // Select Table Handler with draft preservation
  const handleSelectTable = (tableNumber) => {
    const nextTableStr = String(tableNumber);

    // If switching tables while cart has draft items, save into heldDrafts
    if (selectedTable && selectedTable !== nextTableStr && cart.length > 0) {
      setHeldDrafts((prev) => ({
        ...prev,
        [selectedTable]: {
          cart,
          customerName,
          customerPhone,
          guestCount,
        },
      }));
    }

    setSelectedTable(nextTableStr);

    // Restore draft for this table if any exists
    const draft = heldDrafts[nextTableStr];
    if (draft) {
      setCart(draft.cart || []);
      setCustomerName(draft.customerName || '');
      setCustomerPhone(draft.customerPhone || '');
      setGuestCount(draft.guestCount || 2);
    } else {
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setGuestCount(2);
    }

    setNotice('');
    // On mobile, auto-open drawer when selecting a table
    if (window.innerWidth < 1024) {
      setIsMobileDrawerOpen(true);
    }
  };

  // Cart Management
  const handleAddToCart = (item, note = '') => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_id === item.id);
      if (existing) {
        return prev.map((c) => (
          c.menu_id === item.id
            ? { ...c, quantity: c.quantity + 1, notes: note || c.notes }
            : c
        ));
      }
      return [
        ...prev,
        {
          menu_id: item.id,
          name: item.name,
          price: item.price,
          quantity: 1,
          notes: note || '',
        },
      ];
    });
  };

  const handleUpdateCartQuantity = (menuId, delta) => {
    setCart((prev) => prev
      .map((item) => (item.menu_id === menuId ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0));
  };

  // Send to Kitchen (Order Dispatch)
  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      alert('Cart is empty. Add menu items first.');
      return;
    }

    setSubmitting(true);

    try {
      if (selectedTableActiveOrder) {
        // Add-ons to existing order
        const response = await axios.post(`${API_BASE_URL}/api/orders/${selectedTableActiveOrder.id}/items`, {
          items: cart.map((i) => ({ menu_id: i.menu_id, quantity: i.quantity, notes: i.notes })),
        });

        if (response.data.success) {
          setCart([]);
          fetchOrders();
          setNotice(`Add-on items sent to kitchen for Table ${selectedTable}.`);
        }
      } else {
        // New order for free table
        const targetTable = parseInt(selectedTable, 10);
        const response = await axios.post(`${API_BASE_URL}/api/orders`, {
          table_number: targetTable,
          table_label: `Table ${targetTable}`,
          waiter_id: currentUser?.id || null,
          customer_name: customerName.trim() || null,
          customer_phone: customerPhone.trim() || null,
          items: cart.map((i) => ({ menu_id: i.menu_id, quantity: i.quantity, notes: i.notes })),
        });

        if (response.data.success) {
          setCart([]);
          setCustomerName('');
          setCustomerPhone('');
          setHeldDrafts((prev) => {
            const next = { ...prev };
            delete next[selectedTable];
            return next;
          });
          fetchOrders();
          setNotice(`Order sent to kitchen for Table ${selectedTable}.`);
        }
      }
    } catch (err) {
      console.error('Failed to send order:', err);
      alert(err.response?.data?.message || 'Failed to send order to kitchen');
    } finally {
      setSubmitting(false);
    }
  };

  // Mark Served
  const handleMarkServed = (orderId) => {
    axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: 'served' })
      .then(() => {
        fetchOrders();
        setNotice('Order marked as served to guests.');
      })
      .catch((err) => console.error('Failed to mark served:', err));
  };

  // Request Bill
  const handleRequestBill = (orderId, tableNumber) => {
    axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: 'waiting_bill' })
      .then(() => {
        fetchOrders();
        setNotice(`Bill requested for Table ${tableNumber}. Billing desk alerted.`);
      })
      .catch((err) => console.error('Failed to request bill:', err));
  };

  // Clear / Free Table
  const handleClearTable = (order) => {
    if (!order) return;

    axios.put(`${API_BASE_URL}/api/orders/${order.id}/table-clear`, { table_cleared: true })
      .then((res) => {
        if (res.data.success) {
          fetchOrders();
          setCart([]);
          setNotice(`Table ${order.table_number} is cleared and ready for new guests.`);
        }
      })
      .catch((err) => console.error('Failed to clear table:', err));
  };

  // Quick Action triggers
  const handleQuickAction = (actionId) => {
    switch (actionId) {
      case 'new_order': {
        // Find first free table
        const firstFree = tableTiles.find((t) => t.status === 'free');
        if (firstFree) {
          handleSelectTable(firstFree.number);
          setIsAddItemModalOpen(true);
        } else {
          alert('All 30 tables are currently occupied!');
        }
        break;
      }
      case 'qr_order': {
        // Filter to occupied tables
        setActiveTableFilter('occupied');
        setNotice('Showing active dining tables (including QR orders).');
        break;
      }
      case 'view_kitchen': {
        setActiveSection('kitchen');
        break;
      }
      case 'pending_orders': {
        setActiveTableFilter('preparing');
        break;
      }
      case 'generate_bill': {
        setActiveTableFilter('billing');
        break;
      }
      default:
        break;
    }
  };

  return (
    <div className="pos-layout min-h-screen flex bg-[#f6f8fc]">
      
      {/* 1. LEFT: Compact Navigation Sidebar */}
      <POSSidebar
        activeSection={activeSection}
        onSectionChange={(section) => setActiveSection(section)}
        currentUser={currentUser}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* 2. Operational Top Header */}
        <POSTopNav
          socketConnected={socketConnected}
          currentUser={currentUser}
          notifications={notifications}
          onNotificationClick={(n) => setNotice(n.message)}
          onLogout={handleLogout}
        />

        {/* Global Connection / System Notice Toast */}
        {notice && (
          <div className="bg-blue-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs animate-in slide-in-from-top">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>{notice}</span>
            </div>
            <button
              onClick={() => setNotice('')}
              className="text-blue-200 hover:text-white font-black text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Workspace Body */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Subpage Router if activeSection !== 'dashboard' */}
          {activeSection !== 'dashboard' ? (
            <div className="flex-1 overflow-y-auto p-6">
              {activeSection === 'tables' && <TablesPage />}
              {activeSection === 'orders' && <OrdersPage />}
              {activeSection === 'menu' && <MenuPage />}
              {activeSection === 'kitchen' && <KitchenPage />}
              {activeSection === 'customers' && <CustomersPage />}
              {activeSection === 'payments' && <PaymentsPage />}
              {activeSection === 'reports' && <ReportsPage />}
              {activeSection === 'settings' && <SettingsPage />}
            </div>
          ) : (
            <>
              {/* 3. CENTER: Main Waiter Workspace */}
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                
                {/* Main Dashboard Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight uppercase">
                        LIVE FLOOR
                      </h1>
                      <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        Realtime POS
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Select a table to start or manage an order.
                    </p>
                  </div>

                  {/* Right Header Action Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleQuickAction('new_order')}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>+ New Order</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleQuickAction('qr_order')}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                      </svg>
                      <span>QR Order</span>
                    </button>
                  </div>
                </div>

                {/* Service Status Bar (Compact Clickable Status Counters) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
                  {/* 1. Open Tables */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('free')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-emerald-700">
                      OPEN TABLES
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      {openTablesCount}
                      <span className="text-xs font-semibold text-slate-400 ml-1">/ 30</span>
                    </div>
                  </button>

                  {/* 2. Active Orders */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('occupied')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-blue-700">
                      ACTIVE ORDERS
                    </div>
                    <div className="text-xl font-black text-blue-600 mt-1">
                      {activeOrdersCount}
                    </div>
                  </button>

                  {/* 3. Pending */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('preparing')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/20 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-amber-700">
                      PENDING
                    </div>
                    <div className="text-xl font-black text-amber-600 mt-1">
                      {pendingOrdersCount}
                    </div>
                  </button>

                  {/* 4. Preparing */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('preparing')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-sky-300 hover:bg-sky-50/20 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-sky-700">
                      PREPARING
                    </div>
                    <div className="text-xl font-black text-sky-600 mt-1">
                      {preparingOrdersCount}
                    </div>
                  </button>

                  {/* 5. Ready */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('ready')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 group-hover:text-emerald-700">
                      READY
                    </div>
                    <div className="text-xl font-black text-emerald-600 mt-1">
                      {readyOrdersCount}
                    </div>
                  </button>

                  {/* 6. Today's Sales */}
                  <button
                    type="button"
                    onClick={() => setActiveTableFilter('all')}
                    className="p-3 bg-white rounded-xl border border-slate-200 hover:border-slate-300 text-left transition-all shadow-2xs group"
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      TODAY'S SALES
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                      ₹{todaySales.toLocaleString()}
                    </div>
                  </button>
                </div>

                {/* Quick Actions Row */}
                <div className="py-0.5">
                  <QuickActions
                    onAction={handleQuickAction}
                    activeFilter={activeTableFilter}
                  />
                </div>

                {/* Service Alerts Banner (if any urgent action needed) */}
                {serviceAlerts.length > 0 && (
                  <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                      <span className="text-xs font-black text-amber-900 uppercase tracking-wider">
                        Floor Alerts ({serviceAlerts.length})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {serviceAlerts.map((alt) => (
                        <div
                          key={alt.id}
                          className="flex items-center gap-2 px-3 py-1 bg-white border border-amber-200 rounded-xl text-xs shadow-2xs"
                        >
                          <span className="font-black text-slate-900">{alt.title}</span>
                          <span className="text-slate-500">{alt.message}</span>
                          {alt.type === 'ready' && (
                            <button
                              type="button"
                              onClick={() => handleMarkServed(alt.orderId)}
                              className="ml-1 px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-bold shadow-2xs"
                            >
                              ✓ Serve
                            </button>
                          )}
                          {alt.type === 'bill' && (
                            <span className="ml-1 px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-[11px] font-bold">
                              At Manager Counter
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Table Management: 30-Table Restaurant Floor Grid */}
                <TableGrid
                  tables={tableTiles}
                  selectedTable={selectedTable}
                  onSelectTable={handleSelectTable}
                  activeFilter={activeTableFilter}
                  onFilterChange={(filter) => setActiveTableFilter(filter)}
                />

                {/* Live Orders Section */}
                <LiveOrders
                  orders={liveFloorOrders}
                  onSelectOrder={(order) => {
                    handleSelectTable(order.table_number);
                    setSelectedOrderForDetails(order);
                    setIsOrderDetailsModalOpen(true);
                  }}
                />

              </main>

              {/* 4. RIGHT: Sticky Order / Cart Panel (Desktop) */}
              <div className="hidden lg:block h-full">
                <OrderPanel
                  selectedTable={selectedTable}
                  tableStatus={selectedTableStatus}
                  activeOrder={selectedTableActiveOrder}
                  cart={cart}
                  customerName={customerName}
                  onCustomerNameChange={(val) => setCustomerName(val)}
                  guestCount={guestCount}
                  onGuestCountChange={(cnt) => setGuestCount(cnt)}
                  onOpenAddItemModal={() => setIsAddItemModalOpen(true)}
                  onSendToKitchen={handleSendToKitchen}
                  onMarkServed={handleMarkServed}
                  onRequestBill={handleRequestBill}
                  onClearTable={handleClearTable}
                  onOpenOrderDetails={(order) => {
                    setSelectedOrderForDetails(order);
                    setIsOrderDetailsModalOpen(true);
                  }}
                  onUpdateCartQuantity={handleUpdateCartQuantity}
                  submitting={submitting}
                />
              </div>

              {/* Mobile Floating Cart Trigger Button */}
              <div className="lg:hidden fixed bottom-4 right-4 z-40">
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-xl font-black text-xs flex items-center gap-2.5 active:scale-95"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>
                    Table {selectedTable ? String(selectedTable).padStart(2, '0') : '--'} • Cart ({cart.length})
                  </span>
                </button>
              </div>

              {/* Mobile Slide-Over Drawer */}
              {isMobileDrawerOpen && (
                <div className="lg:hidden fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
                  <div className="w-full sm:w-96 bg-white h-full shadow-2xl flex flex-col">
                    <OrderPanel
                      selectedTable={selectedTable}
                      tableStatus={selectedTableStatus}
                      activeOrder={selectedTableActiveOrder}
                      cart={cart}
                      customerName={customerName}
                      onCustomerNameChange={(val) => setCustomerName(val)}
                      guestCount={guestCount}
                      onGuestCountChange={(cnt) => setGuestCount(cnt)}
                      onOpenAddItemModal={() => setIsAddItemModalOpen(true)}
                      onSendToKitchen={handleSendToKitchen}
                      onMarkServed={handleMarkServed}
                      onRequestBill={handleRequestBill}
                      onClearTable={handleClearTable}
                      onOpenOrderDetails={(order) => {
                        setSelectedOrderForDetails(order);
                        setIsOrderDetailsModalOpen(true);
                      }}
                      onUpdateCartQuantity={handleUpdateCartQuantity}
                      onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
                      submitting={submitting}
                    />
                  </div>
                </div>
              )}
            </>
          )}

        </div>

      </div>

      {/* 5. Add Item Modal / Drawer */}
      <AddItemModal
        isOpen={isAddItemModalOpen}
        onClose={() => setIsAddItemModalOpen(false)}
        menu={menu}
        cart={cart}
        onAddToCart={handleAddToCart}
        onUpdateCartQuantity={handleUpdateCartQuantity}
        tableNumber={selectedTable}
        isAddOn={Boolean(selectedTableActiveOrder)}
      />

      {/* 6. Order Details & KOT Ticket Inspector Modal */}
      <OrderDetailsModal
        isOpen={isOrderDetailsModalOpen}
        onClose={() => setIsOrderDetailsModalOpen(false)}
        order={selectedOrderForDetails || selectedTableActiveOrder}
        onMarkServed={handleMarkServed}
        onRequestBill={handleRequestBill}
        onAddMoreItems={() => setIsAddItemModalOpen(true)}
        onClearTable={handleClearTable}
      />

    </div>
  );
};

export default WaiterDashboardNew;