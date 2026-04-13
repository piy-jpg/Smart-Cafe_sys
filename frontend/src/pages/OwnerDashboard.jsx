import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CircularProgress, Chip, Typography } from '@mui/material';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';
import Sidebar from '../components/Sidebar';
import MenuCatalogPanel from '../components/MenuCatalogPanel';
import { getMenuCategoryOptions } from '../lib/menuCategories';
import { readImageFileAsDataUrl } from '../lib/menuImageUpload';
import { MENU_ITEM_TYPES, normalizeMenuItemType } from '../lib/menuItemTypes';
const TOTAL_DINE_IN_TABLES = 30;
const PAYMENT_METHODS = ['cash', 'upi', 'card', 'other'];
const PUBLIC_RESTAURANT_CODE = 'smartcafe_main';
const QR_APP_URL_KEY = 'smartCafeQrAppUrl';
const LIVE_REFRESH_MS = 5000;

const defaultOwnerControl = {
  controlState: {
    backupSchedule: {
      enabled: true,
      frequency: 'daily',
      time: '02:00'
    },
    rolePermissions: {}
  },
  authActivity: [],
  suspiciousActivity: []
};

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => {
    const price = parseFloat(item.menu_item?.price || 0);
    const quantity = Number(item.quantity || 0);
    return sum + (price * quantity);
  }, 0)
);

const formatTimestamp = (value) => {
  if (!value) return 'Not yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not yet';
  return date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatPaymentMethodLabel = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'upi') return 'UPI';
  if (normalized === 'card') return 'Card';
  if (normalized === 'cash') return 'Cash';
  return 'Other';
};
const formatCompactCurrency = (value) => {
  const amount = Number(value || 0);
  if (Math.abs(amount) >= 1000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return formatCurrency(amount);
};

const normalizePublicAppUrl = (value) => {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return '';
  }
};

const getPercent = (value, total) => {
  if (!total) return 0;
  return Math.max(6, Math.min(100, (value / total) * 100));
};

const toCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadTextFile = (content, fileName, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const downloadCsvFile = (rows, fileName) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(','))
  ];
  downloadTextFile(lines.join('\n'), fileName, 'text/csv;charset=utf-8;');
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getRangeStart = (range) => {
  const now = new Date();

  if (range === 'week') {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 6);
    return start;
  }

  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return startOfDay(now);
};

const minutesBetween = (start, end) => {
  if (!start || !end) return 0;
  const left = new Date(start).getTime();
  const right = new Date(end).getTime();
  if (Number.isNaN(left) || Number.isNaN(right) || right < left) return 0;
  return (right - left) / 60000;
};

const getCostRatio = (category = '') => {
  const normalized = category.toLowerCase();
  if (normalized.includes('espresso')) return 0.32;
  if (normalized.includes('coffee')) return 0.36;
  if (normalized.includes('tea')) return 0.28;
  if (normalized.includes('snack')) return 0.42;
  if (normalized.includes('dessert')) return 0.4;
  if (normalized.includes('juice')) return 0.33;
  return 0.35;
};

const getCustomerKey = (order) => (
  String(order.customer_phone || '').trim()
  || String(order.customer_name || '').trim().toLowerCase()
  || `guest-order-${order.id || order.serial_no || order.created_at || 'unknown'}`
);

const getCustomerDisplayName = (order) => (
  String(order.customer_name || '').trim()
  || String(order.customer_phone || '').trim()
  || `Guest ${formatOrderLocation(order)}`
);

const getNetOrderTotal = (order) => Math.max(
  0,
  getOrderTotal(order) - Number(order.discount_amount || 0) - Number(order.refund_amount || 0)
);

const isOrderStillActiveOnFloor = (order) => (
  Boolean(order) && !['served', 'cancelled', 'completed'].includes(order.status) && !(order.status === 'waiting_bill' && order.table_cleared)
);

const SectionHeader = ({ title, subtitle, chip }) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <Typography variant="h5" className="font-bold text-inherit">{title}</Typography>
      {subtitle ? <Typography className="mt-1 text-sm opacity-70">{subtitle}</Typography> : null}
    </div>
    {chip ? <Chip label={chip} size="small" /> : null}
  </div>
);

const MetricCard = ({ label, value, hint, tone = 'bg-white border border-slate-200 text-slate-900' }) => (
  <div className={`rounded-3xl p-5 shadow-sm ${tone}`}>
    <Typography className="text-xs uppercase tracking-[0.26em] opacity-70">{label}</Typography>
    <Typography variant="h4" className="mt-3 font-black">{value}</Typography>
    <Typography className="mt-2 text-sm opacity-75">{hint}</Typography>
  </div>
);

const mergeOrderById = (orders, incomingOrder) => {
  const existing = orders.some((order) => order.id === incomingOrder.id);
  if (!existing) {
    return [incomingOrder, ...orders];
  }

  return orders.map((order) => (order.id === incomingOrder.id ? incomingOrder : order));
};

