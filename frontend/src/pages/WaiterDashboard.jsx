import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { getMenuImage } from '../lib/menuArt';
import { normalizeMenuItemType } from '../lib/menuItemTypes';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';
import Sidebar from '../components/Sidebar';
import WaiterChatbot from '../components/WaiterChatbot';

const LIVE_REFRESH_MS = 5000;

const getStatusTone = (status) => {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'preparing':
      return 'bg-sky-100 text-sky-800';
    case 'ready':
      return 'bg-emerald-100 text-emerald-800';
    case 'served':
      return 'bg-slate-100 text-slate-700';
    case 'waiting_bill':
      return 'bg-amber-100 text-amber-800';
    case 'completed':
      return 'bg-emerald-100 text-emerald-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || 0) * item.quantity)
  ), 0)
);

const isNonVegItem = (item) => {
  return normalizeMenuItemType(item?.item_type) === 'Non Veg';
};

const quickStatCards = (pendingOrders, preparingOrders, readyOrders, activeOrders, totalItems, vegItems, nonVegItems) => ([
  {
    label: 'Open Tables',
    value: activeOrders.length,
    tone: 'from-indigo-500/15 via-white to-cyan-500/10',
    accent: 'text-indigo-700'
  },
  {
    label: 'Pending',
    value: pendingOrders.length,
    tone: 'from-amber-500/15 via-white to-orange-500/10',
    accent: 'text-amber-700'
  },
  {
    label: 'Preparing',
    value: preparingOrders.length,
    tone: 'from-sky-500/15 via-white to-blue-500/10',
    accent: 'text-sky-700'
  },
  {
    label: 'Ready',
    value: readyOrders.length,
    tone: 'from-emerald-500/15 via-white to-teal-500/10',
    accent: 'text-emerald-700'
  },
  {
    label: 'Total Items',
    value: totalItems,
    tone: 'from-slate-500/15 via-white to-slate-400/10',
    accent: 'text-slate-700'
  },
  {
    label: 'Veg Items',
    value: vegItems,
    tone: 'from-lime-500/15 via-white to-green-500/10',
    accent: 'text-lime-700'
  },
  {
    label: 'Non Veg Items',
    value: nonVegItems,
    tone: 'from-rose-500/15 via-white to-red-500/10',
    accent: 'text-rose-700'
  }
]);

const formatAddOnLabel = (count) => {
  const total = Number(count || 0);
  if (total <= 0) return 'No add-ons yet';
  if (total === 1) return 'Add-on 1 time';
  return `Add-ons ${total} times`;
};

const TABLE_STATUS_META = {
  free: {
    label: 'Free',
    tone: 'border-emerald-200 bg-emerald-50 text-emerald-700'
  },
  occupied: {
    label: 'Occupied',
    tone: 'border-rose-200 bg-rose-50 text-rose-700'
  },
  waiting_bill: {
    label: 'Waiting bill',
    tone: 'border-amber-200 bg-amber-50 text-amber-700'
  },
  qr_active: {
    label: 'QR active',
    tone: 'border-sky-200 bg-sky-50 text-sky-700'
  }
};

const getTableStatusMeta = (status) => TABLE_STATUS_META[status] || TABLE_STATUS_META.free;
const isTableOrderStillUsingTable = (order) => (
  Boolean(order) && !['completed', 'cancelled'].includes(order.status) && !(order.status === 'waiting_bill' && order.table_cleared)
);
const isWaiterActiveOrder = (order) => (
  Boolean(order) && !['completed', 'cancelled'].includes(order.status) && !(order.status === 'waiting_bill' && order.table_cleared)
);

const WaiterDashboard = () => {
  const currentUser = getStoredUser();
  const [menu, setMenu] = useState([]);
  const [table, setTable] = useState('1');
  const [selectedTable, setSelectedTable] = useState('1');
  const [cart, setCart] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [activeTableFilter, setActiveTableFilter] = useState('all');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [viewingOrderId, setViewingOrderId] = useState(null);
  const [heldDrafts, setHeldDrafts] = useState({});
  const [notice, setNotice] = useState('');
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const selectedTableStatusRef = useRef('');
  const selectedTableRef = useRef(selectedTable);

  useEffect(() => {
    selectedTableRef.current = selectedTable;
  }, [selectedTable]);

  const fetchMenu = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`)
      .then((res) => setMenu(res.data.menu || []))
      .catch(console.error);
  }, []);

  const fetchOrders = useCallback(() => {
    axios.get(`${API_BASE_URL}/api/orders`)
      .then((res) => setOrders(res.data.orders || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetchMenu();
    fetchOrders();
    const refreshAfterEvent = () => {
      window.setTimeout(() => {
        fetchOrders();
        fetchMenu();
      }, 150);
    };

    const mergeIncomingOrder = (incomingOrder) => {
      if (!incomingOrder) return;

      if (incomingOrder?.status === 'waiting_bill' && incomingOrder?.table_number) {
        setNotice(`Table ${incomingOrder.table_number} moved to the billing counter.`);
      }
      if (incomingOrder?.status === 'completed' && incomingOrder?.table_number) {
        setNotice(`Table ${incomingOrder.table_number} payment completed and cleared.`);
        if (String(incomingOrder.table_number) === String(selectedTableRef.current)) {
          setEditingOrderId((currentEditingOrderId) => (
            currentEditingOrderId === incomingOrder.id ? null : currentEditingOrderId
          ));
          setViewingOrderId((currentViewingOrderId) => (
            currentViewingOrderId === incomingOrder.id ? null : currentViewingOrderId
          ));
          setCart([]);
          setCustomerName('');
          setCustomerPhone('');
          setTable(String(incomingOrder.table_number));
        }
      }
      setOrders((prev) => {
        const existing = prev.some((order) => order.id === incomingOrder.id);
        if (!existing) {
          return [incomingOrder, ...prev];
        }

        return prev.map((order) => order.id === incomingOrder.id ? incomingOrder : order);
      });
      refreshAfterEvent();
    };

    socket.on('newOrder', mergeIncomingOrder);
    socket.on('orderStatusUpdated', mergeIncomingOrder);
    socket.on('orderUpdated', mergeIncomingOrder);
    socket.on('orderCustomerUpdated', mergeIncomingOrder);
    socket.on('menuUpdated', fetchMenu);
    const handleReconnect = () => {
      setSocketConnected(true);
      fetchOrders();
      fetchMenu();
      setNotice('Realtime connection restored.');
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setNotice('Realtime connection lost. Refreshing automatically...');
    };
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', mergeIncomingOrder);
      socket.off('orderStatusUpdated', mergeIncomingOrder);
      socket.off('orderUpdated', mergeIncomingOrder);
      socket.off('orderCustomerUpdated', mergeIncomingOrder);
      socket.off('menuUpdated', fetchMenu);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchMenu, fetchOrders]);

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      fetchOrders();
      fetchMenu();
    }, LIVE_REFRESH_MS);

    const refreshLiveData = () => {
      fetchOrders();
      fetchMenu();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshLiveData();
      }
    };

    window.addEventListener('focus', refreshLiveData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', refreshLiveData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMenu, fetchOrders]);

  const visibleMenu = useMemo(() => (
    menu
      .filter((item) => item.available !== false)
      .filter((item) => categoryFilter === 'All' || item.category === categoryFilter)
      .filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
  ), [menu, categoryFilter, search]);

  const categories = ['All', ...new Set(menu.filter((item) => item.available !== false).map((item) => item.category))];
  const totalMenuItems = visibleMenu.length;
  const nonVegMenuItems = visibleMenu.filter(isNonVegItem).length;
  const vegMenuItems = Math.max(totalMenuItems - nonVegMenuItems, 0);

  const myOrders = orders.filter((order) => !currentUser?.id || order.waiter_id === currentUser.id);
  const waiterAssignedActiveOrders = myOrders.filter((order) => isWaiterActiveOrder(order));
  const servedOrders = myOrders
    .filter((order) => order.status === 'completed')
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 8);
  const allDineInOrders = orders.filter((order) => Number(order.table_number || 0) > 0);
  const liveFloorOrders = allDineInOrders
    .filter((order) => isTableOrderStillUsingTable(order))
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
  const openTableCount = new Set(liveFloorOrders.map((order) => String(order.table_number))).size;
  const readyOrders = liveFloorOrders.filter((order) => order.status === 'ready');
  const pendingOrders = liveFloorOrders.filter((order) => order.status === 'pending');
  const preparingOrders = liveFloorOrders.filter((order) => order.status === 'preparing');
  const activeTables = [...new Set(liveFloorOrders.map((order) => order.table_label || `Table ${order.table_number}`))];
  const filteredOrders = liveFloorOrders.filter((order) => (
    activeTableFilter === 'all' || (order.table_label || `Table ${order.table_number}`) === activeTableFilter
  ));
  const cartTotal = cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
  const selectedOrder = orders.find((order) => order.id === editingOrderId) || null;
  const viewedOrder = orders.find((order) => order.id === viewingOrderId) || null;
  const statCards = quickStatCards(
    pendingOrders,
    preparingOrders,
    readyOrders,
    { length: openTableCount },
    totalMenuItems,
    vegMenuItems,
    nonVegMenuItems
  );
  const waiterRevenue = servedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  const selectedTableNumber = selectedTable ? Number(selectedTable) : null;
  const selectedTableOrders = selectedTableNumber
    ? allDineInOrders
      .filter((order) => Number(order.table_number) === selectedTableNumber)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    : [];
  const selectedTableCurrentOrder = selectedTableOrders.find((order) => isTableOrderStillUsingTable(order)) || null;
  const selectedTableDisplayOrder = selectedTableCurrentOrder || selectedTableOrders[0] || null;
  const selectedTableActiveOrders = selectedTableOrders.filter((order) => isTableOrderStillUsingTable(order));
  const selectedTableGuestCount = selectedTableActiveOrders.length
    ? selectedTableActiveOrders.reduce((sum, order) => sum + ((order.items || []).reduce((count, item) => count + Number(item.quantity || 0), 0)), 0)
    : 0;
  const selectedTableQrTotal = selectedTableOrders
    .filter((order) => order.order_source === 'qr')
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
  const selectedTableWaiterTotal = selectedTableOrders
    .filter((order) => order.order_source !== 'qr')
    .reduce((sum, order) => sum + getOrderTotal(order), 0);
  const readyNotifications = readyOrders
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 4);
  const tableTiles = Array.from({ length: 30 }, (_, index) => {
    const tableNumber = index + 1;
    const tableOrders = allDineInOrders
      .filter((order) => Number(order.table_number) === tableNumber)
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime());
    const latestOrder = tableOrders.find((order) => isTableOrderStillUsingTable(order)) || null;
    const hasQrActive = tableOrders.some((order) => order.order_source === 'qr' && isTableOrderStillUsingTable(order));
    const hasWaitingBill = tableOrders.some((order) => !order.table_cleared && (order.status === 'waiting_bill' || (order.payment_status === 'pending' && order.status === 'served')));
    const hasOccupied = tableOrders.some((order) => isTableOrderStillUsingTable(order) && order.status !== 'waiting_bill');
    const status = hasQrActive
      ? 'qr_active'
      : hasWaitingBill
        ? 'waiting_bill'
        : hasOccupied
          ? 'occupied'
          : 'free';

    return {
      tableNumber,
      status,
      latestOrder
    };
  });
  const selectedTableDraft = selectedTable ? heldDrafts[selectedTable] : null;
  const selectedTableLiveStatusKey = selectedTableCurrentOrder
    ? `${selectedTableCurrentOrder.id}:${selectedTableCurrentOrder.status}:${selectedTableCurrentOrder.table_cleared ? '1' : '0'}`
    : selectedTableDisplayOrder
      ? `${selectedTableDisplayOrder.id}:${selectedTableDisplayOrder.status}:${selectedTableDisplayOrder.table_cleared ? '1' : '0'}`
      : `table:${selectedTable}:free`;

  useEffect(() => {
    if (!selectedTable) return;
    if (selectedTableStatusRef.current === selectedTableLiveStatusKey) return;
    selectedTableStatusRef.current = selectedTableLiveStatusKey;

    const liveOrder = selectedTableCurrentOrder || selectedTableDisplayOrder;
    if (!liveOrder) {
      window.setTimeout(() => {
        setEditingOrderId(null);
        setViewingOrderId(null);
        if (!cart.length) {
          setCustomerName('');
          setCustomerPhone('');
        }
      }, 0);
      return;
    }

    if (liveOrder.status === 'ready') {
      window.setTimeout(() => {
        setNotice(`Table ${selectedTable} is ready for pickup from the kitchen.`);
      }, 0);
    } else if (liveOrder.status === 'served') {
      window.setTimeout(() => {
        setNotice(`Table ${selectedTable} has been served.`);
      }, 0);
    } else if (liveOrder.status === 'waiting_bill') {
      window.setTimeout(() => {
        setEditingOrderId((currentEditingOrderId) => (
          currentEditingOrderId === liveOrder.id ? null : currentEditingOrderId
        ));
        setNotice(`Table ${selectedTable} is now at the billing counter.`);
      }, 0);
    } else if (liveOrder.status === 'completed' || liveOrder.table_cleared) {
      window.setTimeout(() => {
        setEditingOrderId((currentEditingOrderId) => (
          currentEditingOrderId === liveOrder.id ? null : currentEditingOrderId
        ));
        setViewingOrderId((currentViewingOrderId) => (
          currentViewingOrderId === liveOrder.id ? null : currentViewingOrderId
        ));
        if (!cart.length) {
          setCustomerName('');
          setCustomerPhone('');
        }
        setNotice(`Table ${selectedTable} is cleared and ready for the next guests.`);
      }, 0);
    }
  }, [cart.length, selectedTable, selectedTableCurrentOrder, selectedTableDisplayOrder, selectedTableLiveStatusKey]);

  const loadSelectedTableDraft = (tableNumber) => {
    const nextTable = String(tableNumber);
    const draft = heldDrafts[nextTable];

    setTable(nextTable);
    setCart(draft?.cart || []);
    setCustomerName(draft?.customerName || '');
    setCustomerPhone(draft?.customerPhone || '');
    setEditingOrderId(null);
    setViewingOrderId(null);
  };

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((cartItem) => cartItem.menu_id === item.id);
      if (existing) {
        return prev.map((cartItem) => (
          cartItem.menu_id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      }

      return [...prev, { menu_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateCartQuantity = (menuId, delta) => {
    setCart((prev) => prev
      .map((item) => item.menu_id === menuId ? { ...item, quantity: item.quantity + delta } : item)
      .filter((item) => item.quantity > 0));
  };

  const resetComposer = () => {
    setCart([]);
    setTable(selectedTable || '1');
    setCustomerName('');
    setCustomerPhone('');
    setEditingOrderId(null);
    setViewingOrderId(null);
  };

  const selectTable = (tableNumber) => {
    const nextTable = String(tableNumber);
    if (selectedTable && selectedTable !== nextTable && cart.length > 0 && !editingOrderId) {
      setHeldDrafts((prev) => ({
        ...prev,
        [selectedTable]: {
          cart,
          customerName,
          customerPhone
        }
      }));
    }
    setSelectedTable(nextTable);
    loadSelectedTableDraft(nextTable);
    setNotice('');
  };

  const startAddItems = (order) => {
    setEditingOrderId(order.id);
    setTable(order.table_label === 'Packing' ? 'packing' : String(order.table_number));
    if (order.table_number) {
      setSelectedTable(String(order.table_number));
    }
    setCustomerName(order.customer_name || '');
    setCustomerPhone(order.customer_phone || '');
    setCart([]);
    setViewingOrderId(order.id);
    setNotice(`Adding items to Order #${formatOrderSerial(order)} for ${formatOrderLocation(order)}.`);
  };

  const submitCart = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (editingOrderId) {
      axios.post(`${API_BASE_URL}/api/orders/${editingOrderId}/items`, {
        items: cart.map((item) => ({ menu_id: item.menu_id, quantity: item.quantity }))
      }).then((res) => {
        if (res.data.success) {
          fetchOrders();
          fetchMenu();
          resetComposer();
          setNotice('Add-on sent to kitchen.');
        }
      }).catch((error) => {
        alert(error.response?.data?.message || 'Failed to add items to order');
      });
      return;
    }

    if (!table) {
      alert('Select a table first');
      return;
    }

    const targetTable = selectedTable || table;

    axios.post(`${API_BASE_URL}/api/orders`, {
      table_number: targetTable === 'packing' ? 0 : parseInt(targetTable, 10),
      table_label: targetTable === 'packing' ? 'Packing' : `Table ${targetTable}`,
      waiter_id: currentUser?.id || null,
      customer_name: customerName.trim() || null,
      customer_phone: customerPhone.trim() || null,
      items: cart.map((item) => ({ menu_id: item.menu_id, quantity: item.quantity }))
    }).then((res) => {
        if (res.data.success) {
          fetchOrders();
          fetchMenu();
          if (targetTable && heldDrafts[targetTable]) {
            setHeldDrafts((prev) => {
              const next = { ...prev };
              delete next[targetTable];
              return next;
            });
          }
          resetComposer();
          setNotice('Order sent to kitchen.');
        }
      }).catch((error) => {
        alert(error.response?.data?.message || 'Failed to create order');
      });
  };

  const markServed = (orderId) => {
    axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: 'served' })
      .catch(console.error);
  };

  const requestBill = (orderId, tableNumber) => {
    axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: 'waiting_bill' })
      .then(() => {
        setNotice(`Bill requested for Table ${tableNumber}. Manager billing counter notified.`);
      })
      .catch(console.error);
  };

  const sendTableToCounter = (order) => {
    if (!order) {
      setNotice('No active order found for this table.');
      return;
    }

    if (order.status === 'waiting_bill') {
      setNotice(`Table ${order.table_number} is already waiting at the billing counter.`);
      return;
    }

    requestBill(order.id, order.table_number);
  };

  const markTableEmpty = (order) => {
    if (!order) {
      clearCurrentOrder();
      setViewingOrderId(null);
      setNotice(`Table ${selectedTable} is now marked empty and ready again.`);
      return;
    }

    if (!['waiting_bill', 'completed'].includes(order.status)) {
      setNotice('Send the table to the counter first, or complete payment, before marking it empty.');
      return;
    }

    axios.put(`${API_BASE_URL}/api/orders/${order.id}/table-clear`, {
      table_cleared: true
    }).then((response) => {
      if (!response.data?.success) {
        setNotice('Failed to mark the table empty.');
        return;
      }

      clearCurrentOrder();
      setViewingOrderId(null);
      setEditingOrderId((currentEditingOrderId) => (
        currentEditingOrderId === order.id ? null : currentEditingOrderId
      ));
      setSelectedTable(String(order.table_number || selectedTable || '1'));
      setOrders((prev) => prev.map((entry) => (
        entry.id === order.id ? response.data.order : entry
      )));
      setNotice(`Table ${order.table_number} is now empty and ready for the next guests.`);
    }).catch((error) => {
      console.error(error);
      setNotice('Failed to mark the table empty.');
    });
  };

  const holdCurrentOrder = () => {
    if (!selectedTable || !cart.length) {
      setNotice('Select a table and add items before holding an order.');
      return;
    }

    setHeldDrafts((prev) => ({
      ...prev,
      [selectedTable]: {
        cart,
        customerName,
        customerPhone
      }
    }));
    setNotice(`Draft held for Table ${selectedTable}.`);
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setEditingOrderId(null);
  };

  const clearCurrentOrder = () => {
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setEditingOrderId(null);
    setTable(selectedTable || '1');
    if (selectedTable) {
      setHeldDrafts((prev) => {
        const next = { ...prev };
        delete next[selectedTable];
        return next;
      });
    }
    setNotice('Current cart cleared.');
  };

  const moveTableSelection = (direction) => {
    if (!selectedTable) return;
    const currentIndex = Math.max(Number(selectedTable) - 1, 0);
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % tableTiles.length
      : (currentIndex - 1 + tableTiles.length) % tableTiles.length;
    selectTable(tableTiles[nextIndex].tableNumber);
  };

  const handleAddOrderForSelectedTable = () => {
    if (!selectedTable) return;

    if (selectedTableCurrentOrder?.status === 'waiting_bill') {
      setNotice(`Table ${selectedTable} is already at the billing counter. Complete payment before starting a new order.`);
      return;
    }

    if (selectedTableCurrentOrder) {
      startAddItems(selectedTableCurrentOrder);
      return;
    }

    setTable(selectedTable);
    setEditingOrderId(null);
    setViewingOrderId(null);
    setNotice(`Ready to start a new order for Table ${selectedTable}.`);
  };


  const sidebarMetrics = [
    { label: 'Pending Orders', value: pendingOrders.length, hint: 'Need acknowledgement' },
    { label: 'Preparing', value: preparingOrders.length, hint: 'Currently in progress' },
    { label: 'Ready for Pickup', value: readyOrders.length, hint: 'Ready for delivery' },
    { label: 'Cart Total', value: `$${cartTotal.toFixed(2)}`, hint: `${cart.length} items selected` }
  ];

  return (
    <>
      <div className="dashboard-page">
        <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute left-[-8rem] top-8 h-64 w-64 rounded-full bg-rose-200/30 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-cyan-200/35 blur-3xl" />
        <div className="absolute bottom-10 left-1/3 h-60 w-60 rounded-full bg-amber-100/30 blur-3xl" />
        </div>
        <div className="dashboard-layout">
          <Sidebar metrics={sidebarMetrics} />
          <div className="dashboard-main">
            <div className="dashboard-shell dashboard-main-stack">
            <div className="dashboard-two-column">
              <div className="min-w-0 space-y-6">
                <div className="dashboard-hero">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="dashboard-kicker">Guest Service Flow</div>
                      <Typography className="mt-3 text-sm font-semibold text-slate-500">
                        Welcome, {currentUser?.name || 'Waiter'}
                      </Typography>
                      <Typography variant="h4" className="dashboard-title mt-3">Waiter Command Center</Typography>
                      <Typography className="dashboard-subtitle">
                        Guide the full floor with faster table service, polished menu browsing, and live kitchen coordination in one view.
                      </Typography>
                      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm">
                        <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        {socketConnected ? 'Realtime connected' : 'Realtime reconnecting'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
                      {statCards.map((stat) => (
                        <div
                          key={stat.label}
                          className={`rounded-[24px] border border-white/70 bg-gradient-to-br ${stat.tone} p-4 shadow-lg backdrop-blur-sm`}
                        >
                          <div className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-500">{stat.label}</div>
                          <div className={`mt-2 text-3xl font-black ${stat.accent}`}>{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="dashboard-panel p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <Typography variant="h5" className="font-black text-slate-900">Table Selector</Typography>
                      <Typography className="text-sm text-slate-500">
                        Choose a table first, then take the order, monitor kitchen status, and generate the bill from one place.
                      </Typography>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outlined" className="rounded-2xl" onClick={() => moveTableSelection('prev')}>
                        Previous Table
                      </Button>
                      <Button variant="outlined" className="rounded-2xl" onClick={() => moveTableSelection('next')}>
                        Next Table
                      </Button>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
                    {tableTiles.map((tile) => {
                      const statusMeta = getTableStatusMeta(tile.status);
                      const isSelected = String(tile.tableNumber) === String(selectedTable);
                      return (
                        <button
                          key={tile.tableNumber}
                          type="button"
                          onClick={() => selectTable(tile.tableNumber)}
                          className={`rounded-[24px] border px-4 py-4 text-left transition-all ${
                            isSelected
                              ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                              : `${statusMeta.tone} shadow-sm hover:-translate-y-0.5`
                          }`}
                        >
                          <div className="text-xs font-black uppercase tracking-[0.22em] opacity-80">Table {tile.tableNumber}</div>
                          <div className="mt-3 text-sm font-bold">{isSelected ? statusMeta.label : statusMeta.label}</div>
                          <div className={`mt-2 text-xs ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                            {tile.latestOrder ? `#${formatOrderSerial(tile.latestOrder)}` : 'No active ticket'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {readyOrders.length > 0 && (
                  <Alert severity="success" className="rounded-2xl border border-emerald-200 bg-emerald-50/90 shadow-sm">
                    {readyOrders.length} order{readyOrders.length > 1 ? 's are' : ' is'} ready for pickup from the kitchen.
                  </Alert>
                )}

                {notice && (
                  <Alert severity="info" className="rounded-2xl border border-sky-200 bg-sky-50/90 shadow-sm">
                    {notice}
                  </Alert>
                )}

                {selectedOrder && (
                  <Alert severity="info" className="rounded-2xl border border-sky-200 bg-sky-50/90 shadow-sm">
                    Adding items to Order #{formatOrderSerial(selectedOrder)} for {formatOrderLocation(selectedOrder)}. If the ticket was ready or already delivered, it will return to the kitchen queue for the next batch.
                  </Alert>
                )}

                {viewedOrder && (
                  <Card className="dashboard-panel border-indigo-100 bg-white/92 shadow-[0_24px_60px_-40px_rgba(59,130,246,0.45)]">
                    <CardContent>
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <Typography variant="h6" className="font-bold text-gray-800">
                            View Order #{formatOrderSerial(viewedOrder)}
                          </Typography>
                          <Typography className="text-sm text-gray-500">
                            {formatOrderLocation(viewedOrder)} • {viewedOrder.waiter?.name || 'Assigned waiter'}
                          </Typography>
                          <Typography className="text-sm text-gray-500">
                            Customer: {viewedOrder.customer_name || 'Walk-in'}
                          </Typography>
                          <Typography className="text-sm text-gray-500">
                            Phone: {viewedOrder.customer_phone || 'Not entered'}
                          </Typography>
                        </div>
                        <div className="flex gap-2">
                          <span className={`rounded px-3 py-1 text-xs font-bold uppercase ${getStatusTone(viewedOrder.status)}`}>
                            {viewedOrder.status}
                          </span>
                          <Button variant="outlined" size="small" onClick={() => setViewingOrderId(null)}>
                            Close
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(viewedOrder.items || []).map((item) => (
                          <div key={`${viewedOrder.id}-${item.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                            <div>
                              <Typography fontWeight="bold">{item.menu_item?.name || 'Item'}</Typography>
                              <Typography className="text-sm text-gray-500">{item.menu_item?.category || 'Menu item'}</Typography>
                            </div>
                            <div className="text-right">
                              <Typography fontWeight="bold">{item.quantity}x</Typography>
                              <Typography className="text-sm text-gray-500">
                                ${((parseFloat(item.menu_item?.price || 0)) * item.quantity).toFixed(2)}
                              </Typography>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-gray-200 pt-4">
                        <Typography className="text-sm text-gray-500">
                          {formatAddOnLabel(viewedOrder.add_on_count)}
                        </Typography>
                        <Typography fontWeight="bold">
                          Total ${getOrderTotal(viewedOrder).toFixed(2)}
                        </Typography>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="dashboard-panel overflow-visible p-5">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px_160px]">
                    <TextField
                      label="Search menu"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Coffee, cake, sandwich..."
                      fullWidth
                    />
                    <FormControl fullWidth>
                      <InputLabel>Category</InputLabel>
                      <Select value={categoryFilter} label="Category" onChange={(event) => setCategoryFilter(event.target.value)}>
                        {categories.map((category) => (
                          <MenuItem key={category} value={category}>{category}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <Button variant="outlined" className="rounded-2xl border-slate-300 font-bold lg:min-h-[56px]" onClick={fetchMenu}>Refresh Menu</Button>
                  </div>
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {categories.map((category) => (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setCategoryFilter(category)}
                        className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                          categoryFilter === category
                            ? 'bg-slate-900 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {category}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <Typography variant="h5" className="font-black text-slate-900">Live Menu</Typography>
                    <Typography className="text-sm text-slate-500">
                      {visibleMenu.length} item{visibleMenu.length === 1 ? '' : 's'} available for quick ordering
                    </Typography>
                  </div>
                  {categoryFilter !== 'All' || search.trim() ? (
                    <Button
                      variant="text"
                      onClick={() => {
                        setSearch('');
                        setCategoryFilter('All');
                      }}
                    >
                      Clear Filters
                    </Button>
                  ) : null}
                </div>

                {visibleMenu.length === 0 ? (
                  <Card className="rounded-[26px] border border-dashed border-slate-300 bg-white/92 shadow-sm">
                    <CardContent className="py-10 text-center">
                      <Typography variant="h6" className="font-bold text-slate-900">Menu is empty for this filter</Typography>
                      <Typography className="mt-2 text-sm text-slate-500">
                        Try clearing the search or category filter, or refresh the menu to load the latest items.
                      </Typography>
                      <div className="mt-5 flex justify-center gap-3">
                        <Button variant="outlined" onClick={() => {
                          setSearch('');
                          setCategoryFilter('All');
                        }}>
                          Clear Filters
                        </Button>
                        <Button variant="contained" onClick={fetchMenu}>
                          Refresh Menu
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : null}

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
                  {visibleMenu.map((item) => (
                    <Card key={item.id} className="group overflow-hidden rounded-[30px] border border-white/80 bg-white/92 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.34)] transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_70px_-34px_rgba(14,165,233,0.34)]">
                      <CardMedia
                        component="img"
                        height="160"
                        image={getMenuImage(item)}
                        alt={item.name}
                        className="h-44 object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <CardContent className="bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))]">
                        <Typography variant="h6" className="mb-1 font-bold leading-tight text-gray-800">{item.name}</Typography>
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">{item.category}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isNonVegItem(item) ? 'bg-rose-100 text-rose-700' : 'bg-lime-100 text-lime-700'}`}>
                              {normalizeMenuItemType(item.item_type)}
                            </span>
                          </div>
                          <Typography className="text-lg font-extrabold text-emerald-600">${parseFloat(item.price).toFixed(2)}</Typography>
                        </div>
                        <div className="mb-4 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          <span>
                            {Number(item.stock_quantity || 0) <= 0
                              ? 'Out of Stock'
                              : Number(item.stock_quantity || 0) <= 2
                                ? 'Only 2 left'
                                : 'Freshly Available'}
                          </span>
                          <span>
                            {Number(item.stock_quantity || 0) <= 0
                              ? '❌'
                              : Number(item.stock_quantity || 0) <= 2
                                ? '⚠️'
                                : `Stock ${item.stock_quantity}`}
                          </span>
                        </div>
                        <Button
                          variant="contained"
                          fullWidth
                          className="rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 py-3 font-bold shadow-md hover:from-sky-700 hover:to-indigo-700"
                          onClick={() => addToCart(item)}
                        >
                          {selectedOrder ? 'Add to Add-On' : 'Add to Cart'}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
                <Card className="dashboard-panel">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Typography variant="h5" className="font-black text-slate-900">
                          {selectedTable ? `Table ${selectedTable}` : 'Select a table'}
                        </Typography>
                        <Typography className="mt-1 text-sm text-slate-500">
                          {selectedTable
                            ? `${selectedTableActiveOrders.length ? 'Active order: Yes' : 'Active order: No'} • Guests ${selectedTableGuestCount || 0}`
                            : 'Choose a table to unlock table-first ordering.'}
                        </Typography>
                      </div>
                      {selectedTable ? (
                        <div className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.24em] ${getTableStatusMeta(tableTiles.find((tile) => String(tile.tableNumber) === String(selectedTable))?.status).tone}`}>
                          {getTableStatusMeta(tableTiles.find((tile) => String(tile.tableNumber) === String(selectedTable))?.status).label}
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-sky-500">QR Order</div>
                        <div className="mt-2 text-xl font-black text-sky-900">${selectedTableQrTotal.toFixed(2)}</div>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-500">Waiter Added</div>
                        <div className="mt-2 text-xl font-black text-emerald-900">${selectedTableWaiterTotal.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                      <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">Table Total</div>
                      <div className="mt-2 text-3xl font-black text-slate-900">${(selectedTableQrTotal + selectedTableWaiterTotal).toFixed(2)}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button variant="contained" className="rounded-2xl bg-slate-900 py-3 font-bold" disabled={!selectedTableDisplayOrder} onClick={() => setViewingOrderId(selectedTableDisplayOrder?.id || null)}>
                        View Order
                      </Button>
                      <Button
                        variant="contained"
                        className="rounded-2xl bg-amber-500 py-3 font-bold"
                        disabled={!selectedTableCurrentOrder || !['served', 'waiting_bill'].includes(selectedTableCurrentOrder.status)}
                        onClick={() => sendTableToCounter(selectedTableCurrentOrder)}
                      >
                        {selectedTableCurrentOrder?.status === 'waiting_bill' ? 'At Counter' : 'Proceed To Counter'}
                      </Button>
                      <Button variant="outlined" className="rounded-2xl py-3 font-bold" disabled={!selectedTable} onClick={handleAddOrderForSelectedTable}>
                        Add Order
                      </Button>
                      <Button
                        variant="outlined"
                        className="rounded-2xl py-3 font-bold"
                        disabled={!selectedTable}
                        onClick={() => markTableEmpty(selectedTableCurrentOrder || selectedTableDisplayOrder)}
                      >
                        Mark Table Empty
                      </Button>
                    </div>

                    {selectedTableDraft ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        Held draft available for Table {selectedTable}. Open the cart and send it when ready.
                      </div>
                    ) : null}
                  </CardContent>
                </Card>

                <Card className="dashboard-panel">
                  <CardContent className="p-6">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <Typography variant="h5" className="font-black text-slate-900">
                        {selectedOrder ? `Table ${selectedTable || table} Cart` : selectedTable ? `Table ${selectedTable} Cart` : 'New Order'}
                      </Typography>
                      <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                        {cart.length} item{cart.length === 1 ? '' : 's'}
                      </div>
                    </div>

                    <FormControl fullWidth className="mb-4">
                      <InputLabel>Table Number</InputLabel>
                      <Select
                        value={table}
                        label="Table Number"
                        disabled={Boolean(selectedOrder)}
                        onChange={(event) => setTable(event.target.value)}
                      >
                        {Array.from({ length: 30 }, (_, index) => index + 1).map((tableNumber) => (
                          <MenuItem key={tableNumber} value={tableNumber}>Table {tableNumber}</MenuItem>
                        ))}
                        <MenuItem value="packing">Packing</MenuItem>
                      </Select>
                    </FormControl>

                    <TextField
                      label="Customer Name"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Enter customer name"
                      fullWidth
                      className="mb-4"
                    />

                    <TextField
                      label="Phone Number"
                      value={customerPhone}
                      onChange={(event) => setCustomerPhone(event.target.value)}
                      placeholder="Enter customer phone number"
                      fullWidth
                      className="mb-4"
                    />

                    <div className="space-y-3 border-b border-slate-200 pb-4">
                      {cart.map((item) => (
                        <div key={item.menu_id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
                          <div className="flex justify-between items-start gap-3">
                            <div>
                              <Typography fontWeight="bold" className="text-slate-900">{item.name}</Typography>
                              <Typography className="text-sm text-gray-500">${parseFloat(item.price).toFixed(2)} each</Typography>
                            </div>
                            <Typography className="font-semibold">${(parseFloat(item.price) * item.quantity).toFixed(2)}</Typography>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button variant="outlined" size="small" className="min-w-0 rounded-xl" onClick={() => updateCartQuantity(item.menu_id, -1)}>-</Button>
                            <span className="min-w-[24px] text-center font-semibold">{item.quantity}</span>
                            <Button variant="outlined" size="small" className="min-w-0 rounded-xl" onClick={() => updateCartQuantity(item.menu_id, 1)}>+</Button>
                          </div>
                        </div>
                      ))}

                      {cart.length === 0 && (
                        <Typography className="text-gray-500 italic">
                          {selectedOrder ? 'Add extra items for this active ticket.' : 'Add items to start a table order.'}
                        </Typography>
                      )}
                    </div>

                    <div className="flex items-center justify-between py-4">
                      <Typography className="text-gray-500">Cart Total</Typography>
                      <Typography variant="h6" fontWeight="bold" className="text-emerald-700">${cartTotal.toFixed(2)}</Typography>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <Button variant="contained" color="success" fullWidth className="rounded-2xl py-3 font-bold shadow-md" disabled={cart.length === 0} onClick={submitCart}>
                        {selectedOrder ? 'Send Add-On to Kitchen' : 'Send Order to Kitchen'}
                      </Button>
                      <div className="grid grid-cols-2 gap-3">
                        <Button variant="outlined" fullWidth className="rounded-2xl" onClick={holdCurrentOrder}>
                          Hold Order
                        </Button>
                        <Button variant="outlined" fullWidth className="rounded-2xl" onClick={clearCurrentOrder}>
                          Clear
                        </Button>
                      </div>
                      {selectedOrder && (
                        <Button variant="outlined" fullWidth className="rounded-2xl" onClick={resetComposer}>
                          Cancel Add-On
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="dashboard-panel">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <Typography variant="h6" className="font-black">Live Floor Orders</Typography>
                      <Button variant="outlined" size="small" className="rounded-xl" onClick={fetchOrders}>Refresh</Button>
                    </div>

                    <FormControl fullWidth className="mb-4">
                      <InputLabel>Table Filter</InputLabel>
                      <Select value={activeTableFilter} label="Table Filter" onChange={(event) => setActiveTableFilter(event.target.value)}>
                        <MenuItem value="all">All active tables</MenuItem>
                        {activeTables.map((tableLabel) => (
                          <MenuItem key={tableLabel} value={tableLabel}>{tableLabel}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
                      {filteredOrders.map((order) => (
                        <Card key={order.id} className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <Typography variant="subtitle1" fontWeight="bold">{formatOrderLocation(order)}</Typography>
                                <Typography variant="body2" color="textSecondary">Order #{formatOrderSerial(order)}</Typography>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusTone(order.status)}`}>
                                {order.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(order.items || []).map((item) => (
                                <Chip
                                  key={`${order.id}-${item.id}`}
                                  size="small"
                                  label={`${item.quantity}x ${item.menu_item?.name || 'Item'}`}
                                />
                              ))}
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="text" size="small" onClick={() => setViewingOrderId(order.id)}>
                                View Order
                              </Button>
                              <Button variant="outlined" size="small" className="rounded-xl" onClick={() => startAddItems(order)}>
                                Add More Items
                              </Button>
                              {order.status === 'ready' && (
                                <Button variant="contained" color="success" size="small" className="rounded-xl" onClick={() => markServed(order.id)}>
                                  Confirm Delivered
                                </Button>
                              )}
                              {order.status === 'served' && (
                                <Button variant="contained" size="small" className="rounded-xl bg-amber-500 text-white hover:bg-amber-600" onClick={() => requestBill(order.id, order.table_number)}>
                                  Request Bill
                                </Button>
                              )}
                              {order.status === 'waiting_bill' && (
                                <Button variant="outlined" size="small" className="rounded-xl border-amber-300 text-amber-700">
                                  Waiting Payment
                                </Button>
                              )}
                            </div>

                            <Typography className="text-sm text-gray-500">
                              {formatAddOnLabel(order.add_on_count)}
                            </Typography>
                          </CardContent>
                        </Card>
                      ))}

                      {filteredOrders.length === 0 && (
                        <Typography className="text-gray-500 italic">No live floor orders match this filter right now.</Typography>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="dashboard-panel">
                  <CardContent className="p-6">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <Typography variant="h6" className="font-black">Ready Alerts & Performance</Typography>
                      <Typography className="text-sm text-gray-500">Orders handled {servedOrders.length + waiterAssignedActiveOrders.length}</Typography>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-indigo-500">Orders Handled</div>
                        <div className="mt-2 text-2xl font-black text-indigo-900">{servedOrders.length + waiterAssignedActiveOrders.length}</div>
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-500">Revenue Served</div>
                        <div className="mt-2 text-2xl font-black text-emerald-900">${waiterRevenue.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="max-h-[32vh] space-y-3 overflow-y-auto pr-1">
                      {readyNotifications.map((order) => (
                        <Card key={order.id} className="rounded-[24px] border border-emerald-200 bg-emerald-50/90 shadow-sm">
                          <CardContent className="space-y-3">
                            <div className="flex justify-between items-start gap-3">
                              <div>
                                <Typography variant="subtitle1" fontWeight="bold">{formatOrderLocation(order)}</Typography>
                                <Typography variant="body2" color="textSecondary">
                                  Order #{formatOrderSerial(order)} • {order.status === 'ready' ? 'Ready now' : order.status}
                                </Typography>
                              </div>
                              <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${getStatusTone(order.status)}`}>
                                {order.status}
                              </span>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(order.items || []).map((item) => (
                                <Chip
                                  key={`${order.id}-${item.id}`}
                                  size="small"
                                  variant="outlined"
                                  label={`${item.quantity}x ${item.menu_item?.name || 'Item'}`}
                                />
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                              <Typography className="text-gray-500">
                                {formatAddOnLabel(order.add_on_count)}
                              </Typography>
                              <Typography fontWeight="bold">
                                Total ${getOrderTotal(order).toFixed(2)}
                              </Typography>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="text" size="small" onClick={() => setViewingOrderId(order.id)}>
                                View Order
                              </Button>
                              {order.status === 'ready' ? (
                                <Button variant="contained" color="success" size="small" className="rounded-xl" onClick={() => markServed(order.id)}>
                                  Serve Now
                                </Button>
                              ) : null}
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      {readyNotifications.length === 0 && (
                        <Typography className="text-gray-500 italic">Ready order notifications will appear here so you do not need to switch to the chef dashboard.</Typography>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
            </div>
          </div>
        </div>
      </div>
      <WaiterChatbot />
    </>
  );
};

export default WaiterDashboard;