const OwnerDashboard = () => {
  const currentUser = getStoredUser();
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [range, setRange] = useState('day');
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [users, setUsers] = useState([]);
  const [databaseStatus, setDatabaseStatus] = useState({
    engine: 'SQLite',
    file_name: 'smart_cafe.sqlite',
    exists: true,
    size_bytes: 0,
    updated_at: null
  });
  const [ownerControl, setOwnerControl] = useState(defaultOwnerControl);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [notice, setNotice] = useState('');
  const [newItem, setNewItem] = useState({ name: '', category: 'Hot Coffee', price: '', stock_quantity: '', image_url: '', item_type: 'Veg' });
  const [editImageItemId, setEditImageItemId] = useState('');
  const [editImagePreview, setEditImagePreview] = useState('');
  const [restockItemId, setRestockItemId] = useState('');
  const [restockQuantity, setRestockQuantity] = useState('');
  const [disableItemId, setDisableItemId] = useState('');
  const [financialOrderId, setFinancialOrderId] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [assignOrderId, setAssignOrderId] = useState('');
  const [assignWaiterId, setAssignWaiterId] = useState('');
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [backupForm, setBackupForm] = useState({
    enabled: true,
    frequency: 'daily',
    time: '02:00'
  });
  const [permissionDraft, setPermissionDraft] = useState({});
  const [qrTables, setQrTables] = useState([]);
  const [loadingQrTables, setLoadingQrTables] = useState(false);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [liveStatusMessage, setLiveStatusMessage] = useState('Waiting for first sync...');
  const [publicOrderAppUrl, setPublicOrderAppUrl] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(QR_APP_URL_KEY) || window.location.origin;
  });

  const jumpToMasterMenu = () => {
    const section = document.getElementById('owner-master-menu-controls');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const scrollToOwnerSection = (sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const fetchData = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setLoading(true);
      const [ordersRes, menuRes, usersRes, databaseRes, ownerControlRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/api/orders`),
        axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`),
        axios.get(`${API_BASE_URL}/api/users`),
        axios.get(`${API_BASE_URL}/api/system/database/status`),
        axios.get(`${API_BASE_URL}/api/system/owner-control`)
      ]);

      setOrders(ordersRes.data.orders || []);
      setMenu(menuRes.data.menu || []);
      setUsers(usersRes.data.users || []);
      setDatabaseStatus((prev) => ({ ...prev, ...(databaseRes.data.data || {}) }));

      const controlData = ownerControlRes.data.data || defaultOwnerControl;
      setOwnerControl(controlData);
      setBackupForm(controlData.controlState?.backupSchedule || defaultOwnerControl.controlState.backupSchedule);
      setPermissionDraft(
        Object.fromEntries(
          Object.entries(controlData.controlState?.rolePermissions || {}).map(([role, perms]) => [role, (perms || []).join(', ')])
        )
      );
      setLastSyncedAt(new Date().toISOString());
      setLiveStatusMessage('Dashboard synced from live backend data.');
    } catch (error) {
      console.error(error);
      setLiveStatusMessage('Live sync retrying. Last refresh did not complete.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(true);

    const syncFromSocket = (message) => {
      setSocketConnected(socket.connected);
      setLastSyncedAt(new Date().toISOString());
      setLiveStatusMessage(message);
      window.setTimeout(() => {
        fetchData(false);
      }, 120);
    };

    const handleNewOrder = (order) => {
      setOrders((prev) => mergeOrderById(prev, order));
      syncFromSocket(`New order #${formatOrderSerial(order)} reached owner view.`);
    };

    const handleOrderStatusUpdated = (order) => {
      setOrders((prev) => mergeOrderById(prev, order));
      syncFromSocket(`Order #${formatOrderSerial(order)} moved to ${order.status}.`);
    };

    const handleOrderUpdated = (order) => {
      setOrders((prev) => mergeOrderById(prev, order));
      syncFromSocket(`Order #${formatOrderSerial(order)} was updated live.`);
    };

    const handleOrderCustomerUpdated = (order) => {
      setOrders((prev) => mergeOrderById(prev, order));
      syncFromSocket(`Billing details changed for order #${formatOrderSerial(order)}.`);
    };

    const handleMenuUpdated = () => {
      syncFromSocket('Menu and stock data refreshed.');
    };

    const handleSystemControlUpdated = () => {
      syncFromSocket('Owner controls refreshed live.');
    };

    const refreshOnReconnect = () => {
      setSocketConnected(true);
      syncFromSocket('Realtime connection restored.');
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setLiveStatusMessage('Realtime connection lost. Fallback refresh is still running.');
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderStatusUpdated);
    socket.on('orderUpdated', handleOrderUpdated);
    socket.on('orderCustomerUpdated', handleOrderCustomerUpdated);
    socket.on('menuUpdated', handleMenuUpdated);
    socket.on('systemControlUpdated', handleSystemControlUpdated);
    socket.on('connect', refreshOnReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderStatusUpdated);
      socket.off('orderUpdated', handleOrderUpdated);
      socket.off('orderCustomerUpdated', handleOrderCustomerUpdated);
      socket.off('menuUpdated', handleMenuUpdated);
      socket.off('systemControlUpdated', handleSystemControlUpdated);
      socket.off('connect', refreshOnReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchData]);

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      fetchData(false);
    }, LIVE_REFRESH_MS);

    const refreshOwnerData = () => {
      fetchData(false);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshOwnerData();
      }
    };

    window.addEventListener('focus', refreshOwnerData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', refreshOwnerData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const theme = darkMode ? {
    page: 'min-h-screen bg-slate-950 text-slate-100',
    shell: 'mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8',
    panel: 'rounded-[28px] border border-slate-800 bg-slate-900/90 p-6 shadow-xl shadow-black/20',
    muted: 'text-slate-400',
    subtle: 'bg-slate-800 border border-slate-700',
    table: 'border-slate-800 bg-slate-900/80',
    hero: 'rounded-[32px] border border-cyan-800/60 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.18),_transparent_28%),linear-gradient(145deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.96))] p-7 shadow-2xl shadow-cyan-950/30'
  } : {
    page: 'min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef6ff_45%,#f8fafc_100%)] text-slate-900',
    shell: 'mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8',
    panel: 'rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-lg shadow-slate-200/70',
    muted: 'text-slate-500',
    subtle: 'bg-slate-50 border border-slate-200',
    table: 'border-slate-200 bg-white/80',
    hero: 'rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(145deg,_rgba(255,255,255,0.98),_rgba(241,245,249,0.96))] p-7 shadow-xl shadow-slate-200/70'
  };

  const rangeStart = useMemo(() => getRangeStart(range), [range]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  const filteredOrders = useMemo(() => (
    orders
      .filter((order) => {
        const created = new Date(order.created_at);
        return !Number.isNaN(created.getTime()) && created >= rangeStart;
      })
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
  ), [orders, rangeStart]);
  const menuCategoryOptions = useMemo(() => getMenuCategoryOptions(menu), [menu]);

  const activeOrders = useMemo(() => filteredOrders.filter((order) => isOrderStillActiveOnFloor(order)), [filteredOrders]);
  const nonCancelledOrders = useMemo(() => filteredOrders.filter((order) => order.status !== 'cancelled'), [filteredOrders]);
  const servedOrders = useMemo(() => filteredOrders.filter((order) => ['served', 'waiting_bill', 'completed'].includes(order.status)), [filteredOrders]);
  const cancelledOrders = useMemo(() => filteredOrders.filter((order) => order.status === 'cancelled'), [filteredOrders]);
  const settledOrders = useMemo(() => servedOrders.filter((order) => order.payment_received), [servedOrders]);
  const teamMembers = useMemo(() => users, [users]);
  const waiters = useMemo(() => teamMembers.filter((user) => ['waiter', 'master_waiter'].includes(user.role)), [teamMembers]);

  const revenue = useMemo(() => (
    nonCancelledOrders.reduce((sum, order) => sum + getOrderTotal(order), 0)
  ), [nonCancelledOrders]);
  const monthlyRevenue = useMemo(() => {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthOrders = orders.filter((order) => new Date(order.created_at) >= monthStart && order.status !== 'cancelled');
    return monthOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [orders, now]);
  const totalDiscounts = useMemo(() => (
    nonCancelledOrders.reduce((sum, order) => sum + Number(order.discount_amount || 0), 0)
  ), [nonCancelledOrders]);
  const totalRefunds = useMemo(() => (
    filteredOrders.reduce((sum, order) => sum + Number(order.refund_amount || 0), 0)
  ), [filteredOrders]);
  const cogs = useMemo(() => (
    nonCancelledOrders.reduce((sum, order) => (
      sum + (order.items || []).reduce((itemSum, item) => {
        const price = Number(item.menu_item?.price || 0);
        return itemSum + (price * Number(item.quantity || 0) * getCostRatio(item.menu_item?.category));
      }, 0)
    ), 0)
  ), [nonCancelledOrders]);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - totalDiscounts - totalRefunds;
  const profitMargin = revenue ? (netProfit / revenue) * 100 : 0;

  const averageTicket = nonCancelledOrders.length ? revenue / nonCancelledOrders.length : 0;
  const pendingRevenue = useMemo(() => (
    servedOrders.reduce((sum, order) => sum + (!order.payment_received ? getNetOrderTotal(order) : 0), 0)
  ), [servedOrders]);
  const collectedRevenue = useMemo(() => (
    servedOrders.reduce((sum, order) => sum + (order.payment_received ? getNetOrderTotal(order) : 0), 0)
  ), [servedOrders]);
  const unpaidServedOrders = useMemo(() => servedOrders.filter((order) => !order.payment_received), [servedOrders]);
  const paymentSplit = useMemo(() => {
    const seed = PAYMENT_METHODS.reduce((acc, method) => ({ ...acc, [method]: { method, count: 0, amount: 0 } }), {});
    settledOrders.forEach((order) => {
      const method = String(order.payment_method || 'other').toLowerCase();
      const key = seed[method] ? method : 'other';
      seed[key].count += 1;
      seed[key].amount += getNetOrderTotal(order);
    });
    return Object.values(seed);
  }, [settledOrders]);

  const inventoryUnits = useMemo(() => menu.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0), [menu]);
  const inventoryAssetValue = useMemo(() => menu.reduce((sum, item) => sum + (Number(item.stock_quantity || 0) * Number(item.price || 0)), 0), [menu]);
  const totalReceivedUnits = useMemo(() => menu.reduce((sum, item) => sum + Number(item.total_received || 0), 0), [menu]);
  const availableMenuCount = useMemo(() => menu.filter((item) => item.available !== false && Number(item.stock_quantity || 0) > 0).length, [menu]);
  const inventoryHealth = menu.length ? (availableMenuCount / menu.length) * 100 : 0;
  const lowStockItems = useMemo(() => (
    [...menu]
      .filter((item) => Number(item.stock_quantity || 0) <= 5)
      .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0))
      .slice(0, 5)
  ), [menu]);
  const allTimeNonCancelledOrders = useMemo(() => orders.filter((order) => order.status !== 'cancelled'), [orders]);
  const itemPerformance = useMemo(() => {
    const map = new Map();
    nonCancelledOrders.forEach((order) => {
      const orderDay = startOfDay(new Date(order.created_at)).getTime();
      (order.items || []).forEach((item) => {
        const menuItem = item.menu_item;
        if (!menuItem) return;
        const key = String(menuItem.id);
        const existing = map.get(key) || {
          id: menuItem.id,
          name: menuItem.name,
          category: menuItem.category,
          soldQty: 0,
          lastSoldAt: null,
          revenue: 0,
          cogs: 0,
          dayMap: {}
        };
        const quantity = Number(item.quantity || 0);
        const revenueValue = Number(menuItem.price || 0) * quantity;
        existing.soldQty += quantity;
        existing.revenue += revenueValue;
        existing.cogs += revenueValue * getCostRatio(menuItem.category);
        existing.lastSoldAt = order.created_at;
        existing.dayMap[orderDay] = (existing.dayMap[orderDay] || 0) + quantity;
        map.set(key, existing);
      });
    });
    return [...map.values()];
  }, [nonCancelledOrders]);
  const allTimeItemPerformance = useMemo(() => {
    const map = new Map();
    allTimeNonCancelledOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const menuItem = item.menu_item;
        if (!menuItem) return;
        map.set(String(menuItem.id), {
          id: menuItem.id,
          lastSoldAt: order.created_at
        });
      });
    });
    return map;
  }, [allTimeNonCancelledOrders]);

  const mostProfitableItem = useMemo(() => (
    [...itemPerformance]
      .map((item) => ({ ...item, profit: item.revenue - item.cogs }))
      .sort((left, right) => right.profit - left.profit)[0] || null
  ), [itemPerformance]);

  const salesToday = useMemo(() => {
    const todayOrders = orders.filter((order) => new Date(order.created_at) >= startOfDay(now) && order.status !== 'cancelled');
    return todayOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [orders, now]);
  const collectedToday = useMemo(() => (
    orders
      .filter((order) => {
        if (!order.payment_received || order.status === 'cancelled') return false;
        const recordedAt = new Date(order.payment_recorded_at || order.served_at || order.created_at);
        if (!recordedAt || Number.isNaN(recordedAt.getTime())) return false;
        return recordedAt >= startOfDay(now);
      })
      .reduce((sum, order) => sum + getNetOrderTotal(order), 0)
  ), [orders, now]);
  const yesterdayStart = useMemo(() => {
    const day = startOfDay(now);
    day.setDate(day.getDate() - 1);
    return day;
  }, [now]);
  const salesYesterday = useMemo(() => (
    orders
      .filter((order) => {
        const created = new Date(order.created_at);
        return created >= yesterdayStart && created < startOfDay(now) && order.status !== 'cancelled';
      })
      .reduce((sum, order) => sum + getOrderTotal(order), 0)
  ), [orders, yesterdayStart, now]);
  const salesDeltaPct = salesYesterday ? ((salesToday - salesYesterday) / salesYesterday) * 100 : (salesToday ? 100 : 0);

  const hourBuckets = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, index) => ({ hour: index, total: 0, count: 0 }));
    orders
      .filter((order) => new Date(order.created_at) >= startOfDay(now) && order.status !== 'cancelled')
      .forEach((order) => {
        const created = new Date(order.created_at);
        const bucket = buckets[created.getHours()];
        bucket.total += getOrderTotal(order);
        bucket.count += 1;
      });
    return buckets;
  }, [orders, now]);
  const peakHour = useMemo(() => (
    [...hourBuckets].sort((left, right) => right.total - left.total)[0] || { hour: 0, total: 0, count: 0 }
  ), [hourBuckets]);
  const peakHourLabel = `${String(peakHour.hour).padStart(2, '0')}:00 - ${String((peakHour.hour + 1) % 24).padStart(2, '0')}:00`;
  const salesGraphBuckets = useMemo(() => {
    if (range === 'day') {
      return hourBuckets.map((bucket) => ({
        key: `hour-${bucket.hour}`,
        label: `${String(bucket.hour).padStart(2, '0')}:00`,
        total: bucket.total
      }));
    }

    if (range === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const date = startOfDay(now);
        date.setDate(date.getDate() - (6 - index));
        const dayStartValue = date.getTime();
        const dayEndValue = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
        const total = orders
          .filter((order) => {
            const createdAt = new Date(order.created_at).getTime();
            return order.status !== 'cancelled' && createdAt >= dayStartValue && createdAt < dayEndValue;
          })
          .reduce((sum, order) => sum + getOrderTotal(order), 0);

        return {
          key: `day-${dayStartValue}`,
          label: date.toLocaleDateString([], { weekday: 'short' }),
          total
        };
      });
    }

    return Array.from({ length: now.getDate() }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth(), index + 1);
      const dayStartValue = date.getTime();
      const dayEndValue = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const total = orders
        .filter((order) => {
          const createdAt = new Date(order.created_at).getTime();
          return order.status !== 'cancelled' && createdAt >= dayStartValue && createdAt < dayEndValue;
        })
        .reduce((sum, order) => sum + getOrderTotal(order), 0);

      return {
        key: `month-day-${dayStartValue}`,
        label: String(index + 1).padStart(2, '0'),
        total
      };
    });
  }, [range, hourBuckets, now, orders]);

  const addOnConversionRate = nonCancelledOrders.length
    ? (nonCancelledOrders.filter((order) => Number(order.add_on_count || 0) > 0).length / nonCancelledOrders.length) * 100
    : 0;

  const customerStats = useMemo(() => {
    const map = new Map();
    nonCancelledOrders.forEach((order) => {
      const key = getCustomerKey(order);
      const current = map.get(key) || {
        key,
        name: order.customer_name || formatOrderLocation(order),
        spend: 0,
        visits: 0
      };
      current.name = getCustomerDisplayName(order);
      current.spend += getNetOrderTotal(order);
      current.visits += 1;
      map.set(key, current);
    });
    const customers = [...map.values()].sort((left, right) => right.spend - left.spend);
    const repeatCustomers = customers.filter((customer) => customer.visits > 1);
    const averageVisits = customers.length ? customers.reduce((sum, customer) => sum + customer.visits, 0) / customers.length : 0;
    const clv = customers.length ? customers.reduce((sum, customer) => sum + customer.spend, 0) / customers.length : 0;
    return {
      customers,
      repeatRate: customers.length ? (repeatCustomers.length / customers.length) * 100 : 0,
      averageVisits,
      clv,
      topCustomers: customers.slice(0, 5)
    };
  }, [nonCancelledOrders]);

  const waiterPerformance = useMemo(() => {
    const hoursInRange = range === 'day' ? Math.max(1, now.getHours() + 1) : range === 'week' ? 7 * 12 : 30 * 12;
    const map = new Map();
    nonCancelledOrders.forEach((order) => {
      const name = order.waiter?.name || 'Unassigned';
      const current = map.get(name) || {
        name,
        orders: 0,
        served: 0,
        revenue: 0,
        handlingMinutes: [],
        upsellHits: 0
      };
      current.orders += 1;
      current.revenue += getOrderTotal(order);
      if (['served', 'waiting_bill', 'completed'].includes(order.status)) current.served += 1;
      if (Number(order.add_on_count || 0) > 0) current.upsellHits += 1;
      const handling = minutesBetween(order.created_at, order.served_at || order.ready_at);
      if (handling > 0) current.handlingMinutes.push(handling);
      map.set(name, current);
    });
    return [...map.values()]
      .map((item) => ({
        ...item,
        avgHandling: item.handlingMinutes.length ? item.handlingMinutes.reduce((sum, value) => sum + value, 0) / item.handlingMinutes.length : 0,
        upsellRate: item.orders ? (item.upsellHits / item.orders) * 100 : 0,
        ordersPerHour: item.orders / hoursInRange
      }))
      .sort((left, right) => right.revenue - left.revenue);
  }, [nonCancelledOrders, range, now]);

  const chefPreparationTime = useMemo(() => {
    const values = servedOrders
      .map((order) => minutesBetween(order.preparing_at || order.created_at, order.ready_at || order.served_at))
      .filter((value) => value > 0);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [servedOrders]);

  const inventoryForecast = useMemo(() => {
    const elapsedHours = Math.max(1, now.getHours() + (now.getMinutes() / 60));
    const todayOrders = orders.filter((order) => new Date(order.created_at) >= startOfDay(now) && order.status !== 'cancelled');
    const itemMap = new Map();
    todayOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const menuItem = item.menu_item;
        if (!menuItem) return;
        const key = menuItem.id;
        const current = itemMap.get(key) || {
          id: menuItem.id,
          name: menuItem.name,
          category: menuItem.category,
          soldToday: 0,
          stock: Number(menu.find((menuEntry) => menuEntry.id === menuItem.id)?.stock_quantity || 0)
        };
        current.soldToday += Number(item.quantity || 0);
        itemMap.set(key, current);
      });
    });
    return [...itemMap.values()].map((item) => {
      const pace = item.soldToday / elapsedHours;
      const hoursLeft = pace > 0 ? item.stock / pace : Infinity;
      return {
        ...item,
        pace,
        hoursLeft
      };
    });
  }, [orders, menu, now]);

  const outOfStockSoon = useMemo(() => (
    inventoryForecast
      .filter((item) => item.pace > 0 && item.hoursLeft <= 2)
      .sort((left, right) => left.hoursLeft - right.hoursLeft)
      .slice(0, 4)
  ), [inventoryForecast]);
  const fastMovingItems = useMemo(() => (
    [...inventoryForecast]
      .sort((left, right) => right.soldToday - left.soldToday)
      .slice(0, 5)
  ), [inventoryForecast]);
  const deadStockItems = useMemo(() => (
    menu.filter((item) => {
      const tracked = allTimeItemPerformance.get(String(item.id));
      const stock = Number(item.stock_quantity || 0);
      if (!stock) return false;
      if (!tracked?.lastSoldAt) return true;
      return Date.now() - new Date(tracked.lastSoldAt).getTime() > 3 * 24 * 60 * 60 * 1000;
    }).slice(0, 5)
  ), [menu, allTimeItemPerformance]);

  const consumptionTrend = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = startOfDay(now);
      date.setDate(date.getDate() - (6 - index));
      return {
        label: date.toLocaleDateString([], { weekday: 'short' }),
        key: date.getTime(),
        total: 0
      };
    });

    nonCancelledOrders.forEach((order) => {
      const dayKey = startOfDay(new Date(order.created_at)).getTime();
      const row = days.find((item) => item.key === dayKey);
      if (!row) return;
      row.total += (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    });

    return days;
  }, [nonCancelledOrders, now]);

  const liveAlerts = useMemo(() => {
    const kitchenDelayCount = activeOrders.filter((order) => minutesBetween(order.created_at, now) > 10 && order.status !== 'ready').length;
    const cancellationRate = filteredOrders.length ? (cancelledOrders.length / filteredOrders.length) * 100 : 0;
    return [
      unpaidServedOrders.length ? `Pending payments alert: ${unpaidServedOrders.length} bills are still unpaid.` : null,
      kitchenDelayCount ? `Kitchen delay alert: ${kitchenDelayCount} orders are older than 10 minutes.` : null,
      lowStockItems[0] ? `Low stock: ${lowStockItems[0].name} has ${lowStockItems[0].stock_quantity || 0} left.` : null,
      cancellationRate >= 10 ? `High cancellation rate detected at ${formatPercent(cancellationRate)}.` : null
    ].filter(Boolean);
  }, [activeOrders, now, filteredOrders.length, cancelledOrders.length, unpaidServedOrders.length, lowStockItems]);

  const categoryProfitBreakdown = useMemo(() => {
    const map = new Map();
    itemPerformance.forEach((item) => {
      const current = map.get(item.category || 'Other') || {
        category: item.category || 'Other',
        revenue: 0,
        cogs: 0
      };
      current.revenue += Number(item.revenue || 0);
      current.cogs += Number(item.cogs || 0);
      map.set(current.category, current);
    });

    return [...map.values()]
      .map((entry) => {
        const profit = entry.revenue - entry.cogs;
        return {
          ...entry,
          profit,
          margin: entry.revenue ? (profit / entry.revenue) * 100 : 0
        };
      })
      .sort((left, right) => right.profit - left.profit)
      .slice(0, 6);
  }, [itemPerformance]);

  const expiredStockValue = useMemo(() => (
    deadStockItems.reduce((sum, item) => sum + (Number(item.stock_quantity || 0) * Number(item.price || 0) * 0.35), 0)
  ), [deadStockItems]);
  const wastedItemsCount = useMemo(() => (
    cancelledOrders.reduce((sum, order) => sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0), 0)
  ), [cancelledOrders]);
  const wasteLoss = expiredStockValue + totalRefunds;
  const dailyTarget = 500;
  const targetRemaining = Math.max(0, dailyTarget - salesToday);
  const targetProgress = dailyTarget ? Math.min(100, (salesToday / dailyTarget) * 100) : 0;

  const customerKeysToday = useMemo(() => new Set(
    orders
      .filter((order) => new Date(order.created_at) >= startOfDay(now) && order.status !== 'cancelled')
      .map((order) => getCustomerKey(order))
  ), [orders, now]);
  const customerKeysYesterday = useMemo(() => {
    const end = startOfDay(now);
    return new Set(
      orders
        .filter((order) => {
          const created = new Date(order.created_at);
          return created >= yesterdayStart && created < end && order.status !== 'cancelled';
        })
        .map((order) => getCustomerKey(order))
    );
  }, [orders, yesterdayStart, now]);
  const uniqueCustomerCountToday = customerKeysToday.size;
  const uniqueCustomerCountYesterday = customerKeysYesterday.size;
  const newCustomersToday = useMemo(() => {
    const dayStart = startOfDay(now);
    const priorCustomerKeys = new Set(
      orders
        .filter((order) => new Date(order.created_at) < dayStart && order.status !== 'cancelled')
        .map((order) => getCustomerKey(order))
    );
    return [...customerKeysToday].filter((key) => !priorCustomerKeys.has(key)).length;
  }, [orders, now, customerKeysToday]);
  const returningCustomersToday = Math.max(0, uniqueCustomerCountToday - newCustomersToday);
  const customerGrowthRate = uniqueCustomerCountYesterday
    ? ((uniqueCustomerCountToday - uniqueCustomerCountYesterday) / uniqueCustomerCountYesterday) * 100
    : (uniqueCustomerCountToday ? 100 : 0);

  const previousWeekRevenue = useMemo(() => {
    const start = startOfDay(now);
    start.setDate(start.getDate() - 13);
    const end = startOfDay(now);
    end.setDate(end.getDate() - 6);
    return orders
      .filter((order) => {
        const created = new Date(order.created_at);
        return created >= start && created < end && order.status !== 'cancelled';
      })
      .reduce((sum, order) => sum + getOrderTotal(order), 0);
  }, [orders, now]);
  const thisWeekRevenue = useMemo(() => (
    orders
      .filter((order) => new Date(order.created_at) >= getRangeStart('week') && order.status !== 'cancelled')
      .reduce((sum, order) => sum + getOrderTotal(order), 0)
  ), [orders]);
  const weeklyGrowthRate = previousWeekRevenue ? ((thisWeekRevenue - previousWeekRevenue) / previousWeekRevenue) * 100 : (thisWeekRevenue ? 100 : 0);

  const estimatedTaxCollected = revenue * 0.05;
  const estimatedTaxPayable = Math.max(0, estimatedTaxCollected - (cogs * 0.05));
  const openingBalance = 100;
  const estimatedExpenses = cogs + totalRefunds;
  const closingBalance = openingBalance + collectedToday - estimatedExpenses;

  const supplierOverview = useMemo(() => ([
    {
      name: 'Milk Vendor',
      status: lowStockItems.some((item) => /latte|cappuccino|milk|shake|smoothie/i.test(item.name)) ? 'Due soon' : 'Stable',
      amount: lowStockItems.some((item) => /latte|cappuccino|milk|shake|smoothie/i.test(item.name)) ? 220 : 0
    },
    {
      name: 'Coffee Supplier',
      status: lowStockItems.some((item) => /espresso|americano|coffee|latte|cappuccino/i.test(item.name)) ? 'Reorder suggested' : 'Paid',
      amount: lowStockItems.some((item) => /espresso|americano|coffee|latte|cappuccino/i.test(item.name)) ? 340 : 0
    },
    {
      name: 'Bakery Partner',
      status: lowStockItems.some((item) => /muffin|croissant|brownie|cake|dessert/i.test(item.name)) ? 'Due this evening' : 'Paid',
      amount: lowStockItems.some((item) => /muffin|croissant|brownie|cake|dessert/i.test(item.name)) ? 185 : 0
    }
  ]), [lowStockItems]);

  const smartRecommendations = useMemo(() => {
    const beverageSalesWeak = salesDeltaPct < 0;
    const mostMarginalCategory = categoryProfitBreakdown[0]?.category || 'Coffee';
    return [
      `${salesDeltaPct >= 0 ? 'Sales rose' : 'Sales dropped'} ${formatPercent(Math.abs(salesDeltaPct))} vs yesterday. Suggestion: ${beverageSalesWeak ? 'run a 10% beverage discount between 6 PM and 8 PM.' : 'keep premium pricing steady during the next peak hour.'}`,
      outOfStockSoon[0]
        ? `${outOfStockSoon[0].name} may run out in ${outOfStockSoon[0].hoursLeft.toFixed(1)} hours. Suggestion: restock before ${peakHourLabel}.`
        : 'Inventory is stable right now. Suggestion: keep reserve stock ready for the evening peak.',
      mostProfitableItem
        ? `${mostProfitableItem.name} is leading profit. Suggestion: feature ${mostProfitableItem.name} in the next upsell prompt and bundle with ${mostMarginalCategory}.`
        : 'Waiting for profit leaders. Suggestion: collect more order history before pricing changes.',
      chefPreparationTime > 8
        ? `Prep time is averaging ${chefPreparationTime.toFixed(1)} minutes. Suggestion: add one more kitchen hand during ${peakHourLabel}.`
        : `Prep time is healthy at ${chefPreparationTime.toFixed(1)} minutes. Suggestion: keep staffing steady and focus on quick-turn items.`
    ];
  }, [salesDeltaPct, categoryProfitBreakdown, outOfStockSoon, peakHourLabel, mostProfitableItem, chefPreparationTime]);

  const branchSummary = [
    { name: 'SmartCafe Main', revenue: salesToday, status: 'Live' },
    { name: 'Next Branch Slot', revenue: 0, status: 'Ready to add' }
  ];

  const autoActions = [
    { label: 'If stock < 5', detail: 'Alert owner and show restock action card', active: true },
    { label: 'If sales drop', detail: 'Suggest discount window and promo bundle', active: true },
    { label: 'If delay > 10 min', detail: 'Raise kitchen alert and staffing recommendation', active: true }
  ];

  const forecast = useMemo(() => {
    const dailyRevenue = {};
    const dailyOrders = {};
    orders
      .filter((order) => order.status !== 'cancelled')
      .forEach((order) => {
      const key = startOfDay(new Date(order.created_at)).getTime();
      dailyRevenue[key] = (dailyRevenue[key] || 0) + getOrderTotal(order);
      dailyOrders[key] = (dailyOrders[key] || 0) + 1;
    });

    const sortedDayKeys = Object.keys(dailyRevenue).map(Number).sort((left, right) => left - right);
    const last7Revenue = sortedDayKeys.slice(-7).map((key) => dailyRevenue[key]);
    const last7Orders = sortedDayKeys.slice(-7).map((key) => dailyOrders[key]);
    const avgRevenue = last7Revenue.length ? last7Revenue.reduce((sum, value) => sum + value, 0) / last7Revenue.length : revenue;
    const avgOrders = last7Orders.length ? last7Orders.reduce((sum, value) => sum + value, 0) / last7Orders.length : nonCancelledOrders.length;
    const trendFactor = salesYesterday ? Math.max(0.8, Math.min(1.25, salesToday / salesYesterday || 1)) : 1.05;
    const tomorrowRevenue = avgRevenue * trendFactor;

    const projectedInventory = fastMovingItems.slice(0, 4).map((item) => ({
      name: item.name,
      projectedUnits: Math.ceil((item.soldToday || 0) * 1.15)
    }));

    return {
      tomorrowRevenue,
      projectedInventory,
      waiters: Math.max(1, Math.ceil((avgOrders * trendFactor) / 12)),
      chefs: Math.max(1, Math.ceil((avgOrders * trendFactor) / 20))
    };
  }, [orders, revenue, nonCancelledOrders.length, salesToday, salesYesterday, fastMovingItems]);

  const shiftPlan = useMemo(() => {
    const waiterNames = waiters.slice(0, Math.max(1, forecast.waiters)).map((user) => user.name);
    const chefNames = teamMembers.filter((user) => user.role === 'chef').slice(0, Math.max(1, forecast.chefs)).map((user) => user.name);
    return {
      waiters: waiterNames.length ? waiterNames : ['Assign waiter'],
      chefs: chefNames.length ? chefNames : ['Assign chef']
    };
  }, [waiters, teamMembers, forecast]);

  const recentOrders = useMemo(() => filteredOrders.slice(0, 8), [filteredOrders]);
  const printedBillOrders = useMemo(() => (
    [...filteredOrders]
      .filter((order) => (order.customer_bill_print_count || 0) > 0 || (order.kitchen_bill_print_count || 0) > 0)
      .sort((left, right) => {
        const leftStamp = Math.max(
          new Date(left.last_customer_bill_printed_at || 0).getTime(),
          new Date(left.last_kitchen_bill_printed_at || 0).getTime()
        );
        const rightStamp = Math.max(
          new Date(right.last_customer_bill_printed_at || 0).getTime(),
          new Date(right.last_kitchen_bill_printed_at || 0).getTime()
        );
        return rightStamp - leftStamp;
      })
      .slice(0, 6)
  ), [filteredOrders]);
  const editedBills = useMemo(() => (
    filteredOrders
      .filter((order) => order.edited_after_place || Number(order.add_on_count || 0) > 0)
      .slice(0, 6)
  ), [filteredOrders]);
  const suspiciousBills = useMemo(() => (
    filteredOrders.filter((order) => (
      Number(order.discount_amount || 0) > getOrderTotal(order) * 0.3
      || Number(order.refund_amount || 0) > 0
      || (order.edited_after_place && ['served', 'waiting_bill', 'completed'].includes(order.status))
    )).slice(0, 6)
  ), [filteredOrders]);

  const roleSummary = useMemo(() => {
    const map = new Map();
    teamMembers.forEach((user) => {
      const role = user.role || 'unknown';
      map.set(role, (map.get(role) || 0) + 1);
    });
    return [...map.entries()].map(([role, count]) => ({ role, count }));
  }, [teamMembers]);

  const reportsRows = useMemo(() => filteredOrders.map((order) => ({
    serial: formatOrderSerial(order),
    table: formatOrderLocation(order),
    waiter: order.waiter?.name || 'Unassigned',
    status: order.status,
    total: getOrderTotal(order).toFixed(2),
    discount: Number(order.discount_amount || 0).toFixed(2),
    refund: Number(order.refund_amount || 0).toFixed(2),
    payment_method: order.payment_method || '',
    payment_received: order.payment_received ? 'yes' : 'no',
    created_at: order.created_at
  })), [filteredOrders]);
  const saveOwnerControl = async () => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/system/owner-control`, {
        backupSchedule: backupForm,
        rolePermissions: Object.fromEntries(
          Object.entries(permissionDraft).map(([role, value]) => [
            role,
            String(value || '')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          ])
        )
      });
      const updatedControl = response.data?.data;
      if (updatedControl) {
        setOwnerControl((prev) => ({ ...prev, controlState: updatedControl }));
        setBackupForm(updatedControl.backupSchedule || backupForm);
        setPermissionDraft(
          Object.fromEntries(
            Object.entries(updatedControl.rolePermissions || {}).map(([role, perms]) => [role, (perms || []).join(', ')])
          )
        );
      }
      setNotice('Owner control settings updated.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to update owner control settings.');
    }
  };

  const handleAddMenuItem = async (event) => {
    event.preventDefault();
    try {
      const response = await axios.post(`${API_BASE_URL}/api/menu`, {
        ...newItem,
        stock_quantity: Number(newItem.stock_quantity || 0),
        total_received: Number(newItem.stock_quantity || 0)
      });
      if (response.data?.item) {
        setMenu((prev) => [response.data.item, ...prev]);
      }
      setNewItem({ name: '', category: 'Hot Coffee', price: '', stock_quantity: '', image_url: '', item_type: 'Veg' });
      setNotice('New menu item added.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to add menu item.');
    }
  };

  const handleNewItemImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setNewItem((prev) => ({ ...prev, image_url: '' }));
      return;
    }

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      setNewItem((prev) => ({ ...prev, image_url: imageUrl }));
      setNotice('');
    } catch (error) {
      console.error(error);
      setNewItem((prev) => ({ ...prev, image_url: '' }));
      setNotice(error.message || 'Failed to load image.');
      event.target.value = '';
    }
  };

  const handleExistingItemImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      setEditImagePreview('');
      return;
    }

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      setEditImagePreview(imageUrl);
      setNotice('');
    } catch (error) {
      console.error(error);
      setEditImagePreview('');
      setNotice(error.message || 'Failed to load image.');
      event.target.value = '';
    }
  };

  const handleUpdateMenuImage = async (event) => {
    event.preventDefault();
    if (!editImageItemId) return;

    try {
      const response = await axios.put(`${API_BASE_URL}/api/menu/${editImageItemId}`, {
        image_url: editImagePreview || null
      });

      if (response.data?.item) {
        setMenu((prev) => prev.map((item) => (
          item.id === response.data.item.id ? response.data.item : item
        )));
      }

      setEditImageItemId('');
      setEditImagePreview('');
      setNotice('Menu item image updated.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice(error.response?.data?.message || 'Failed to update menu image.');
    }
  };


  const handleRestock = async (event) => {
    event.preventDefault();
    if (!restockItemId) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/menu/${restockItemId}`, {
        restock_quantity: Number(restockQuantity || 0)
      });
      if (response.data?.item) {
        setMenu((prev) => prev.map((item) => (
          item.id === response.data.item.id ? response.data.item : item
        )));
      }
      setRestockQuantity('');
      setNotice('Inventory restocked.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to restock item.');
    }
  };

  const handleDisableItem = async () => {
    if (!disableItemId) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/menu/${disableItemId}`, {
        available: false
      });
      if (response.data?.item) {
        setMenu((prev) => prev.map((item) => (
          item.id === response.data.item.id ? response.data.item : item
        )));
      }
      setNotice('Menu item disabled.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to disable item.');
    }
  };

  const handleFinancialUpdate = async (event) => {
    event.preventDefault();
    if (!financialOrderId) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${financialOrderId}/owner-controls`, {
        discount_amount: Number(discountAmount || 0),
        refund_amount: Number(refundAmount || 0)
      });
      if (response.data?.order) {
        setOrders((prev) => prev.map((order) => (
          order.id === response.data.order.id ? response.data.order : order
        )));
      }
      setDiscountAmount('');
      setRefundAmount('');
      setNotice('Order financial controls updated.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to update discount or refund.');
    }
  };

  const handleAssignStaff = async (event) => {
    event.preventDefault();
    if (!assignOrderId) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${assignOrderId}/owner-controls`, {
        waiter_id: assignWaiterId || null
      });
      if (response.data?.order) {
        setOrders((prev) => prev.map((order) => (
          order.id === response.data.order.id ? response.data.order : order
        )));
      }
      setNotice('Staff assignment updated.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to assign staff.');
    }
  };

  const handleCancelOrder = async (event) => {
    event.preventDefault();
    if (!cancelOrderId) return;
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${cancelOrderId}/owner-controls`, {
        status: 'cancelled',
        cancellation_reason: cancelReason
      });
      if (response.data?.order) {
        setOrders((prev) => prev.map((order) => (
          order.id === response.data.order.id ? response.data.order : order
        )));
      }
      setCancelReason('');
      setNotice('Order cancelled and inventory restored.');
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Failed to cancel order.');
    }
  };

  const handleDownloadDatabase = async () => {
    try {
      setDownloadingBackup(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/download`;
      link.setAttribute('download', databaseStatus?.file_name || 'smart_cafe.sqlite');
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(error);
      setNotice('Failed to download database backup.');
    } finally {
      window.setTimeout(() => setDownloadingBackup(false), 800);
    }
  };

  const exportExcelLikeCsv = () => {
    downloadCsvFile(reportsRows, `owner_report_${range}_${Date.now()}.csv`);
    setNotice('Excel-friendly CSV export started.');
  };

  const exportPdfSnapshot = () => {
    window.print();
    setNotice('Browser print dialog opened for PDF export.');
  };

  const loadQrTables = async () => {
    try {
      setLoadingQrTables(true);
      const normalizedAppUrl = normalizePublicAppUrl(publicOrderAppUrl);
      const response = await axios.get(`${API_BASE_URL}/api/public/qr-tables`, {
        params: {
          restaurant: PUBLIC_RESTAURANT_CODE,
          tables: TOTAL_DINE_IN_TABLES,
          appUrl: normalizedAppUrl || undefined
        }
      });
      setQrTables(response.data.tables || []);
      if (normalizedAppUrl) {
        localStorage.setItem(QR_APP_URL_KEY, normalizedAppUrl);
      }
      setNotice('Table QR codes generated.');
    } catch (error) {
      console.error(error);
      setNotice('Failed to generate table QR codes.');
    } finally {
      setLoadingQrTables(false);
    }
  };

  const summaryInsights = [
    `Peak hour today: ${peakHourLabel}`,
    `${salesDeltaPct >= 0 ? 'Sales rose' : 'Sales dropped'} ${formatPercent(Math.abs(salesDeltaPct))} vs yesterday`,
    `Most profitable item: ${mostProfitableItem?.name || 'No data yet'}`,
    `${addOnConversionRate < 18 ? 'Low conversion on add-ons today' : 'Add-on conversion is healthy today'}`,
    `Realtime status: ${socketConnected ? 'socket connected' : 'polling fallback only'}`
  ];

  const runSmartAction = async (action) => {
    try {
      if (action === 'price' && mostProfitableItem?.id) {
        const target = menu.find((item) => item.id === mostProfitableItem.id);
        if (!target) return;
        const response = await axios.put(`${API_BASE_URL}/api/menu/${target.id}`, {
          name: target.name,
          category: target.category,
          price: Number((Number(target.price || 0) * 1.05).toFixed(2)),
          stock_quantity: Number(target.stock_quantity || 0),
          total_received: Number(target.total_received || 0)
        });
        if (response.data?.item) {
          setMenu((prev) => prev.map((item) => (item.id === response.data.item.id ? response.data.item : item)));
        }
        setNotice(`Price increased by 5% for ${target.name}.`);
      } else if (action === 'restock' && lowStockItems[0]) {
        const response = await axios.put(`${API_BASE_URL}/api/menu/${lowStockItems[0].id}`, {
          restock_quantity: 12
        });
        if (response.data?.item) {
          setMenu((prev) => prev.map((item) => (item.id === response.data.item.id ? response.data.item : item)));
        }
        setNotice(`Restock order placed for ${lowStockItems[0].name}.`);
      } else if (action === 'discount') {
        const targetOrder = unpaidServedOrders[0] || filteredOrders.find((order) => order.status !== 'cancelled');
        if (targetOrder) {
          setFinancialOrderId(String(targetOrder.id));
          const suggestedDiscount = Math.min(getNetOrderTotal(targetOrder) * 0.1, 25);
          setDiscountAmount(suggestedDiscount ? suggestedDiscount.toFixed(2) : '');
          setRefundAmount('');
          setNotice(`Finance control prepared for order #${formatOrderSerial(targetOrder)} with a suggested discount.`);
        } else {
          setNotice('No eligible live order found for discount guidance.');
        }
        scrollToOwnerSection('owner-finance-controls');
      } else if (action === 'promote' && mostProfitableItem) {
        setNewItem((prev) => ({ ...prev, category: mostProfitableItem.category || prev.category }));
        setNotice(`Promotion focus set to ${mostProfitableItem.name}. Highlight it in QR and waiter upsells.`);
        scrollToOwnerSection('owner-master-menu-controls');
      } else if (action === 'logout') {
        setNotice('Force logout request recorded for review. Connect this button to your auth revoke API when ready.');
      } else if (action === 'block') {
        setNotice('Suspicious user block action queued for the next auth-control integration.');
      } else if (action === 'device') {
        setNotice('Restrict device login policy flagged. Connect this to device session control when ready.');
      } else {
        return;
      }
      fetchData(false);
    } catch (error) {
      console.error(error);
      setNotice('Smart action failed to apply.');
    }
  };

  const sidebarMetrics = [
    { label: 'Today\'s Revenue', value: formatCurrency(salesToday), hint: 'Current day earnings' },
    { label: 'Monthly Revenue', value: formatCurrency(monthlyRevenue), hint: 'This month total' },
    { label: 'Active Orders', value: activeOrders.length, hint: 'In progress now' },
    { label: 'Avg Order Value', value: formatCurrency(averageTicket), hint: 'Per transaction' },
    { label: 'Profit Margin', value: formatPercent(profitMargin), hint: 'Gross margin' }
  ];

  const normalizedQrAppUrl = normalizePublicAppUrl(publicOrderAppUrl);
  const qrAppUsesLocalhost = /:\/\/(localhost|127(?:\.\d{1,3}){3})(?::|\/|$)/i.test(normalizedQrAppUrl);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50"><CircularProgress size={56} /></div>;
  }

  return (
    <div className={`dashboard-page ${theme.page}`}>
      <div className="dashboard-layout">
        <Sidebar
          metrics={sidebarMetrics}
          variant="owner"
          title="Owner Console"
          subtitle="Stable shortcuts and live business metrics while you scroll the full dashboard."
          actions={[
            { label: 'Master Menu', onClick: jumpToMasterMenu }
          ]}
        />
        <div className="dashboard-main">
        <div className={`dashboard-shell dashboard-stack dashboard-main-stack ${theme.shell}`}>
        <div id="owner-overview" className={theme.hero}>
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-500">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
                Live owner intelligence
              </div>
              <Typography className={`mt-4 text-sm font-semibold ${theme.muted}`}>
                Welcome, {currentUser?.name || 'Owner'}
              </Typography>
              <Typography variant="h3" className="mt-4 font-black">Owner Performance Hub</Typography>
              <Typography className={`mt-3 max-w-2xl text-base ${theme.muted}`}>
                Real-time profit intelligence, customer behavior, inventory risk, finance control, forecasting, audit visibility, and security oversight in one dashboard.
              </Typography>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <div className={`rounded-full px-4 py-2 font-semibold ${socketConnected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700'}`}>
                  {socketConnected ? 'Realtime connected' : 'Realtime reconnecting'}
                </div>
                <div className={`rounded-full px-4 py-2 ${theme.subtle}`}>
                  Last sync {formatTimestamp(lastSyncedAt)}
                </div>
              </div>
              <Typography className={`mt-3 text-sm ${theme.muted}`}>
                {liveStatusMessage}
              </Typography>
              <div className="mt-5 flex flex-wrap gap-3">
                {['day', 'week', 'month'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setRange(option)}
                    className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition ${range === option ? 'bg-slate-900 text-white' : `${theme.subtle}`}`}
                  >
                    {option}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setDarkMode((value) => !value)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${theme.subtle}`}
                >
                  {darkMode ? 'Light Mode' : 'Dark Mode'}
                </button>
                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5 sm:w-auto">
                  <div className="flex min-w-max gap-2">
                    {[
                      { label: 'Overview', id: 'owner-overview' },
                      { label: 'Master Menu', id: 'owner-master-menu-controls' },
                      { label: 'Reports', id: 'owner-reports' }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => scrollToOwnerSection(item.id)}
                        className="whitespace-nowrap rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-900 hover:text-white"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={exportExcelLikeCsv} className="rounded-full bg-cyan-600 px-4 py-2 text-sm font-bold text-white">Export Excel</button>
                <button type="button" onClick={exportPdfSnapshot} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-bold text-white">Export PDF</button>
              </div>
            </div>

            <div className={`min-w-[300px] rounded-3xl p-5 ${theme.panel}`}>
              <Typography className="text-xs uppercase tracking-[0.28em] opacity-70">Database Backup</Typography>
              <Typography className="mt-3 font-bold">{databaseStatus?.file_name || 'smart_cafe.sqlite'}</Typography>
              <Typography className={`mt-1 text-sm ${theme.muted}`}>
                {databaseStatus?.size_bytes ? `${(databaseStatus.size_bytes / 1024).toFixed(1)} KB` : 'Live backup ready'}
              </Typography>
              <Typography className={`mt-1 text-sm ${theme.muted}`}>
                Updated {formatTimestamp(databaseStatus?.updated_at)}
              </Typography>
              <Typography className={`mt-3 text-sm ${theme.muted}`}>
                Auto-backup {backupForm.enabled ? `${backupForm.frequency} at ${backupForm.time}` : 'paused'}
              </Typography>
              <button
                type="button"
                onClick={handleDownloadDatabase}
                disabled={downloadingBackup}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {downloadingBackup ? 'Preparing Backup...' : 'Download Database Backup'}
              </button>
              {notice ? <Typography className="mt-3 text-sm text-emerald-500">{notice}</Typography> : null}
            </div>
          </div>
        </div>

        <div className={theme.panel}>
          <SectionHeader
            title="Profit Intelligence"
            subtitle="Estimated business profit view using live sales and category-based cost ratios."
            chip={socketConnected ? 'Most important • Live' : 'Most important • Refreshing'}
          />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Daily Sales" value={formatCurrency(salesToday)} hint="Today total sales" tone="bg-cyan-50 border border-cyan-100 text-cyan-900" />
            <MetricCard label="Revenue" value={formatCurrency(revenue)} hint="Gross sales before costs and reductions" />
            <MetricCard label="COGS" value={formatCurrency(cogs)} hint="Estimated cost of goods sold" tone="bg-rose-50 border border-rose-100 text-rose-900" />
            <MetricCard label="Gross / Net Profit" value={`${formatCurrency(grossProfit)} / ${formatCurrency(netProfit)}`} hint="Net profit after discounts and refunds" tone="bg-emerald-50 border border-emerald-100 text-emerald-900" />
            <MetricCard label="Profit Margin" value={formatPercent(profitMargin)} hint={`Discounts ${formatCurrency(totalDiscounts)} • Refunds ${formatCurrency(totalRefunds)}`} />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className={`rounded-2xl p-4 ${theme.subtle}`}>
              <Typography className="text-sm font-semibold">Collected today</Typography>
              <Typography className="mt-2 text-2xl font-black">{formatCurrency(collectedToday)}</Typography>
              <Typography className={`mt-1 text-sm ${theme.muted}`}>Only settled bills counted</Typography>
            </div>
            <div className={`rounded-2xl p-4 ${theme.subtle}`}>
              <Typography className="text-sm font-semibold">Pending settlement</Typography>
              <Typography className="mt-2 text-2xl font-black">{formatCurrency(pendingRevenue)}</Typography>
              <Typography className={`mt-1 text-sm ${theme.muted}`}>{unpaidServedOrders.length} served bills still unpaid</Typography>
            </div>
            <div className={`rounded-2xl p-4 ${theme.subtle}`}>
              <Typography className="text-sm font-semibold">Average ticket</Typography>
              <Typography className="mt-2 text-2xl font-black">{formatCurrency(averageTicket)}</Typography>
              <Typography className={`mt-1 text-sm ${theme.muted}`}>{nonCancelledOrders.length} valid orders in selected range</Typography>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Decision Action Panel" subtitle="One-tap owner moves based on live sales, stock, and margin signals." chip="Smart actions" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {[
                {
                  title: `Increase price of ${mostProfitableItem?.name || 'top item'}`,
                  detail: 'Apply a 5% price lift to the strongest profit driver.',
                  action: 'price',
                  button: 'Apply +5%'
                },
                {
                  title: `Restock ${lowStockItems[0]?.name || 'low stock item'}`,
                  detail: 'Push a quick restock on the item most at risk of stockout.',
                  action: 'restock',
                  button: 'Restock now'
                },
                {
                  title: 'Add discount campaign',
                  detail: 'Open billing controls for a targeted low-sales recovery move.',
                  action: 'discount',
                  button: 'Open control'
                },
                {
                  title: `Promote ${mostProfitableItem?.name || 'best margin item'}`,
                  detail: 'Highlight a high-margin product in floor and QR ordering prompts.',
                  action: 'promote',
                  button: 'Create promo'
                }
              ].map((item) => (
                <div key={item.title} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="text-xs font-black uppercase tracking-[0.24em] opacity-70">Smart Action</Typography>
                  <Typography className="mt-3 text-lg font-bold">{item.title}</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{item.detail}</Typography>
                  <button
                    type="button"
                    onClick={() => runSmartAction(item.action)}
                    className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
                  >
                    {item.button}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Goal Tracking" subtitle="Motivational revenue target for today." chip="Daily target" />
            <div className="mt-5 space-y-4">
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Daily Target</Typography>
                <Typography className="mt-2 text-3xl font-black">{formatCurrency(dailyTarget)}</Typography>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>Achieved {formatCurrency(salesToday)} • Remaining {formatCurrency(targetRemaining)}</Typography>
                <div className={`mt-4 h-3 rounded-full ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
                  <div className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" style={{ width: `${targetProgress}%` }} />
                </div>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>{formatPercent(targetProgress)} of today&apos;s target reached</Typography>
              </div>
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Trend Comparison</Typography>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>Today vs yesterday: {formatPercent(salesDeltaPct)}</Typography>
                <Typography className={`mt-1 text-sm ${theme.muted}`}>This week vs last week: {formatPercent(weeklyGrowthRate)}</Typography>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Profit Breakdown" subtitle="Category-wise profit view so the owner can see where margin is strongest." chip="Margin map" />
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryProfitBreakdown.map((entry) => (
                <div key={entry.category} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="font-bold">{entry.category}</Typography>
                  <Typography className="mt-3 text-2xl font-black">{formatPercent(entry.margin)}</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>Revenue {formatCompactCurrency(entry.revenue)} • Profit {formatCompactCurrency(entry.profit)}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Loss Analysis" subtitle="Leakage, refunds, and waste visibility." chip="Critical" />
            <div className="mt-5 space-y-3">
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Expired stock</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(expiredStockValue)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Wasted items</Typography>
                <Typography className="mt-2 text-2xl font-black">{wastedItemsCount}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Refund loss</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(totalRefunds)}</Typography>
              </div>
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                <Typography className="text-sm font-semibold">Total loss pressure</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(wasteLoss)}</Typography>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Smart Insights" subtitle="AI-style operational insight layer for the owner." chip="Live" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {summaryInsights.map((insight) => (
                <div key={insight} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="text-sm font-semibold">{insight}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className={theme.panel}>
              <SectionHeader title="AI Recommendations" subtitle="Suggested owner moves based on live comparison and floor rhythm." chip="Recommended" />
              <div className="mt-5 space-y-3">
                {smartRecommendations.map((item) => (
                  <div key={item} className={`rounded-2xl p-4 ${theme.subtle}`}>
                    <Typography className="text-sm font-semibold">{item}</Typography>
                  </div>
                ))}
              </div>
            </div>

            <div className={`${theme.panel} border-red-200`}>
              <SectionHeader title="Real-Time Alerts" subtitle="Critical owner watchlist." chip={`${liveAlerts.length} alerts`} />
              <div className="mt-5 space-y-3">
                {liveAlerts.length ? liveAlerts.map((alert) => (
                  <div key={alert} className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
                    <Typography className="text-sm font-semibold">{alert}</Typography>
                  </div>
                )) : (
                  <Typography className={theme.muted}>No critical alerts right now.</Typography>
                )}
              </div>
            </div>

            <div className={theme.panel}>
              <SectionHeader title="Forecasting" subtitle="Premium forward view based on recent sales rhythm." />
              <div className="mt-5 space-y-4">
                <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Tomorrow Revenue</Typography>
                  <Typography className="mt-2 text-2xl font-black">{formatCurrency(forecast.tomorrowRevenue)}</Typography>
                </div>
                <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <Typography className="font-semibold">Staff requirement</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{forecast.waiters} waiters • {forecast.chefs} chefs</Typography>
                </div>
                <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <Typography className="font-semibold">Required inventory</Typography>
                  <div className="mt-2 space-y-2">
                    {forecast.projectedInventory.length ? forecast.projectedInventory.map((item) => (
                      <Typography key={item.name} className={`text-sm ${theme.muted}`}>{item.name}: {item.projectedUnits} units</Typography>
                    )) : <Typography className={`text-sm ${theme.muted}`}>Need more order history for item forecasts.</Typography>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Customer Intelligence" subtitle="Repeat behavior, top spenders, and customer lifetime value." chip={`${customerStats.customers.length} customers`} />
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <MetricCard label="Repeat Customers" value={formatPercent(customerStats.repeatRate)} hint="Customers with more than one visit" />
              <MetricCard label="Avg Visits" value={customerStats.averageVisits.toFixed(2)} hint="Average visits per customer" />
              <MetricCard label="Customer Lifetime Value" value={formatCurrency(customerStats.clv)} hint="Average customer lifetime spend" />
              <MetricCard label="Top Customer" value={customerStats.topCustomers[0]?.name || 'No data'} hint={customerStats.topCustomers[0] ? formatCurrency(customerStats.topCustomers[0].spend) : 'Waiting for customer records'} />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              <MetricCard label="New Customers Today" value={newCustomersToday} hint="First-time guests in today&apos;s orders" />
              <MetricCard label="Returning Today" value={returningCustomersToday} hint="Known guests who came back today" />
              <MetricCard label="Growth Rate" value={formatPercent(customerGrowthRate)} hint="Unique customer growth vs yesterday" />
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {customerStats.topCustomers.slice(0, 6).map((customer) => (
                <div key={customer.key} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="font-bold">{customer.name}</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>{customer.visits} visits</Typography>
                  <Typography className="mt-3 text-xl font-black">{formatCurrency(customer.spend)}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Cash Flow Dashboard" subtitle="Settlement, methods, expenses, and owner liquidity view." />
            <div className="mt-5 space-y-3">
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Opening balance</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(openingBalance)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Today&apos;s inflow</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(collectedToday)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Expenses</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(estimatedExpenses)}</Typography>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                <Typography className="text-sm font-semibold">Closing balance</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatCurrency(closingBalance)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Daily settlement</Typography>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>Collected {formatCurrency(collectedRevenue)} • Pending {formatCurrency(pendingRevenue)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Refund tracking</Typography>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>{formatCurrency(totalRefunds)} issued in selected range</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Discount tracking</Typography>
                <Typography className={`mt-2 text-sm ${theme.muted}`}>{formatCurrency(totalDiscounts)} applied in selected range</Typography>
              </div>
              {paymentSplit.map((entry) => (
                <div key={entry.method} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-semibold uppercase">{formatPaymentMethodLabel(entry.method)}</Typography>
                    <Typography className="font-bold">{formatCurrency(entry.amount)}</Typography>
                  </div>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>{entry.count} orders settled</Typography>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Staff Control Panel" subtitle="Operational people controls for daily floor execution." chip="Actionable" />
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {[
                { title: 'Assign shift', detail: 'Move to staff assignment controls below.' },
                { title: 'Remove staff', detail: 'Flag inactive team member for schedule cleanup.' },
                { title: 'Give bonus', detail: 'Recognize top revenue waiter from this range.' },
                { title: 'Mark inactive', detail: 'Pause low-utilization staffing for tomorrow.' }
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => setNotice(`${item.title} action opened for owner review.`)}
                  className={`rounded-3xl p-5 text-left transition hover:-translate-y-0.5 ${theme.subtle}`}
                >
                  <Typography className="font-bold">{item.title}</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{item.detail}</Typography>
                </button>
              ))}
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {waiterPerformance.slice(0, 4).map((person, index) => (
                <div key={person.name} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="font-bold">{person.name}</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{person.orders} orders • {formatCurrency(person.revenue)} served</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>Suggested action: {index === 0 ? 'Bonus candidate' : person.orders < 2 ? 'Shift reduction review' : 'Keep active'}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Today Shift Plan" subtitle="Suggested staffing view from the current forecast." chip="Scheduling" />
            <div className="mt-5 space-y-3">
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="font-semibold">Waiters</Typography>
                {shiftPlan.waiters.map((name, index) => (
                  <Typography key={name + index} className={`mt-2 text-sm ${theme.muted}`}>{name} ({index === 0 ? '6 PM - 10 PM' : 'Full shift'})</Typography>
                ))}
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="font-semibold">Chefs</Typography>
                {shiftPlan.chefs.map((name, index) => (
                  <Typography key={name + index} className={`mt-2 text-sm ${theme.muted}`}>{name} ({index === 0 ? 'Full day' : 'Peak support'})</Typography>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={theme.panel}>
          <SectionHeader title="Inventory Assets Live" subtitle="Real-time stock position and predictive inventory signals." chip="Live sync active" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Stock Asset Value" value={formatCurrency(inventoryAssetValue)} hint="Live stock value at selling price" />
            <MetricCard label="Units On Hand" value={inventoryUnits} hint="Current stock across all items" />
            <MetricCard label="Total Received" value={totalReceivedUnits} hint="Cumulative recorded receipts" />
            <MetricCard label="Inventory Health" value={formatPercent(inventoryHealth)} hint={`${availableMenuCount} of ${menu.length} items available`} />
          </div>
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-5">
            <div className="xl:col-span-3 space-y-4">
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-sm font-bold">Out of stock in next 2 hours</Typography>
                <div className="mt-4 space-y-3">
                  {outOfStockSoon.length ? outOfStockSoon.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-rose-50 p-4 text-rose-900">
                      <Typography className="font-semibold">{item.name}</Typography>
                      <Typography className="mt-1 text-sm">{item.stock} left • depletion in {item.hoursLeft.toFixed(1)}h</Typography>
                    </div>
                  )) : <Typography className={theme.muted}>No items are projected to run out in the next 2 hours.</Typography>}
                </div>
              </div>
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-sm font-bold">Consumption Trend</Typography>
                <div className="mt-5 grid grid-cols-7 gap-3">
                  {consumptionTrend.map((day) => (
                    <div key={day.key} className="text-center">
                      <div className={`mx-auto flex h-36 w-full items-end rounded-2xl p-2 ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
                        <div
                          className="w-full rounded-xl bg-gradient-to-t from-cyan-500 to-emerald-400"
                          style={{ height: `${getPercent(day.total, Math.max(...consumptionTrend.map((item) => item.total), 1))}%` }}
                        />
                      </div>
                      <Typography className="mt-2 text-xs font-semibold">{day.label}</Typography>
                      <Typography className={`text-xs ${theme.muted}`}>{day.total}</Typography>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="xl:col-span-2 space-y-4">
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-sm font-bold">Fast-moving items</Typography>
                <div className="mt-4 space-y-3">
                  {fastMovingItems.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-white/80 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <Typography className="font-semibold text-slate-900">{item.name}</Typography>
                        <Typography className="font-bold text-slate-900">{item.soldToday}</Typography>
                      </div>
                      <Typography className="mt-1 text-sm text-slate-500">{item.category} • pace {item.pace.toFixed(2)}/hr</Typography>
                    </div>
                  ))}
                </div>
              </div>
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-sm font-bold">Dead stock</Typography>
                <div className="mt-4 space-y-3">
                  {deadStockItems.length ? deadStockItems.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-amber-50 p-4 text-amber-900">
                      <Typography className="font-semibold">{item.name}</Typography>
                      <Typography className="mt-1 text-sm">{item.category} • {item.stock_quantity || 0} left • no sale in 3 days</Typography>
                    </div>
                  )) : <Typography className={theme.muted}>No dead stock flags right now.</Typography>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Supplier & Purchase Management" subtitle="Vendor due view linked to current stock risk." chip="Inventory supply" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {supplierOverview.map((supplier) => (
                <div key={supplier.name} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="font-bold">{supplier.name}</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{supplier.status}</Typography>
                  <Typography className="mt-3 text-2xl font-black">{supplier.amount ? formatCurrency(supplier.amount) : 'Paid'}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Auto-Actions" subtitle="Owner automation rules currently active." chip="Smart rules" />
            <div className="mt-5 space-y-3">
              {autoActions.map((rule) => (
                <div key={rule.label} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-semibold">{rule.label}</Typography>
                    <Chip label={rule.active ? 'Active' : 'Paused'} size="small" color={rule.active ? 'success' : 'default'} />
                  </div>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{rule.detail}</Typography>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Staff Performance Deep Analytics" subtitle="Waiter throughput, handling time, upselling, and chef prep rhythm." />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {waiterPerformance.slice(0, 6).map((person) => (
                <div key={person.name} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-bold">{person.name}</Typography>
                    <Typography className="font-black">{formatCurrency(person.revenue)}</Typography>
                  </div>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>{person.orders} orders • {person.ordersPerHour.toFixed(2)}/hr</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>Avg handling {person.avgHandling.toFixed(1)} min • Upsell {formatPercent(person.upsellRate)}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Kitchen & Service" subtitle="Operational timing intelligence." />
            <div className="mt-5 space-y-4">
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Chef preparation time</Typography>
                <Typography className="mt-2 text-2xl font-black">{chefPreparationTime.toFixed(1)} min</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Upselling success rate</Typography>
                <Typography className="mt-2 text-2xl font-black">{formatPercent(addOnConversionRate)}</Typography>
              </div>
              <div className={`rounded-2xl p-4 ${theme.subtle}`}>
                <Typography className="text-sm font-semibold">Active kitchen load</Typography>
                <Typography className="mt-2 text-2xl font-black">{activeOrders.length}</Typography>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Bill & Audit Intelligence" subtitle="Cancelled bills, edited bills, and suspicious bill behavior." />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-xs uppercase tracking-[0.26em] opacity-70">Cancelled Bills</Typography>
                <Typography className="mt-3 text-3xl font-black">{cancelledOrders.length}</Typography>
              </div>
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-xs uppercase tracking-[0.26em] opacity-70">Edited Bills</Typography>
                <Typography className="mt-3 text-3xl font-black">{editedBills.length}</Typography>
              </div>
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="text-xs uppercase tracking-[0.26em] opacity-70">Fraud Signals</Typography>
                <Typography className="mt-3 text-3xl font-black">{suspiciousBills.length}</Typography>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {suspiciousBills.map((order) => (
                <div key={order.id} className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-rose-900">
                  <Typography className="font-bold">Order #{formatOrderSerial(order)}</Typography>
                  <Typography className="mt-2 text-sm">Discount {formatCurrency(order.discount_amount)} • Refund {formatCurrency(order.refund_amount)}</Typography>
                  <Typography className="mt-1 text-sm">{order.edited_after_place ? 'Item edited after placement' : 'Financial anomaly detected'}</Typography>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Print Audit" subtitle="Bill print history and recent billing actions." />
            <div className="mt-5 space-y-3">
              {printedBillOrders.length ? printedBillOrders.map((order) => (
                <div key={order.id} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <Typography className="font-semibold">Order #{formatOrderSerial(order)}</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>Customer {order.customer_bill_print_count || 0} • Kitchen {order.kitchen_bill_print_count || 0}</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>Last print {formatTimestamp(order.last_customer_bill_printed_at || order.last_kitchen_bill_printed_at)}</Typography>
                </div>
              )) : <Typography className={theme.muted}>Printed bill history will appear here.</Typography>}
            </div>
          </div>
        </div>

        <div id="owner-master-menu-controls" className={theme.panel}>
          <SectionHeader title="Master Menu Control" subtitle="Add menu items, restock, disable items, and manage menu operations like the manager side." chip="Working controls" />
          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <form onSubmit={handleAddMenuItem} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="font-bold">Add menu item</Typography>
              <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Name" value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} required />
              <div>
                <input
                  list="owner-menu-categories"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  placeholder="Choose or type new category"
                  value={newItem.category}
                  onChange={(event) => setNewItem({ ...newItem, category: event.target.value })}
                  required
                />
                <datalist id="owner-menu-categories">
                  {menuCategoryOptions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </div>
              <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Price" type="number" step="0.01" value={newItem.price} onChange={(event) => setNewItem({ ...newItem, price: event.target.value })} required />
              <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={newItem.item_type} onChange={(event) => setNewItem({ ...newItem, item_type: event.target.value })}>
                {MENU_ITEM_TYPES.map((itemType) => (
                  <option key={itemType} value={itemType}>{itemType}</option>
                ))}
              </select>
              <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Initial stock" type="number" min="0" value={newItem.stock_quantity} onChange={(event) => setNewItem({ ...newItem, stock_quantity: event.target.value })} required />
              <div>
                <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" type="file" accept="image/*" onChange={handleNewItemImageChange} />
                <Typography className={`mt-2 text-xs ${theme.muted}`}>Optional. JPG, PNG, or WEBP up to 2 MB.</Typography>
              </div>
              {newItem.image_url ? (
                <img src={newItem.image_url} alt="New menu preview" className="h-28 w-full rounded-2xl border border-slate-200 object-cover" />
              ) : (
                <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Image Preview
                </div>
              )}
              <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Add menu item</button>
            </form>

            <form onSubmit={handleRestock} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="font-bold">Restock item</Typography>
              <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={restockItemId} onChange={(event) => setRestockItemId(event.target.value)} required>
                <option value="">Select item</option>
                {menu.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Restock quantity" type="number" min="1" value={restockQuantity} onChange={(event) => setRestockQuantity(event.target.value)} required />
              <button type="submit" className="w-full rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Restock</button>
              <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={disableItemId} onChange={(event) => setDisableItemId(event.target.value)}>
                <option value="">Disable item</option>
                {menu.filter((item) => item.available !== false).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <button type="button" onClick={handleDisableItem} className="w-full rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white">Disable item</button>
            </form>

            <div className="space-y-6">
              <form onSubmit={handleUpdateMenuImage} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Edit product image</Typography>
                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={editImageItemId} onChange={(event) => {
                  const nextId = event.target.value;
                  setEditImageItemId(nextId);
                  const selectedItem = menu.find((item) => String(item.id) === nextId);
                  setEditImagePreview(selectedItem?.image_url || '');
                }} required>
                  <option value="">Select item</option>
                  {menu.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" type="file" accept="image/*" onChange={handleExistingItemImageChange} />
                {editImagePreview ? (
                  <img src={editImagePreview} alt="Existing menu preview" className="h-28 w-full rounded-2xl border border-slate-200 object-cover" />
                ) : (
                  <div className="flex h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    No Image Selected
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Save image</button>
                  <button type="button" onClick={() => setEditImagePreview('')} className="flex-1 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-600">Remove image</button>
                </div>
              </form>

              <form id="owner-finance-controls" onSubmit={handleFinancialUpdate} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Apply discount / refund</Typography>
                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={financialOrderId} onChange={(event) => setFinancialOrderId(event.target.value)} required>
                  <option value="">Select order</option>
                  {filteredOrders.map((order) => <option key={order.id} value={order.id}>#{formatOrderSerial(order)} - {formatOrderLocation(order)}</option>)}
                </select>
                <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Discount amount" type="number" step="0.01" min="0" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
                <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Refund amount" type="number" step="0.01" min="0" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
                <button type="submit" className="w-full rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white">Update finance</button>
              </form>

              <form onSubmit={handleAssignStaff} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Assign staff</Typography>
                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={assignOrderId} onChange={(event) => setAssignOrderId(event.target.value)} required>
                  <option value="">Select order</option>
                  {activeOrders.map((order) => <option key={order.id} value={order.id}>#{formatOrderSerial(order)} - {formatOrderLocation(order)}</option>)}
                </select>
                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={assignWaiterId} onChange={(event) => setAssignWaiterId(event.target.value)}>
                  <option value="">Select waiter</option>
                  {waiters.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                <button type="submit" className="w-full rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">Assign staff</button>
              </form>

              <form onSubmit={handleCancelOrder} className={`space-y-3 rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Cancel bill</Typography>
                <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={cancelOrderId} onChange={(event) => setCancelOrderId(event.target.value)} required>
                  <option value="">Select active order</option>
                  {activeOrders.map((order) => <option key={order.id} value={order.id}>#{formatOrderSerial(order)} - {formatOrderLocation(order)}</option>)}
                </select>
                <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" placeholder="Cancellation reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} />
                <button type="submit" className="w-full rounded-2xl bg-rose-700 px-4 py-3 text-sm font-bold text-white">Cancel order</button>
              </form>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Security & Control Panel" subtitle="Login activity, permissions, backup automation, and suspicious activity." />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <button type="button" onClick={() => runSmartAction('logout')} className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-left shadow-sm">
                <Typography className="font-bold">Force logout all users</Typography>
                <Typography className="mt-2 text-sm text-slate-500">Use when you need a full session reset across dashboards.</Typography>
              </button>
              <button type="button" onClick={() => runSmartAction('block')} className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-left shadow-sm">
                <Typography className="font-bold">Block suspicious user</Typography>
                <Typography className="mt-2 text-sm text-slate-500">Prepare an owner security response for abnormal access.</Typography>
              </button>
              <button type="button" onClick={() => runSmartAction('device')} className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-left shadow-sm">
                <Typography className="font-bold">Restrict device login</Typography>
                <Typography className="mt-2 text-sm text-slate-500">Tighten device access when the floor uses shared hardware.</Typography>
              </button>
            </div>
            <div className="mt-6 grid gap-6 xl:grid-cols-2">
              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Role-based permissions</Typography>
                <div className="mt-4 space-y-3">
                  {Object.keys(permissionDraft).length ? Object.entries(permissionDraft).map(([role, value]) => (
                    <div key={role}>
                      <Typography className="mb-1 text-sm font-semibold uppercase">{role}</Typography>
                      <input
                        className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900"
                        value={value}
                        onChange={(event) => setPermissionDraft((prev) => ({ ...prev, [role]: event.target.value }))}
                      />
                    </div>
                  )) : <Typography className={theme.muted}>Permissions will appear after control data loads.</Typography>}
                </div>
              </div>

              <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                <Typography className="font-bold">Backup schedule</Typography>
                <div className="mt-4 space-y-3">
                  <label className="flex items-center gap-3 text-sm font-semibold">
                    <input type="checkbox" checked={backupForm.enabled} onChange={(event) => setBackupForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
                    Enable automatic backups
                  </label>
                  <select className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" value={backupForm.frequency} onChange={(event) => setBackupForm((prev) => ({ ...prev, frequency: event.target.value }))}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="hourly">Hourly</option>
                  </select>
                  <input className="w-full rounded-2xl border border-slate-300 bg-white px-3 py-2 text-slate-900" type="time" value={backupForm.time} onChange={(event) => setBackupForm((prev) => ({ ...prev, time: event.target.value }))} />
                  <button type="button" onClick={saveOwnerControl} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white">Save control settings</button>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {ownerControl.suspiciousActivity.length ? ownerControl.suspiciousActivity.map((entry) => (
                <div key={entry.label} className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                  <Typography className="font-bold">{entry.label}</Typography>
                  <Typography className="mt-2 text-sm">{entry.detail}</Typography>
                </div>
              )) : (
                <div className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="font-bold">Suspicious activity detection</Typography>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>No suspicious login patterns are currently flagged.</Typography>
                </div>
              )}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Login Activity Logs" subtitle="Recent authentication events across the system." chip={`${ownerControl.authActivity.length} events`} />
            <div className="mt-5 space-y-3">
              {ownerControl.authActivity.length ? ownerControl.authActivity.map((entry) => (
                <div key={entry.id} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-semibold">{entry.user_name || entry.email || 'Unknown user'}</Typography>
                    <Chip label={entry.outcome} size="small" color={entry.outcome === 'success' ? 'success' : 'error'} />
                  </div>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>{entry.event_type} • {entry.role || 'unknown role'}</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>{formatTimestamp(entry.timestamp)}</Typography>
                </div>
              )) : <Typography className={theme.muted}>No login activity recorded yet.</Typography>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="GST & Tax Module" subtitle="Estimated GST view for business-level reporting." chip="India-ready" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <MetricCard label="Tax Collected" value={formatCurrency(estimatedTaxCollected)} hint="Estimated 5% output tax on current revenue" />
              <MetricCard label="Tax Payable" value={formatCurrency(estimatedTaxPayable)} hint="Estimated payable after cost-side offset" />
              <MetricCard label="Tax Base" value={formatCurrency(revenue)} hint="Current taxable sales base" />
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Multi-Restaurant Support" subtitle="Current branch visibility for SaaS expansion." chip="Scale ready" />
            <div className="mt-5 space-y-3">
              {branchSummary.map((branch) => (
                <div key={branch.name} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-semibold">{branch.name}</Typography>
                    <Chip label={branch.status} size="small" color={branch.revenue ? 'success' : 'default'} />
                  </div>
                  <Typography className={`mt-2 text-sm ${theme.muted}`}>Revenue {formatCurrency(branch.revenue)}</Typography>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className={`${theme.panel} xl:col-span-2`}>
            <SectionHeader title="Recent Orders" subtitle="Live order tape for the selected reporting window." />
            <div className="mt-6 space-y-4">
              {recentOrders.map((order) => (
                <div key={order.id} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <Typography className="font-bold">Order #{formatOrderSerial(order)} • {formatOrderLocation(order)}</Typography>
                      <Typography className={`mt-1 text-sm ${theme.muted}`}>{order.waiter?.name ? `${order.waiter.name} • ` : ''}{formatTimestamp(order.created_at)}</Typography>
                    </div>
                    <div className="text-left md:text-right">
                      <Chip label={order.status} size="small" />
                      <Typography className="mt-2 font-black">{formatCurrency(getOrderTotal(order))}</Typography>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(order.items || []).map((item) => (
                      <Chip key={`${order.id}-${item.id}`} variant="outlined" size="small" label={`${item.quantity}x ${item.menu_item?.name || 'Item'}`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={theme.panel}>
            <SectionHeader title="Users" subtitle="Role distribution and active system users." chip={`${teamMembers.length} users`} />
            <div className="mt-5 space-y-3">
              {roleSummary.map((item) => (
                <div key={item.role} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <div className="flex items-center justify-between gap-3">
                    <Typography className="font-semibold uppercase">{item.role}</Typography>
                    <Typography className="font-black">{item.count}</Typography>
                  </div>
                </div>
              ))}
              {teamMembers.slice(0, 6).map((user) => (
                <div key={user.id} className={`rounded-2xl p-4 ${theme.subtle}`}>
                  <Typography className="font-semibold">{user.name}</Typography>
                  <Typography className={`mt-1 text-sm ${theme.muted}`}>{user.email}</Typography>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className={theme.panel}>
          <SectionHeader title="Live Sales Graph" subtitle={`Sales momentum for the current ${range} window.`} />
          <div className={`mt-6 grid gap-4 ${range === 'month' ? 'grid-cols-3 md:grid-cols-5 xl:grid-cols-10' : 'grid-cols-2 md:grid-cols-4 xl:grid-cols-7'}`}>
            {salesGraphBuckets.map((bucket) => (
              <div key={bucket.key} className={`rounded-3xl p-4 ${theme.subtle}`}>
                <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">{bucket.label}</Typography>
                <div className={`mt-4 flex h-24 items-end rounded-2xl p-2 ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>
                  <div
                    className="w-full rounded-xl bg-gradient-to-t from-fuchsia-500 via-violet-500 to-indigo-500"
                    style={{ height: `${getPercent(bucket.total, Math.max(...salesGraphBuckets.map((item) => item.total), 1))}%` }}
                  />
                </div>
                <Typography className="mt-3 text-sm font-semibold">{formatCurrency(bucket.total)}</Typography>
              </div>
            ))}
          </div>
        </div>

        <div id="owner-reports" className={theme.panel}>
          <SectionHeader title="Reports" subtitle="Owner-ready exports for finance, payments, operations, and audit review." chip="Export center" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Finance Report</Typography>
              <Typography className="mt-3 text-2xl font-black">{formatCurrency(netProfit)}</Typography>
              <Typography className={`mt-2 text-sm ${theme.muted}`}>
                Revenue, profit, discounts, refunds, and average ticket for the current {range} window.
              </Typography>
              <button type="button" onClick={exportExcelLikeCsv} className="mt-5 rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-bold text-white">
                Download CSV
              </button>
            </div>

            <div className={`rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Billing Audit</Typography>
              <Typography className="mt-3 text-2xl font-black">{printedBillOrders.length}</Typography>
              <Typography className={`mt-2 text-sm ${theme.muted}`}>
                Printed bills, edited bills, suspicious billing activity, and payment method breakdown.
              </Typography>
              <button
                type="button"
                onClick={() => downloadTextFile(JSON.stringify({
                  printedBillOrders,
                  editedBills,
                  suspiciousBills,
                  paymentSplit
                }, null, 2), `owner_billing_audit_${range}_${Date.now()}.json`, 'application/json')}
                className="mt-5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white"
              >
                Download JSON
              </button>
            </div>

            <div className={`rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Inventory Report</Typography>
              <Typography className="mt-3 text-2xl font-black">{inventoryUnits}</Typography>
              <Typography className={`mt-2 text-sm ${theme.muted}`}>
                Live stock units, low-stock risk, fast movers, and near-out-of-stock forecast.
              </Typography>
              <button
                type="button"
                onClick={() => downloadTextFile(JSON.stringify({
                  inventoryUnits,
                  inventoryAssetValue,
                  inventoryHealth,
                  lowStockItems,
                  fastMovingItems,
                  outOfStockSoon,
                  deadStockItems
                }, null, 2), `owner_inventory_report_${range}_${Date.now()}.json`, 'application/json')}
                className="mt-5 rounded-2xl bg-amber-600 px-4 py-3 text-sm font-bold text-white"
              >
                Download JSON
              </button>
            </div>

            <div className={`rounded-3xl p-5 ${theme.subtle}`}>
              <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Team Report</Typography>
              <Typography className="mt-3 text-2xl font-black">{waiterPerformance.length}</Typography>
              <Typography className={`mt-2 text-sm ${theme.muted}`}>
                Waiter performance, upsell rate, handling speed, and staffing forecast for tomorrow.
              </Typography>
              <button
                type="button"
                onClick={() => downloadTextFile(JSON.stringify({
                  waiterPerformance,
                  forecast,
                  chefPreparationTime,
                  roleSummary
                }, null, 2), `owner_team_report_${range}_${Date.now()}.json`, 'application/json')}
                className="mt-5 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white"
              >
                Download JSON
              </button>
            </div>
          </div>
        </div>

        <div className={theme.panel}>
          <SectionHeader title="Table QR Codes" subtitle="Generate QR codes for hybrid table ordering and print them for dine-in tables." chip="QR ordering" />
          <div className="mt-6 flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
              <label className="block">
                <Typography className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Public Order URL</Typography>
                <input
                  type="url"
                  value={publicOrderAppUrl}
                  onChange={(event) => setPublicOrderAppUrl(event.target.value)}
                  placeholder="https://yourdomain.com"
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
                />
              </label>
              <button type="button" onClick={loadQrTables} disabled={loadingQrTables} className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-300">
                {loadingQrTables ? 'Generating QR...' : 'Generate Table QR'}
              </button>
            </div>
            <Typography className={`text-sm ${theme.muted}`}>Restaurant code: {PUBLIC_RESTAURANT_CODE}</Typography>
            <Typography className={`text-sm ${theme.muted}`}>
              Use the full customer app address here. For phone scans, do not use `localhost`; use your domain or your computer&apos;s LAN IP instead.
            </Typography>
            {qrAppUsesLocalhost ? (
              <Typography className="text-sm font-semibold text-amber-600">
                Current QR base URL is local-only. Replace it before printing or scanning from another phone.
              </Typography>
            ) : null}
          </div>

          {qrTables.length ? (
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {qrTables.map((table) => (
                <div key={table.table_number} className={`rounded-3xl p-5 ${theme.subtle}`}>
                  <Typography className="text-xs uppercase tracking-[0.24em] opacity-70">Table {table.table_number}</Typography>
                  <img src={table.qr_image} alt={`QR for Table ${table.table_number}`} className="mt-4 w-full rounded-2xl border border-slate-200 bg-white p-3" />
                  <Typography className={`mt-3 break-all text-xs ${theme.muted}`}>{table.qr_url}</Typography>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <a href={table.qr_url} target="_blank" rel="noopener noreferrer" className="inline-flex rounded-2xl bg-slate-900 px-4 py-2 text-sm font-bold text-white">
                      Open Link
                    </a>
                    <a href={table.qr_image} download={`table_${table.table_number}_qr.png`} className="inline-flex rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white">
                      Download QR
                    </a>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;
