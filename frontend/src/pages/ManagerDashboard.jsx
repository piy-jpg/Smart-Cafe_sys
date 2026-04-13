import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CircularProgress, Chip, Typography } from '@mui/material';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';
import { getMenuCategoryOptions } from '../lib/menuCategories';
import { readImageFileAsDataUrl } from '../lib/menuImageUpload';
import { MENU_ITEM_TYPES, normalizeMenuItemType } from '../lib/menuItemTypes';
import Sidebar from '../components/Sidebar';
const MANAGER_WHATSAPP_NO = '7300212948';
const FEED_LIMIT = 10;
const LIVE_REFRESH_MS = 5000;

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || 0) * item.quantity)
  ), 0)
);

const getMenuEmoji = (item) => {
  const name = String(item?.menu_item?.name || item?.name || '').toLowerCase();
  const category = String(item?.menu_item?.category || item?.category || '').toLowerCase();
  const text = `${name} ${category}`;

  if (text.includes('espresso')) return '☕';
  if (text.includes('coffee') || text.includes('latte') || text.includes('cappuccino') || text.includes('mocha')) return '☕';
  if (text.includes('tea') || text.includes('chai') || text.includes('matcha')) return '🍵';
  if (text.includes('croissant') || text.includes('muffin') || text.includes('bagel') || text.includes('bakery')) return '🥐';
  if (text.includes('cake') || text.includes('brownie') || text.includes('cheesecake') || text.includes('tiramisu') || text.includes('dessert')) return '🍰';
  if (text.includes('sandwich') || text.includes('wrap') || text.includes('burger') || text.includes('lunch')) return '🥪';
  if (text.includes('breakfast') || text.includes('pancake') || text.includes('omelette') || text.includes('toast')) return '🍳';
  if (text.includes('smoothie') || text.includes('juice') || text.includes('refresher') || text.includes('milkshake')) return '🥤';
  if (text.includes('salad')) return '🥗';
  return '🍽️';
};

const buildBillLines = (order) => (
  (order.items || []).map((item) => {
    const unitPrice = parseFloat(item.menu_item?.price || 0);
    const lineTotal = unitPrice * item.quantity;
    return `${getMenuEmoji(item)} ${item.quantity}x ${item.menu_item?.name || 'Item'} - $${lineTotal.toFixed(2)}`;
  })
);

const sanitizePhoneForWhatsApp = (phone) => phone.replace(/[^\d]/g, '');
const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
const formatBillTimestamp = (value) => {
  if (!value) return 'Not printed yet';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not printed yet';

  return date.toLocaleString();
};

const formatPaymentMethodLabel = (value) => {
  if (value === 'upi_qr') return 'UPI QR';
  if (value === 'card') return 'Card';
  if (value === 'cash') return 'Cash';
  if (value === 'coupon') return 'Coupon';
  if (value === 'coupons') return 'Coupons';
  return value ? String(value).toUpperCase() : 'Cash';
};

const TOTAL_DINE_IN_TABLES = 30;

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

const mergeOrderById = (orders, incomingOrder) => {
  const existing = orders.some((order) => order.id === incomingOrder.id);
  if (!existing) {
    return [incomingOrder, ...orders];
  }

  return orders.map((order) => (order.id === incomingOrder.id ? incomingOrder : order));
};

const createFeedEntry = (message, tone = 'info') => ({
  id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  message,
  tone,
  timestamp: new Date().toISOString()
});

const isTableStillOccupied = (order) => (
  Boolean(order) && !['completed', 'cancelled'].includes(order.status) && !(order.status === 'waiting_bill' && order.table_cleared)
);

const ManagerDashboard = () => {
  const currentUser = getStoredUser();
  const [menu, setMenu] = useState([]);
  const [orders, setOrders] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [feed, setFeed] = useState([
    createFeedEntry('System booted onto Port 6003', 'info'),
    createFeedEntry('Operations command center online.', 'success')
  ]);
  const [isAddMode, setIsAddMode] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', category: 'Hot Coffee', price: '', stock_quantity: '', image_url: '', item_type: 'Veg' });
  const [editItemId, setEditItemId] = useState(null);
  const [editItemData, setEditItemData] = useState({ name: '', category: '', price: '', image_url: '', item_type: 'Veg' });
  const [menuViewMode, setMenuViewMode] = useState('all');
  const [billingOrderId, setBillingOrderId] = useState('');
  const [billingCustomerName, setBillingCustomerName] = useState('');
  const [billingCustomerPhone, setBillingCustomerPhone] = useState('');
  const [billingSearch, setBillingSearch] = useState('');
  const [appliedBillingSearch, setAppliedBillingSearch] = useState('');
  const [billingPaymentMethod, setBillingPaymentMethod] = useState('cash');
  const [billingPaymentReceived, setBillingPaymentReceived] = useState(false);
  const [billPreviewMode, setBillPreviewMode] = useState('customer');
  const [billingNotice, setBillingNotice] = useState('');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [paymentNotice, setPaymentNotice] = useState('');
  const [reportNotice, setReportNotice] = useState('');
  const [databaseStatus, setDatabaseStatus] = useState({
    engine: 'SQLite',
    file_name: 'smart_cafe.sqlite',
    exists: true,
    size_bytes: 0,
    updated_at: null
  });
  const [downloadingBackup, setDownloadingBackup] = useState(false);

  const pushFeedEntry = (message, tone = 'info') => {
    setFeed((prev) => [createFeedEntry(message, tone), ...prev].slice(0, FEED_LIMIT));
  };

  const fetchMenu = useCallback(async () => {
    const response = await axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`);
    setMenu(response.data.menu || []);
    return response.data.menu || [];
  }, []);

  const fetchOrders = useCallback(async () => {
    const response = await axios.get(`${API_BASE_URL}/api/orders`);
    setOrders(response.data.orders || []);
    return response.data.orders || [];
  }, []);

  const fetchAnalytics = useCallback(async () => {
    const response = await axios.get(`${API_BASE_URL}/api/orders/analytics`);
    setAnalytics(response.data.data || null);
    return response.data.data || null;
  }, []);

  const fetchDatabaseStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/system/database/status`);
      setDatabaseStatus((prev) => ({ ...prev, ...(response.data.data || {}) }));
      return response.data.data || null;
    } catch (error) {
      console.error(error);
      setDatabaseStatus((prev) => ({ ...prev, exists: true }));
      return null;
    }
  }, []);

  const fetchData = useCallback(async ({ withLoading = false } = {}) => {
    try {
      if (withLoading) {
        setLoading(true);
      }

      await Promise.all([
        fetchMenu(),
        fetchOrders(),
        fetchAnalytics(),
        fetchDatabaseStatus()
      ]);
    } catch (error) {
      console.error(error);
    } finally {
      if (withLoading) {
        setLoading(false);
      }
    }
  }, [fetchAnalytics, fetchDatabaseStatus, fetchMenu, fetchOrders]);

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
      setReportNotice('Database backup download started.');
    } catch (error) {
      console.error(error);
      setBillingNotice('Failed to download database backup.');
    } finally {
      window.setTimeout(() => setDownloadingBackup(false), 800);
    }
  };

  const handleDownloadSqlExport = async () => {
    try {
      setDownloadingBackup(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/export-sql`;
      link.setAttribute('download', 'smart_cafe_export.sql');
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setReportNotice('SQL export download started.');
    } catch (error) {
      console.error(error);
      setReportNotice('Failed to download SQL export.');
    } finally {
      window.setTimeout(() => setDownloadingBackup(false), 800);
    }
  };

  const handleDownloadReport = (type) => {
    try {
      if (type === 'orders') {
        downloadCsvFile(ordersReportRows, `orders_report_${Date.now()}.csv`);
      } else if (type === 'menu') {
        downloadCsvFile(menuReportRows, `menu_stock_report_${Date.now()}.csv`);
      } else if (type === 'waiters') {
        downloadCsvFile(waiterReportRows, `waiter_performance_report_${Date.now()}.csv`);
      } else if (type === 'bills') {
        downloadCsvFile(billAuditRows, `billing_audit_report_${Date.now()}.csv`);
      } else if (type === 'analytics') {
        downloadTextFile(JSON.stringify(analyticsReportObject, null, 2), `analytics_report_${Date.now()}.json`, 'application/json');
      }
      setReportNotice('Report downloaded successfully.');
    } catch (error) {
      console.error(error);
      setReportNotice('Failed to download report.');
    }
  };

  useEffect(() => {
    fetchData({ withLoading: true });

    const handleNewOrder = (order) => {
      pushFeedEntry(`New order #${formatOrderSerial(order)} opened for ${formatOrderLocation(order)}.`, 'alert');
      setOrders((prev) => mergeOrderById(prev, order));
      fetchMenu().catch(console.error);
      fetchAnalytics().catch(console.error);
    };

    const handleOrderStatusUpdated = (order) => {
      pushFeedEntry(`Order #${formatOrderSerial(order)} moved to ${order.status}.`, order.status === 'ready' ? 'success' : 'info');
      setOrders((prev) => mergeOrderById(prev, order));
      fetchMenu().catch(console.error);
      fetchAnalytics().catch(console.error);
    };

    const handleOrderUpdated = (order) => {
      pushFeedEntry(`Order #${formatOrderSerial(order)} received another add-on batch.`, 'info');
      setOrders((prev) => mergeOrderById(prev, order));
      fetchMenu().catch(console.error);
      fetchAnalytics().catch(console.error);
    };

    const handleOrderCustomerUpdated = (order) => {
      pushFeedEntry(`Customer details updated for order #${formatOrderSerial(order)}.`, 'info');
      setOrders((prev) => mergeOrderById(prev, order));
      fetchAnalytics().catch(console.error);
      fetchDatabaseStatus().catch(console.error);
    };

    const handleMenuUpdated = () => {
      pushFeedEntry('Menu catalog changed.', 'info');
      fetchMenu().catch(console.error);
      fetchAnalytics().catch(console.error);
    };

    const handleSystemControlUpdated = () => {
      pushFeedEntry('System controls refreshed.', 'info');
      fetchData().catch(console.error);
    };
    const handleReconnect = () => {
      pushFeedEntry('Realtime connection restored.', 'success');
      fetchData().catch?.(console.error);
    };
    const handleDisconnect = () => {
      pushFeedEntry('Realtime connection lost. Reconnecting now...', 'warning');
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderStatusUpdated);
    socket.on('orderUpdated', handleOrderUpdated);
    socket.on('orderCustomerUpdated', handleOrderCustomerUpdated);
    socket.on('menuUpdated', handleMenuUpdated);
    socket.on('systemControlUpdated', handleSystemControlUpdated);
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderStatusUpdated);
      socket.off('orderUpdated', handleOrderUpdated);
      socket.off('orderCustomerUpdated', handleOrderCustomerUpdated);
      socket.off('menuUpdated', handleMenuUpdated);
      socket.off('systemControlUpdated', handleSystemControlUpdated);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchAnalytics, fetchData, fetchDatabaseStatus, fetchMenu]);

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      fetchData();
    }, LIVE_REFRESH_MS);

    const refreshManagerData = () => {
      fetchData();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshManagerData();
      }
    };

    window.addEventListener('focus', refreshManagerData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', refreshManagerData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData]);

  const visibleMenu = useMemo(() => (
    menu.filter((item) => item.available !== false)
  ), [menu]);
  const menuCategoryOptions = useMemo(() => getMenuCategoryOptions(menu), [menu]);
  const categories = ['All', ...new Set(visibleMenu.map((item) => item.category))];
  const filteredMenu = visibleMenu
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((left, right) => {
      if (menuViewMode === 'low_stock') return left.stock_quantity - right.stock_quantity;
      if (menuViewMode === 'top_selling') {
        const topSellingMap = new Map((analytics?.topSellingItems || []).map((item) => [item.name, item.quantity]));
        return (topSellingMap.get(right.name) || 0) - (topSellingMap.get(left.name) || 0);
      }
      return left.name.localeCompare(right.name);
    });

  const activeOrders = useMemo(() => orders.filter((order) => isTableStillOccupied(order)), [orders]);
  const servedOrders = useMemo(() => orders.filter((order) => ['waiting_bill', 'completed'].includes(order.status)), [orders]);
  const billableOrders = useMemo(
    () => orders.filter((order) => order.status !== 'cancelled' && Array.isArray(order.items) && order.items.length > 0),
    [orders]
  );
  const occupiedTableNumbers = useMemo(() => (
    [...new Set(
      activeOrders
        .filter((order) => order.table_label !== 'Packing')
        .map((order) => Number(order.table_number))
        .filter((tableNumber) => Number.isInteger(tableNumber) && tableNumber > 0)
    )].sort((left, right) => left - right)
  ), [activeOrders]);
  const availableTableNumbers = useMemo(() => (
    Array.from({ length: TOTAL_DINE_IN_TABLES }, (_, index) => index + 1)
      .filter((tableNumber) => !occupiedTableNumbers.includes(tableNumber))
  ), [occupiedTableNumbers]);
  const lowStockItems = useMemo(() => (
    [...visibleMenu]
      .filter((item) => Number(item.stock_quantity || 0) <= 5)
      .sort((left, right) => Number(left.stock_quantity || 0) - Number(right.stock_quantity || 0))
  ), [visibleMenu]);
  const unpaidServedOrders = useMemo(() => (
    servedOrders.filter((order) => !order.payment_received || order.payment_status !== 'paid')
  ), [servedOrders]);
  const readyOrders = useMemo(() => activeOrders.filter((order) => order.status === 'ready'), [activeOrders]);
  const preparingOrders = useMemo(() => activeOrders.filter((order) => order.status === 'preparing'), [activeOrders]);
  const pendingOrders = useMemo(() => activeOrders.filter((order) => order.status === 'pending'), [activeOrders]);
  const oldestActiveOrder = useMemo(() => (
    [...activeOrders].sort((left, right) => new Date(left.created_at) - new Date(right.created_at))[0] || null
  ), [activeOrders]);
  const recentlyPrintedOrders = useMemo(() => (
    [...servedOrders]
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
      .slice(0, 5)
  ), [servedOrders]);
  const staffStats = useMemo(() => {
    const map = new Map();

    orders.forEach((order) => {
      const waiterName = order.waiter?.name || 'Unassigned';
      const current = map.get(waiterName) || {
        name: waiterName,
        activeOrders: 0,
        servedOrders: 0,
        addOnsHandled: 0,
        revenue: 0
      };

      if (['served', 'waiting_bill', 'completed'].includes(order.status) && !isTableStillOccupied(order)) current.servedOrders += 1;
      else current.activeOrders += 1;

      current.addOnsHandled += order.add_on_count || 0;
      current.revenue += getOrderTotal(order);
      map.set(waiterName, current);
    });

    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [orders]);
  const ordersReportRows = useMemo(() => orders.map((order) => ({
    serial_no: formatOrderSerial(order),
    location: formatOrderLocation(order),
    status: order.status,
    waiter: order.waiter?.name || 'Unassigned',
    customer_name: order.customer_name || 'Walk-in',
    customer_phone: order.customer_phone || '',
    payment_method: order.payment_method || '',
    payment_received: order.payment_received ? 'Yes' : 'No',
    add_on_count: order.add_on_count || 0,
    customer_bill_prints: order.customer_bill_print_count || 0,
    kitchen_bill_prints: order.kitchen_bill_print_count || 0,
    total_amount: getOrderTotal(order).toFixed(2),
    created_at: new Date(order.created_at).toLocaleString()
  })), [orders]);
  const menuReportRows = useMemo(() => visibleMenu.map((item) => ({
    name: item.name,
    category: item.category,
    price: parseFloat(item.price || 0).toFixed(2),
    available: item.available ? 'Yes' : 'No',
    stock_quantity: item.stock_quantity || 0,
    total_received: item.total_received || 0
  })), [visibleMenu]);
  const waiterReportRows = useMemo(() => staffStats.map((person) => ({
    waiter: person.name,
    active_orders: person.activeOrders,
    served_orders: person.servedOrders,
    add_ons_handled: person.addOnsHandled,
    revenue: person.revenue.toFixed(2)
  })), [staffStats]);
  const billAuditRows = useMemo(() => servedOrders.map((order) => ({
    serial_no: formatOrderSerial(order),
    location: formatOrderLocation(order),
    customer_name: order.customer_name || 'Walk-in',
    payment_received: order.payment_received ? 'Yes' : 'No',
    customer_bill_prints: order.customer_bill_print_count || 0,
    kitchen_bill_prints: order.kitchen_bill_print_count || 0,
    last_customer_bill_printed_at: formatBillTimestamp(order.last_customer_bill_printed_at),
    last_kitchen_bill_printed_at: formatBillTimestamp(order.last_kitchen_bill_printed_at)
  })), [servedOrders]);
  const analyticsReportObject = useMemo(() => ({
    generated_at: new Date().toISOString(),
    total_revenue: analytics?.totalRevenue || 0,
    total_orders: analytics?.totalOrders || 0,
    completed_orders: analytics?.completedOrders || 0,
    active_orders: activeOrders.length,
    available_tables: availableTableNumbers.length,
    ready_orders: readyOrders.length,
    unpaid_delivered_orders: unpaidServedOrders.length,
    low_stock_items: lowStockItems.length,
    top_selling_items: analytics?.topSellingItems || []
  }), [analytics, activeOrders.length, availableTableNumbers.length, readyOrders.length, unpaidServedOrders.length, lowStockItems.length]);
  const selectedBillingOrder = useMemo(
    () => billableOrders.find((order) => String(order.id) === String(billingOrderId)) || null,
    [billableOrders, billingOrderId]
  );
  const filteredPaymentOrders = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();

    return billableOrders.filter((order) => {
      const orderPaymentStatus = String(order.payment_status || (order.payment_received ? 'paid' : 'pending')).toLowerCase();
      const matchesStatus = paymentStatusFilter === 'all' || orderPaymentStatus === paymentStatusFilter;
      if (!matchesStatus) return false;
      if (!query) return true;

      return (
        String(order.serial_no || '').includes(query) ||
        String(order.table_number || '').includes(query) ||
        (order.table_label || '').toLowerCase().includes(query) ||
        (order.customer_name || '').toLowerCase().includes(query) ||
        orderPaymentStatus.includes(query)
      );
    });
  }, [billableOrders, paymentSearch, paymentStatusFilter]);
  const pendingPaymentOrders = useMemo(
    () => unpaidServedOrders.filter((order) => order.status === 'waiting_bill' || order.payment_status === 'pending'),
    [unpaidServedOrders]
  );
  const filteredBillingOrders = useMemo(() => {
    const query = appliedBillingSearch.trim().toLowerCase();
    if (!query) return billableOrders;

    return billableOrders.filter((order) => (
      String(order.serial_no || '').includes(query) ||
      String(order.table_number).includes(query) ||
      (order.table_label || '').toLowerCase().includes(query) ||
      (order.customer_name || '').toLowerCase().includes(query)
    ));
  }, [billableOrders, appliedBillingSearch]);

  useEffect(() => {
    if (!appliedBillingSearch.trim()) return;

    if (filteredBillingOrders.length === 1) {
      setBillingOrderId(String(filteredBillingOrders[0].id));
      setBillingNotice(`1 ordered bill found for "${appliedBillingSearch}".`);
      return;
    }

    if (filteredBillingOrders.length === 0) {
      setBillingOrderId('');
      setBillingNotice(`No ordered bills found for "${appliedBillingSearch}".`);
      return;
    }

    setBillingNotice(`${filteredBillingOrders.length} ordered bills found for "${appliedBillingSearch}".`);
  }, [appliedBillingSearch, filteredBillingOrders]);

  useEffect(() => {
    if (!selectedBillingOrder) return;
    setBillingCustomerName(selectedBillingOrder.customer_name || '');
    setBillingCustomerPhone(selectedBillingOrder.customer_phone || '');
    setBillingPaymentMethod(selectedBillingOrder.payment_method || 'cash');
    setBillingPaymentReceived(Boolean(selectedBillingOrder.payment_received));
  }, [selectedBillingOrder]);

  useEffect(() => {
    setPaymentDrafts((prev) => {
      const next = { ...prev };

      billableOrders.forEach((order) => {
        if (!next[order.id]) {
          next[order.id] = {
            payment_method: order.payment_method || 'cash',
            payment_status: order.payment_status || (order.payment_received ? 'paid' : 'pending')
          };
        }
      });

      return next;
    });
  }, [billableOrders]);

  useEffect(() => {
    if (activeTab !== 'Billing') return;
    if (billingOrderId) return;
    if (!filteredBillingOrders.length) return;

    const firstOrder = filteredBillingOrders[0];
    setBillingOrderId(String(firstOrder.id));
    setBillingNotice(`Loaded order #${formatOrderSerial(firstOrder)} for billing.`);
  }, [activeTab, billingOrderId, filteredBillingOrders]);

  const handleToggleStock = async (item) => {
    try {
      const res = await axios.put(`${API_BASE_URL}/api/menu/${item.id}`, { available: !item.available });
      if (res.data.success) {
        setMenu((prev) => prev.map((menuItem) => menuItem.id === item.id ? { ...menuItem, available: !item.available } : menuItem));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/menu/${id}`);
      setMenu((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddSubmit = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...newItem,
        stock_quantity: Number(newItem.stock_quantity || 0),
        total_received: Number(newItem.stock_quantity || 0)
      };
      const res = await axios.post(`${API_BASE_URL}/api/menu`, payload);
      if (res.data.success) {
        setMenu((prev) => [res.data.item, ...prev]);
        setNewItem({ name: '', category: 'Hot Coffee', price: '', stock_quantity: '', image_url: '', item_type: 'Veg' });
        setIsAddMode(false);
        setReportNotice('Menu item added successfully.');
      }
    } catch (error) {
      console.error(error);
      setReportNotice(error.response?.data?.message || 'Failed to add menu item.');
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
      setReportNotice('');
    } catch (error) {
      console.error(error);
      setNewItem((prev) => ({ ...prev, image_url: '' }));
      setReportNotice(error.message || 'Failed to load image.');
      event.target.value = '';
    }
  };

  const handleEditClick = (item) => {
    setEditItemId(item.id);
    setEditItemData({
      name: item.name,
      category: item.category,
      price: item.price,
      image_url: item.image_url || '',
      item_type: normalizeMenuItemType(item.item_type),
      stock_quantity: item.stock_quantity,
      total_received: item.total_received,
      restock_quantity: ''
    });
  };

  const handleEditSave = async (id) => {
    try {
      const payload = {
        name: editItemData.name,
        category: editItemData.category,
        price: Number(editItemData.price || 0),
        image_url: editItemData.image_url || '',
        item_type: normalizeMenuItemType(editItemData.item_type),
        stock_quantity: Number(editItemData.stock_quantity || 0),
        total_received: Number(editItemData.total_received || 0),
        restock_quantity: Number(editItemData.restock_quantity || 0)
      };

      const res = await axios.put(`${API_BASE_URL}/api/menu/${id}`, payload);
      if (res.data.success) {
        setMenu((prev) => prev.map((item) => (
          item.id === id ? res.data.item : item
        )));
        setEditItemId(null);
        setEditItemData({ name: '', category: '', price: '', image_url: '', item_type: 'Veg' });
        setReportNotice('Menu item updated successfully.');
      }
    } catch (error) {
      console.error(error);
      setReportNotice(error.response?.data?.message || 'Failed to update menu item.');
    }
  };

  const handleEditImageChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const imageUrl = await readImageFileAsDataUrl(file);
      setEditItemData((prev) => ({ ...prev, image_url: imageUrl }));
      setReportNotice('');
    } catch (error) {
      console.error(error);
      setReportNotice(error.message || 'Failed to load image.');
      event.target.value = '';
    }
  };

  const handleExportMenu = () => {
    const rows = visibleMenu.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      stock_quantity: item.stock_quantity,
      total_received: item.total_received,
      available: item.available ? 'Yes' : 'No'
    }));
    downloadCsvFile(rows, 'menu_export.csv');
    setReportNotice('Visible menu exported successfully.');
  };

  const handleDuplicate = async (item) => {
    try {
      const payload = {
        name: `${item.name} (Copy)`,
        category: item.category,
        price: item.price,
        image_url: item.image_url || '',
        item_type: normalizeMenuItemType(item.item_type),
        stock_quantity: 0,
        total_received: 0
      };
      const res = await axios.post(`${API_BASE_URL}/api/menu`, payload);
      if (res.data.success) {
        setMenu((prev) => [res.data.item, ...prev]);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleBillingSearch = () => {
    setAppliedBillingSearch(billingSearch);
    setBillingOrderId('');
    setBillingCustomerName('');
    setBillingCustomerPhone('');
    setBillingPaymentMethod('cash');
    setBillingPaymentReceived(false);
  };

  const handleClearBillingSearch = () => {
    setBillingSearch('');
    setAppliedBillingSearch('');
    setBillingOrderId('');
    setBillingCustomerName('');
    setBillingCustomerPhone('');
    setBillingNotice('');
  };

  const handleSelectBillingOrder = (orderId) => {
    setBillingOrderId(String(orderId));
    setBillPreviewMode('customer');
    setBillingNotice('');
  };

  const getBillingCustomerPayload = (order, overrides = {}) => ({
    customer_name: overrides.customer_name ?? (billingCustomerName.trim() || order.customer_name || ''),
    customer_phone: overrides.customer_phone ?? (billingCustomerPhone.trim() || order.customer_phone || ''),
    payment_method: overrides.payment_method ?? billingPaymentMethod,
    payment_received: overrides.payment_received ?? billingPaymentReceived
  });

  const handleReceivePayment = async (method) => {
    if (!selectedBillingOrder) {
      setBillingNotice('Select a bill request first.');
      return;
    }

    try {
      const customerPayload = getBillingCustomerPayload(selectedBillingOrder, {
        payment_method: method,
        payment_received: true
      });
      const response = await axios.put(`${API_BASE_URL}/api/orders/${selectedBillingOrder.id}/owner-controls`, {
        customer_name: customerPayload.customer_name,
        customer_phone: customerPayload.customer_phone,
        payment_method: method,
        payment_received: true,
        payment_status: 'paid',
        status: 'completed'
      });

      if (response.data.success) {
        const updatedOrder = response.data.order;
        setOrders((prev) => prev.map((order) => order.id === selectedBillingOrder.id ? updatedOrder : order));
        setBillingPaymentMethod(method);
        setBillingPaymentReceived(true);
        setBillingCustomerName(updatedOrder.customer_name || customerPayload.customer_name || '');
        setBillingCustomerPhone(updatedOrder.customer_phone || customerPayload.customer_phone || '');

        const remainingPendingOrders = pendingPaymentOrders.filter((order) => order.id !== selectedBillingOrder.id);
        if (remainingPendingOrders.length > 0) {
          setBillingOrderId(String(remainingPendingOrders[0].id));
          setBillingNotice(`Payment received by ${formatPaymentMethodLabel(method)}. Table ${selectedBillingOrder.table_number} is cleared, and the next pending bill is loaded.`);
        } else {
          setBillingOrderId('');
          setBillingNotice(`Payment received by ${formatPaymentMethodLabel(method)} and Table ${selectedBillingOrder.table_number} is now free.`);
        }
      }
    } catch (error) {
      console.error(error);
      setBillingNotice('Failed to receive payment.');
    }
  };

  const updatePaymentDraft = (orderId, field, value) => {
    setPaymentDrafts((prev) => ({
      ...prev,
      [orderId]: {
        payment_method: prev[orderId]?.payment_method || 'cash',
        payment_status: prev[orderId]?.payment_status || 'pending',
        [field]: value
      }
    }));
  };

  const handleSavePayment = async (order) => {
    const draft = paymentDrafts[order.id] || {
      payment_method: order.payment_method || 'cash',
      payment_status: order.payment_status || (order.payment_received ? 'paid' : 'pending')
    };

    try {
      const isPaid = draft.payment_status === 'paid';
      const response = await axios.put(`${API_BASE_URL}/api/orders/${order.id}/owner-controls`, {
        payment_method: draft.payment_method,
        payment_status: draft.payment_status,
        payment_received: isPaid
      });

      if (response.data.success) {
        setOrders((prev) => prev.map((entry) => (
          entry.id === order.id ? response.data.order : entry
        )));
        setPaymentNotice(`Payment updated for order #${formatOrderSerial(order)}.`);
      }
    } catch (error) {
      console.error(error);
      setPaymentNotice(`Failed to update payment for order #${formatOrderSerial(order)}.`);
    }
  };

  const persistBillingCustomer = async () => {
    if (!selectedBillingOrder) return null;

    const payload = getBillingCustomerPayload(selectedBillingOrder);
    const response = await axios.put(`${API_BASE_URL}/api/orders/${selectedBillingOrder.id}/customer`, payload);

    if (response.data.success) {
      setOrders((prev) => prev.map((order) => order.id === selectedBillingOrder.id ? response.data.order : order));
      setBillingCustomerName(response.data.order.customer_name || payload.customer_name || '');
      setBillingCustomerPhone(response.data.order.customer_phone || payload.customer_phone || '');
      return response.data.order;
    }

    return null;
  };

  const recordBillPrintHistory = async (orderId, billType) => {
    const response = await axios.put(`${API_BASE_URL}/api/orders/${orderId}/bill-print`, {
      bill_type: billType
    });

    if (response.data.success) {
      setOrders((prev) => prev.map((order) => order.id === orderId ? response.data.order : order));
      return response.data.order;
    }

    return null;
  };

  const buildCustomerBillHtml = (order) => {
    const rows = (order.items || []).map((item) => {
      const unitPrice = parseFloat(item.menu_item?.price || 0);
      const lineTotal = unitPrice * item.quantity;
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(`${getMenuEmoji(item)} ${item.menu_item?.name || 'Item'}`)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.quantity)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">$${unitPrice.toFixed(2)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">$${lineTotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    return `
      <html>
        <head><title>Bill Order #${formatOrderSerial(order)}</title></head>
        <body style="font-family:Arial,sans-serif;padding:32px;color:#111827;">
          <h1>SmartCafe Bill</h1>
          <p><strong>Customer:</strong> ${escapeHtml(billingCustomerName || order.customer_name || 'Walk-in')}</p>
          <p><strong>Mobile:</strong> ${escapeHtml(billingCustomerPhone || order.customer_phone || '')}</p>
          <p><strong>Order:</strong> #${escapeHtml(formatOrderSerial(order))}</p>
          <p><strong>Location:</strong> ${escapeHtml(formatOrderLocation(order))}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:24px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Item</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Qty</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Unit</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Amount</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <h2 style="margin-top:24px;">Total: $${getOrderTotal(order).toFixed(2)}</h2>
        </body>
      </html>
    `;
  };

const buildKitchenBillHtml = (order) => {
  const items = order.items || [];
  const latestBatch = items.reduce((maxBatch, item) => Math.max(maxBatch, Number(item.add_on_batch || 0)), 0);
  const rows = items.map((item) => {
      const batchLabel = Number(item.add_on_batch || 0) === latestBatch && latestBatch > 0 ? 'Add-on batch' : 'Main order';
      return `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.menu_item?.name || 'Item')}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(item.quantity)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${escapeHtml(batchLabel)}</td>
      </tr>`;
    }).join('');

    return `
      <html>
        <head><title>Kitchen Bill Order #${formatOrderSerial(order)}</title></head>
        <body style="font-family:Arial,sans-serif;padding:28px;color:#111827;">
          <h1 style="margin:0 0 8px;">SmartCafe Kitchen Bill</h1>
          <p style="margin:0 0 6px;"><strong>Order:</strong> #${escapeHtml(formatOrderSerial(order))}</p>
          <p style="margin:0 0 6px;"><strong>Location:</strong> ${escapeHtml(formatOrderLocation(order))}</p>
          <p style="margin:0 0 6px;"><strong>Customer:</strong> ${escapeHtml(billingCustomerName || order.customer_name || 'Walk-in')}</p>
          <p style="margin:0 0 6px;"><strong>Payment:</strong> ${escapeHtml(formatPaymentMethodLabel(billingPaymentMethod))} / ${escapeHtml(billingPaymentReceived ? 'Received' : 'Pending')}</p>
          <p style="margin:0 0 16px;"><strong>Items:</strong> ${escapeHtml(items.length)}</p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Item</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Qty</th>
                <th style="text-align:left;padding:8px;border-bottom:2px solid #d1d5db;">Prep Type</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top:20px;font-weight:700;">Kitchen copy for preparation, plating, and handoff.</p>
        </body>
      </html>
    `;
  };

  const printHtmlDocument = (html, onAfterPrint) => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const cleanup = () => {
      window.setTimeout(() => {
        if (iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 500);
    };

    iframe.onload = () => {
      const frameWindow = iframe.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }

      let handled = false;
      const handleAfterPrint = () => {
        if (handled) return;
        handled = true;
        onAfterPrint?.();
        cleanup();
      };

      frameWindow.onafterprint = handleAfterPrint;
      frameWindow.focus();
      frameWindow.print();
      window.setTimeout(handleAfterPrint, 1500);
    };

    const frameDocument = iframe.contentDocument || iframe.contentWindow?.document;
    if (!frameDocument) {
      cleanup();
      throw new Error('Print frame unavailable');
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();
  };

  const validateBillingFields = () => {
    if (!selectedBillingOrder) {
      setBillingNotice('Select a delivered order first.');
      return false;
    }

    if (!billingCustomerName.trim() && !selectedBillingOrder.customer_name) {
      setBillingNotice('Enter a customer name before sending or printing the bill.');
      return false;
    }

    setBillingNotice('');
    return true;
  };

  const validateBillingPhone = () => {
    const phone = sanitizePhoneForWhatsApp(billingCustomerPhone || selectedBillingOrder?.customer_phone || '');
    if (phone.length < 10) {
      setBillingNotice('Enter a valid mobile number with country code if needed.');
      return false;
    }

    setBillingNotice('');
    return true;
  };

  const getBillMessage = (order) => {
    const orderLines = buildBillLines(order).join('\n');
    return [
      `Hello ${billingCustomerName || order.customer_name || 'Customer'},`,
      'Here is your SmartCafe bill:',
      `Order #${formatOrderSerial(order)} | ${formatOrderLocation(order)}`,
      orderLines,
      `Total: $${getOrderTotal(order).toFixed(2)}`,
      `Payment Method: ${formatPaymentMethodLabel(billingPaymentMethod)}`,
      `Payment Received: ${billingPaymentReceived ? 'Yes' : 'Pending'}`,
      `Manager WhatsApp: ${MANAGER_WHATSAPP_NO}`,
      'Thank you for visiting SmartCafe.'
    ].join('\n');
  };

  const handleSendWhatsApp = async () => {
    if (!validateBillingFields()) return;
    if (!validateBillingPhone()) return;

    const phone = sanitizePhoneForWhatsApp(billingCustomerPhone || selectedBillingOrder?.customer_phone || '');
    const order = {
      ...selectedBillingOrder,
      customer_name: billingCustomerName || selectedBillingOrder.customer_name,
      customer_phone: billingCustomerPhone || selectedBillingOrder.customer_phone,
      payment_method: billingPaymentMethod,
      payment_received: billingPaymentReceived
    };
    const message = encodeURIComponent(getBillMessage(order));

    try {
      const anchor = document.createElement('a');
      anchor.href = `https://web.whatsapp.com/send?phone=${phone}&text=${message}`;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      persistBillingCustomer().catch((error) => console.error(error));
      setBillingNotice('WhatsApp bill opened successfully.');
    } catch (error) {
      console.error(error);
      setBillingNotice('Failed to send WhatsApp bill.');
    }
  };

  const handlePrintBill = async () => {
    if (!validateBillingFields()) return;

    const order = {
      ...selectedBillingOrder,
      customer_name: billingCustomerName || selectedBillingOrder.customer_name,
      customer_phone: billingCustomerPhone || selectedBillingOrder.customer_phone,
      payment_method: billingPaymentMethod,
      payment_received: billingPaymentReceived
    };

    try {
      printHtmlDocument(buildCustomerBillHtml(order), () => {
        recordBillPrintHistory(order.id, 'customer')
          .then((refreshedOrder) => {
            if (refreshedOrder) {
              setBillingOrderId(String(refreshedOrder.id));
            }
          })
          .catch((error) => console.error(error));
      });
      persistBillingCustomer().catch((error) => console.error(error));
      setBillingNotice('Print bill opened successfully.');
    } catch (error) {
      console.error(error);
      setBillingNotice('Failed to print bill.');
    }
  };

  const handlePrintKitchenBill = async () => {
    if (!selectedBillingOrder) {
      setBillingNotice('Select a delivered order first.');
      return;
    }

    const order = {
      ...selectedBillingOrder,
      customer_name: billingCustomerName || selectedBillingOrder.customer_name,
      customer_phone: billingCustomerPhone || selectedBillingOrder.customer_phone,
      payment_method: billingPaymentMethod,
      payment_received: billingPaymentReceived
    };

    try {
      printHtmlDocument(buildKitchenBillHtml(order), () => {
        recordBillPrintHistory(order.id, 'kitchen')
          .then((refreshedOrder) => {
            if (refreshedOrder) {
              setBillingOrderId(String(refreshedOrder.id));
            }
          })
          .catch((error) => console.error(error));
      });
      persistBillingCustomer().catch((error) => console.error(error));
      setBillingNotice('Kitchen bill opened successfully.');
    } catch (error) {
      console.error(error);
      setBillingNotice('Failed to print kitchen bill.');
    }
  };

  const sidebarMetrics = [
    { label: 'Total Revenue', value: `$${(analytics?.totalRevenue || 0).toFixed(2)}`, hint: 'All time earnings' },
    { label: 'Total Orders', value: analytics?.totalOrders || 0, hint: 'Orders completed' },
    { label: 'Active Orders', value: activeOrders.length, hint: 'Currently in progress' },
    { label: 'Available Tables', value: availableTableNumbers.length, hint: `Out of ${TOTAL_DINE_IN_TABLES}` },
    { label: 'Ready Orders', value: readyOrders.length, hint: 'Waiting for pickup' }
  ];
  const latestFeedEntry = feed[0] || null;
  const feedToneClasses = {
    info: 'bg-indigo-100 text-indigo-700',
    success: 'bg-emerald-100 text-emerald-700',
    warning: 'bg-amber-100 text-amber-700',
    alert: 'bg-rose-100 text-rose-700'
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-gray-50"><CircularProgress size={60} style={{ color: '#4f46e5' }} /></div>;
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
        <Sidebar
          metrics={sidebarMetrics}
          variant="manager"
          title="Manager Console"
          subtitle="A cleaner executive sidebar for revenue, service flow, and floor availability."
        />
        <div className="dashboard-main">
          <div className="dashboard-shell dashboard-stack dashboard-main-stack">
          <div className="dashboard-hero">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="dashboard-kicker">Operations Control</div>
                <Typography className="mt-3 text-sm font-semibold text-slate-500">
                  Welcome, {currentUser?.name || 'Manager'}
                </Typography>
                <Typography variant="h3" className="dashboard-title mt-3">Executive Dashboard</Typography>
                <Typography className="dashboard-subtitle">
                  Live operational control across orders, menu, and service quality.
                </Typography>
              </div>
              <div className="flex min-w-0 flex-col gap-3 xl:max-w-[780px] xl:items-end">
                <div className="w-full overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5">
                  <div className="flex min-w-max gap-2">
                    {['Overview', 'Menu Master', 'Service Flow', 'Billing', 'Payments', 'Reports'].map((tab) => (
                      <button
                        key={tab}
                        className={`whitespace-nowrap rounded-xl px-5 py-2.5 text-sm font-bold transition-all ${activeTab === tab ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:bg-white/70'}`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-left shadow-sm sm:text-right">
                  <div className="text-xs font-bold uppercase tracking-[0.28em] text-slate-400">Database</div>
                  <div className="mt-2 text-sm font-bold text-slate-900">{databaseStatus?.file_name || 'smart_cafe.sqlite'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {databaseStatus?.size_bytes
                      ? `${((databaseStatus.size_bytes || 0) / 1024).toFixed(1)} KB • Updated ${formatBillTimestamp(databaseStatus?.updated_at)}`
                      : 'Live SQLite backup ready for download'}
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadDatabase}
                    disabled={downloadingBackup}
                    className="mt-3 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {downloadingBackup ? 'Preparing Backup...' : 'Download Backup'}
                  </button>
                </div>
              </div>
            </div>
          </div>

        {activeTab === 'Overview' && (
          <div className="space-y-6">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white rounded-3xl shadow-sm border border-amber-100 p-6">
                <h3 className="text-lg font-bold text-gray-900">Immediate Attention</h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                    <span className="text-amber-900 font-medium">Low stock items</span>
                    <span className="font-black text-amber-700">{lowStockItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
                    <span className="text-rose-900 font-medium">Unpaid delivered bills</span>
                    <span className="font-black text-rose-700">{unpaidServedOrders.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
                    <span className="text-emerald-900 font-medium">Ready for pickup</span>
                    <span className="font-black text-emerald-700">{readyOrders.length}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl bg-sky-50 px-4 py-3">
                    <span className="text-sky-900 font-medium">Tables free right now</span>
                    <span className="font-black text-sky-700">{availableTableNumbers.length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900">Tables Available Now</h3>
                <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                  <Typography className="font-bold text-gray-900">
                    {availableTableNumbers.length} dine-in table{availableTableNumbers.length === 1 ? '' : 's'} free
                  </Typography>
                  <Typography className="text-sm text-gray-500 mt-1">
                    Live from active waiter and kitchen orders.
                  </Typography>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {availableTableNumbers.length ? availableTableNumbers.map((tableNumber) => (
                      <Chip key={tableNumber} size="small" color="success" label={`Table ${tableNumber}`} />
                    )) : (
                      <Typography className="text-sm text-rose-500 font-medium">All dine-in tables are occupied right now.</Typography>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-bold text-gray-900">Oldest Active Order</h3>
                {oldestActiveOrder ? (
                  <div className="mt-4 rounded-2xl border border-gray-200 p-4">
                    <Typography className="font-bold text-gray-900">
                      Order #{formatOrderSerial(oldestActiveOrder)} • {formatOrderLocation(oldestActiveOrder)}
                    </Typography>
                    <Typography className="text-sm text-gray-500 mt-1">
                      {oldestActiveOrder.waiter?.name || 'Unassigned'} • {new Date(oldestActiveOrder.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </Typography>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip size="small" color="warning" label={oldestActiveOrder.status} />
                      <Chip size="small" variant="outlined" label={`${oldestActiveOrder.add_on_count || 0} add-ons`} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 text-sm text-gray-400 italic">No active orders right now.</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900">Recent Bill Activity</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {recentlyPrintedOrders.length ? recentlyPrintedOrders.map((order) => (
                  <div key={order.id} className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Typography className="font-bold text-slate-900">#{formatOrderSerial(order)}</Typography>
                      <Typography className="text-xs text-slate-500">{formatOrderLocation(order)}</Typography>
                    </div>
                    <Typography className="text-sm text-slate-600 mt-1">
                      Customer prints: {order.customer_bill_print_count || 0} • Kitchen prints: {order.kitchen_bill_print_count || 0}
                    </Typography>
                  </div>
                )) : (
                  <div className="text-sm text-gray-400 italic">Printed bill activity will appear here.</div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Top Performing Items</h3>
                <div className="space-y-5">
                  {analytics?.topSellingItems?.length ? analytics.topSellingItems.map((item, index) => {
                    const maxQty = analytics.topSellingItems[0].quantity || 1;
                    const pct = Math.max(10, (item.quantity / maxQty) * 100);
                    return (
                      <div key={item.name}>
                        <div className="flex justify-between text-sm font-bold text-gray-700 mb-1">
                          <span>{index + 1}. {item.name}</span>
                          <span className="text-indigo-600">{item.quantity} sold</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className="bg-gradient-to-r from-indigo-500 to-blue-400 h-full rounded-full" style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  }) : <div className="text-gray-400 italic">No sales tracked yet.</div>}
                </div>
              </div>

              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Live Operation Feed</h3>
                    {latestFeedEntry && (
                      <p className="mt-1 text-xs font-medium text-slate-500">
                        Last event {new Date(latestFeedEntry.timestamp).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button onClick={() => fetchData()} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-bold">Refresh</button>
                </div>
                <div className="space-y-4">
                  {feed.map((entry) => (
                    <div key={entry.id} className="flex gap-4 p-3 bg-gray-50 rounded-xl">
                      <div className={`p-2 rounded-lg text-sm font-bold ${feedToneClasses[entry.tone] || feedToneClasses.info}`}>Ops</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-700">{entry.message}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(entry.timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'Menu Master' && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Catalog Registry</h2>
                <p className="text-gray-500 mt-1">Manage pricing, availability, and live menu visibility.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={handleExportMenu} className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md">
                  Export CSV
                </button>
                <button onClick={() => setIsAddMode((prev) => !prev)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-md">
                  {isAddMode ? 'Cancel' : '+ Add Product'}
                </button>
              </div>
            </div>

            {isAddMode && (
              <form onSubmit={handleAddSubmit} className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Item Name</label>
                  <input required type="text" className="w-full mt-1 p-2 border rounded" value={newItem.name} onChange={(event) => setNewItem({ ...newItem, name: event.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Category</label>
                  <input
                    list="manager-menu-categories"
                    className="w-full mt-1 p-2 border rounded bg-white"
                    value={newItem.category}
                    onChange={(event) => setNewItem({ ...newItem, category: event.target.value })}
                    placeholder="Choose or type new category"
                    required
                  />
                  <datalist id="manager-menu-categories">
                    {menuCategoryOptions.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Price</label>
                  <input required type="number" step="0.01" className="w-full mt-1 p-2 border rounded" value={newItem.price} onChange={(event) => setNewItem({ ...newItem, price: event.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Type</label>
                  <select className="w-full mt-1 p-2 border rounded bg-white" value={newItem.item_type} onChange={(event) => setNewItem({ ...newItem, item_type: event.target.value })}>
                    {MENU_ITEM_TYPES.map((itemType) => (
                      <option key={itemType} value={itemType}>{itemType}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Opening Stock</label>
                  <input required type="number" min="0" className="w-full mt-1 p-2 border rounded" value={newItem.stock_quantity || ''} onChange={(event) => setNewItem({ ...newItem, stock_quantity: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Product Image</label>
                  <input type="file" accept="image/*" className="w-full mt-1 p-2 border rounded bg-white" onChange={handleNewItemImageChange} />
                  <p className="mt-1 text-xs text-gray-500">Optional. JPG, PNG, or WEBP up to 2 MB.</p>
                </div>
                <div className="md:col-span-2">
                  {newItem.image_url ? (
                    <img src={newItem.image_url} alt="New menu preview" className="h-28 w-full rounded-xl border border-gray-200 object-cover" />
                  ) : (
                    <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white text-xs font-medium uppercase tracking-[0.18em] text-gray-400">
                      Image Preview
                    </div>
                  )}
                </div>
                <button type="submit" className="px-6 py-2 h-[42px] bg-green-500 text-white font-bold rounded shadow hover:bg-green-600 md:col-span-4 md:w-fit">Save</button>
              </form>
            )}

            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <input
                className="w-full md:w-80 border rounded-xl px-4 py-3"
                placeholder="Search by item name"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              <div className="flex overflow-x-auto gap-2 pb-2">
                {categories.map((category) => (
                  <button key={category} onClick={() => setSelectedCategory(category)} className={`px-4 py-2 ${selectedCategory === category ? 'bg-indigo-600 text-white' : 'bg-gray-100'} rounded-full text-xs font-bold`}>
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6">
              <button onClick={() => setMenuViewMode('all')} className={`px-4 py-2 rounded-full text-xs font-bold ${menuViewMode === 'all' ? 'bg-slate-900 text-white' : 'bg-gray-100 text-gray-700'}`}>All Items</button>
              <button onClick={() => setMenuViewMode('low_stock')} className={`px-4 py-2 rounded-full text-xs font-bold ${menuViewMode === 'low_stock' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-700'}`}>Low Stock First</button>
              <button onClick={() => setMenuViewMode('top_selling')} className={`px-4 py-2 rounded-full text-xs font-bold ${menuViewMode === 'top_selling' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}>Top Selling First</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="rounded-2xl bg-amber-50 border border-amber-100 px-4 py-4">
                <div className="text-xs font-bold uppercase text-amber-700">Low Stock Items</div>
                <div className="mt-2 text-3xl font-black text-amber-900">{lowStockItems.length}</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-4">
                <div className="text-xs font-bold uppercase text-emerald-700">Available Items</div>
                <div className="mt-2 text-3xl font-black text-emerald-900">{visibleMenu.length}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-200 px-4 py-4">
                <div className="text-xs font-bold uppercase text-slate-500">Total Stock Units</div>
                <div className="mt-2 text-3xl font-black text-slate-900">
                  {visibleMenu.reduce((sum, item) => sum + Number(item.stock_quantity || 0), 0)}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredMenu.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-2xl p-4">
                  {editItemId === item.id ? (
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                      <input className="border p-2 rounded" value={editItemData.name} onChange={(event) => setEditItemData({ ...editItemData, name: event.target.value })} />
                      <input
                        list="manager-edit-menu-categories"
                        className="border p-2 rounded bg-white"
                        value={editItemData.category}
                        onChange={(event) => setEditItemData({ ...editItemData, category: event.target.value })}
                        placeholder="Choose or type category"
                      />
                      <datalist id="manager-edit-menu-categories">
                        {menuCategoryOptions.map((category) => (
                          <option key={category} value={category} />
                        ))}
                      </datalist>
                      <select className="border p-2 rounded bg-white" value={editItemData.item_type} onChange={(event) => setEditItemData({ ...editItemData, item_type: event.target.value })}>
                        {MENU_ITEM_TYPES.map((itemType) => (
                          <option key={itemType} value={itemType}>{itemType}</option>
                        ))}
                      </select>
                      <input type="number" step="0.01" className="border p-2 rounded" value={editItemData.price} onChange={(event) => setEditItemData({ ...editItemData, price: event.target.value })} />
                      <input type="number" min="0" className="border p-2 rounded" value={editItemData.stock_quantity} onChange={(event) => setEditItemData({ ...editItemData, stock_quantity: event.target.value })} placeholder="Current stock" />
                      <input type="number" min="0" className="border p-2 rounded" value={editItemData.restock_quantity} onChange={(event) => setEditItemData({ ...editItemData, restock_quantity: event.target.value })} placeholder="Restock qty" />
                      <div className="md:col-span-3">
                        <input type="file" accept="image/*" className="w-full border p-2 rounded bg-white" onChange={handleEditImageChange} />
                        <div className="mt-2 flex items-center gap-3">
                          {editItemData.image_url ? (
                            <img src={editItemData.image_url} alt="Edit menu preview" className="h-16 w-24 rounded-lg border border-gray-200 object-cover" />
                          ) : (
                            <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-gray-300 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                              No Image
                            </div>
                          )}
                          <button type="button" onClick={() => setEditItemData((prev) => ({ ...prev, image_url: '' }))} className="px-3 py-2 rounded bg-red-50 text-red-600 font-bold text-xs">
                            Remove Image
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEditSave(item.id)} className="px-4 py-2 bg-green-500 text-white rounded font-bold text-xs">Save</button>
                        <button onClick={() => setEditItemId(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded font-bold text-xs">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Typography className="font-bold text-gray-900">{item.name}</Typography>
                          <Chip label={item.category} size="small" />
                          <Chip label={normalizeMenuItemType(item.item_type)} size="small" color={normalizeMenuItemType(item.item_type) === 'Non Veg' ? 'error' : 'success'} />
                          <Chip color={item.available ? 'success' : 'error'} label={item.available ? 'Available' : 'Unavailable'} size="small" />
                          {item.stock_quantity <= 5 && (
                            <Chip color="warning" label="Low Stock" size="small" />
                          )}
                        </div>
                        <Typography className="text-sm text-gray-500 mt-1">${parseFloat(item.price).toFixed(2)}</Typography>
                        <Typography className="text-sm text-gray-500 mt-1">Available: {item.stock_quantity || 0} • Received: {item.total_received || 0}</Typography>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => handleToggleStock(item)} className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-xs font-bold">
                          {item.available ? 'Mark Unavailable' : 'Restock'}
                        </button>
                        <button onClick={() => handleDuplicate(item)} className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-bold">Duplicate</button>
                        <button onClick={() => handleEditClick(item)} className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-bold">Edit</button>
                        <button onClick={() => handleDelete(item.id)} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-bold">Delete</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Service Flow' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-gray-400">Pending</div>
                <div className="mt-2 text-4xl font-black text-gray-900">{pendingOrders.length}</div>
              </div>
              <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-blue-400">Preparing</div>
                <div className="mt-2 text-4xl font-black text-gray-900">{preparingOrders.length}</div>
              </div>
              <div className="rounded-3xl bg-white border border-gray-100 p-5 shadow-sm">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-500">Ready Pickup</div>
                <div className="mt-2 text-4xl font-black text-gray-900">{readyOrders.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Live Order Board</h2>
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
                {activeOrders.slice(0, 12).map((order) => (
                  <div key={order.id} className="border border-gray-200 rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <Typography className="font-bold text-gray-900">Order #{formatOrderSerial(order)} • {formatOrderLocation(order)}</Typography>
                        <Typography className="text-sm text-gray-500">
                          {order.waiter?.name || 'Unassigned'} • {new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </Typography>
                      </div>
                      <Chip label={order.status} size="small" />
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(order.items || []).map((item) => (
                        <Chip key={`${order.id}-${item.id}`} size="small" variant="outlined" label={`${item.quantity}x ${item.menu_item?.name || 'Item'}`} />
                      ))}
                    </div>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="text-gray-500">Add-ons: {order.add_on_count || 0}</span>
                      <span className="font-bold text-gray-900">${getOrderTotal(order).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Waiter Performance</h2>
              <div className="space-y-4">
                {staffStats.length ? staffStats.map((person) => (
                  <div key={person.name} className="border border-gray-200 rounded-2xl p-4">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <Typography className="font-bold text-gray-900">{person.name}</Typography>
                        <Typography className="text-sm text-gray-500">{person.activeOrders} active • {person.servedOrders} served</Typography>
                      </div>
                      <Typography className="font-bold text-indigo-700">${person.revenue.toFixed(2)}</Typography>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Chip size="small" label={`${person.addOnsHandled} add-ons`} />
                      <Chip size="small" label={`${person.servedOrders + person.activeOrders} total orders`} />
                    </div>
                  </div>
                )) : (
                  <div className="text-gray-400 italic">Waiter activity will appear once orders are assigned.</div>
                )}
              </div>
            </div>
            </div>
          </div>
        )}

        {activeTab === 'Billing' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment Counter Panel</h2>
              <p className="text-gray-500 mb-6">Waiters request the bill here. Manager receives payment, prints the receipt, and frees the table from this counter.</p>
              <p className="text-sm text-gray-500 mb-6">WhatsApp sends through the account signed in on this device. Manager contact: {MANAGER_WHATSAPP_NO}</p>

              <div className="space-y-4">
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">Pending Payments</div>
                  <div className="mt-4 space-y-2">
                    {pendingPaymentOrders.length ? pendingPaymentOrders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => handleSelectBillingOrder(order.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition ${
                          String(billingOrderId) === String(order.id)
                            ? 'border-amber-400 bg-white'
                            : 'border-amber-100 bg-white/80 hover:border-amber-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-slate-900">{formatOrderLocation(order)} | Order #{formatOrderSerial(order)}</div>
                          <div className="text-sm text-slate-500">Status: Waiting Payment</div>
                        </div>
                        <div className="font-black text-amber-700">${getOrderTotal(order).toFixed(2)}</div>
                      </button>
                    )) : (
                      <div className="text-sm text-amber-800">No pending counter payments right now.</div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Search Bill Queue</label>
                  <div className="mt-1 flex gap-3">
                    <input
                      className="w-full p-3 border rounded-xl"
                      value={billingSearch}
                      onChange={(event) => setBillingSearch(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleBillingSearch();
                        }
                      }}
                      placeholder="Search by customer name, serial no, or table"
                    />
                    <button type="button" onClick={handleBillingSearch} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold whitespace-nowrap">
                      Search
                    </button>
                    <button type="button" onClick={handleClearBillingSearch} className="px-5 py-3 rounded-xl bg-gray-100 text-gray-700 font-bold whitespace-nowrap">
                      Clear
                    </button>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    {appliedBillingSearch.trim()
                      ? `${filteredBillingOrders.length} result${filteredBillingOrders.length === 1 ? '' : 's'}`
                      : `${billableOrders.length} ordered bill${billableOrders.length === 1 ? '' : 's'} available`}
                  </div>
                </div>

                {appliedBillingSearch.trim() && filteredBillingOrders.length > 0 && (
                  <div className="rounded-2xl border border-gray-200 bg-slate-50 p-3">
                    <div className="text-xs font-bold uppercase text-gray-500 mb-3">Search Results</div>
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                      {filteredBillingOrders.map((order) => (
                        <button
                          key={order.id}
                          type="button"
                          onClick={() => handleSelectBillingOrder(order.id)}
                          className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                            String(billingOrderId) === String(order.id)
                              ? 'border-indigo-500 bg-indigo-50'
                              : 'border-gray-200 bg-white hover:border-indigo-300'
                          }`}
                        >
                          <div className="font-bold text-gray-900">
                            Order #{formatOrderSerial(order)} • {order.customer_name || 'Walk-in'}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {formatOrderLocation(order)} • {order.status} • ${getOrderTotal(order).toFixed(2)}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">All Ordered Bills</label>
                  <select
                    className="w-full mt-1 p-3 border rounded-xl bg-white"
                    value={billingOrderId}
                    onChange={(event) => setBillingOrderId(event.target.value)}
                  >
                    <option value="">Select an ordered bill</option>
                    {filteredBillingOrders.map((order) => (
                      <option key={order.id} value={order.id}>
                        Order #{formatOrderSerial(order)} - {order.customer_name || 'Walk-in'} - {formatOrderLocation(order)} - {order.status} - ${getOrderTotal(order).toFixed(2)}
                      </option>
                    ))}
                  </select>
                  {appliedBillingSearch.trim() && filteredBillingOrders.length === 0 && (
                    <div className="mt-2 text-sm text-red-500">
                      No ordered bills match this search. Try customer name, serial no, or table number.
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Customer Name</label>
                  <input
                    className="w-full mt-1 p-3 border rounded-xl"
                    value={billingCustomerName}
                    onChange={(event) => setBillingCustomerName(event.target.value)}
                    placeholder="Enter customer name"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Mobile Number</label>
                  <input
                    className="w-full mt-1 p-3 border rounded-xl"
                    value={billingCustomerPhone}
                    onChange={(event) => setBillingCustomerPhone(event.target.value)}
                    placeholder="Enter mobile number"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-500 uppercase">Payment Method</label>
                  <select
                    className="w-full mt-1 p-3 border rounded-xl bg-white"
                    value={billingPaymentMethod}
                    onChange={(event) => setBillingPaymentMethod(event.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="upi_qr">UPI QR</option>
                    <option value="coupon">Coupon</option>
                    <option value="card">Card</option>
                  </select>
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-gray-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={billingPaymentReceived}
                    onChange={(event) => setBillingPaymentReceived(event.target.checked)}
                  />
                  <span className="text-sm font-medium text-gray-700">Payment Received</span>
                </label>

                {selectedBillingOrder && (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-700">Payment Counter</div>
                    <div className="mt-3 font-bold text-slate-900">
                      {formatOrderLocation(selectedBillingOrder)} | Order #{formatOrderSerial(selectedBillingOrder)}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Total: ${getOrderTotal(selectedBillingOrder).toFixed(2)} • Status: {selectedBillingOrder.payment_received ? 'Paid' : 'Waiting Payment'}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button type="button" onClick={() => handleReceivePayment('cash')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">
                        Receive Cash
                      </button>
                      <button type="button" onClick={() => handleReceivePayment('upi_qr')} className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-bold text-white">
                        Receive UPI
                      </button>
                      <button type="button" onClick={() => handleReceivePayment('card')} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white">
                        Receive Card
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="button" onClick={() => setBillPreviewMode('customer')} className={`px-5 py-3 rounded-xl font-bold ${billPreviewMode === 'customer' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-700 border border-sky-200'}`}>
                    Customer Bill Preview
                  </button>
                  <button type="button" onClick={() => setBillPreviewMode('kitchen')} className={`px-5 py-3 rounded-xl font-bold ${billPreviewMode === 'kitchen' ? 'bg-orange-600 text-white' : 'bg-orange-50 text-orange-700 border border-orange-200'}`}>
                    Kitchen Bill Preview
                  </button>
                  <button type="button" onClick={handleSendWhatsApp} className="px-5 py-3 rounded-xl bg-green-600 text-white font-bold">
                    Send Bill via WhatsApp
                  </button>
                  <button type="button" onClick={handlePrintBill} className="px-5 py-3 rounded-xl bg-slate-900 text-white font-bold">
                    Print Customer Bill
                  </button>
                  <button type="button" onClick={handlePrintKitchenBill} className="px-5 py-3 rounded-xl bg-orange-600 text-white font-bold">
                    Print Kitchen Bill
                  </button>
                </div>

                {billingNotice && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-700">
                    {billingNotice}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                {billPreviewMode === 'kitchen' ? 'Kitchen Bill Preview' : 'Customer Bill Preview'}
              </h2>
              {selectedBillingOrder ? (
                <div className="space-y-4">
                  <div className="rounded-[28px] overflow-hidden border border-rose-100 shadow-sm">
                    <div className={`p-6 text-white ${
                      billPreviewMode === 'kitchen'
                          ? 'bg-gradient-to-r from-slate-800 via-orange-700 to-amber-500'
                          : 'bg-gradient-to-r from-rose-500 via-orange-400 to-amber-300'
                    }`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Typography className="text-xs font-bold uppercase tracking-[0.35em] text-white/80">SmartCafe</Typography>
                          <Typography className="text-3xl font-black mt-2">
                            {billPreviewMode === 'kitchen' ? 'Kitchen Bill' : 'Customer Bill'}
                          </Typography>
                          <Typography className="text-sm text-white/85 mt-2">
                            {billPreviewMode === 'kitchen'
                                ? 'Preparation copy for the kitchen queue and plating flow.'
                                : 'Freshly prepared with care, served with warmth.'}
                          </Typography>
                        </div>
                        <div className="rounded-2xl bg-white/15 px-4 py-3 text-right backdrop-blur-sm">
                          <Typography className="text-xs uppercase tracking-[0.25em] text-white/70">Order No</Typography>
                          <Typography className="text-2xl font-black">#{formatOrderSerial(selectedBillingOrder)}</Typography>
                        </div>
                      </div>
                    </div>

                    <div className={`${billPreviewMode === 'kitchen' ? 'bg-orange-50/60' : 'bg-[#fffaf5]'} p-6`}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-2xl bg-white border border-orange-100 p-4">
                          <Typography className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">Guest Details</Typography>
                          <Typography className="font-bold text-slate-900 mt-3">{billingCustomerName || 'Not entered'}</Typography>
                          <Typography className="text-sm text-slate-500 mt-1">{billingCustomerPhone || 'Mobile not entered'}</Typography>
                        </div>
                        <div className="rounded-2xl bg-white border border-orange-100 p-4">
                          <Typography className="text-xs font-bold uppercase tracking-[0.25em] text-orange-400">Visit Details</Typography>
                          <Typography className="font-bold text-slate-900 mt-3">{formatOrderLocation(selectedBillingOrder)}</Typography>
                          <Typography className="text-sm text-slate-500 mt-1">
                            {new Date(selectedBillingOrder.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </Typography>
                          <Typography className="text-sm text-slate-500 mt-1">
                            Payment: {formatPaymentMethodLabel(billingPaymentMethod)} • {billingPaymentReceived ? 'Received' : 'Pending'}
                          </Typography>
                          {billPreviewMode === 'kitchen' ? (
                            <Typography className="text-sm text-slate-500 mt-1">
                              Items: {(selectedBillingOrder.items || []).length} • Kitchen prep copy
                            </Typography>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                      <Typography className="font-bold text-emerald-900">Customer Bill History</Typography>
                      <Typography className="text-sm text-emerald-700 mt-2">
                        Printed: {selectedBillingOrder.customer_bill_print_count || 0} time{(selectedBillingOrder.customer_bill_print_count || 0) === 1 ? '' : 's'}
                      </Typography>
                      <Typography className="text-sm text-emerald-700">
                        Last printed: {formatBillTimestamp(selectedBillingOrder.last_customer_bill_printed_at)}
                      </Typography>
                    </div>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <Typography className="font-bold text-amber-900">Kitchen Bill History</Typography>
                      <Typography className="text-sm text-amber-700 mt-2">
                        Printed: {selectedBillingOrder.kitchen_bill_print_count || 0} time{(selectedBillingOrder.kitchen_bill_print_count || 0) === 1 ? '' : 's'}
                      </Typography>
                      <Typography className="text-sm text-amber-700">
                        Last printed: {formatBillTimestamp(selectedBillingOrder.last_kitchen_bill_printed_at)}
                      </Typography>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {(selectedBillingOrder.items || []).map((item) => {
                      const unitPrice = parseFloat(item.menu_item?.price || 0);
                      const lineTotal = unitPrice * item.quantity;
                      return (
                        <div key={`${selectedBillingOrder.id}-${item.id}`} className="flex justify-between items-center border border-orange-100 bg-orange-50/40 rounded-2xl px-4 py-4">
                          <div>
                            <Typography className="font-bold text-gray-900">{getMenuEmoji(item)} {item.menu_item?.name || 'Item'}</Typography>
                            <Typography className="text-sm text-gray-500">
                              {billPreviewMode === 'kitchen'
                                ? `${item.quantity} x ${Number(item.add_on_batch || 0) > 0 ? 'Add-on batch' : 'Main order'}`
                                : `${item.quantity} x $${unitPrice.toFixed(2)}`}
                            </Typography>
                          </div>
                          <Typography className="font-black text-lg text-gray-900">
                            {billPreviewMode === 'kitchen'
                              ? `${item.quantity} item${item.quantity === 1 ? '' : 's'}`
                              : `$${lineTotal.toFixed(2)}`}
                          </Typography>
                        </div>
                      );
                    })}
                  </div>

                  <div className="rounded-[28px] bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-5 text-white">
                    <div className="flex justify-between items-center">
                      <div>
                        <Typography className="text-sm uppercase tracking-[0.25em] text-white/70">
                          {billPreviewMode === 'kitchen' ? 'Kitchen Summary' : 'Total Amount'}
                        </Typography>
                        <Typography className="text-sm text-white/80 mt-2">
                          {billPreviewMode === 'kitchen'
                              ? 'Use this copy for kitchen preparation, batching, and plating handoff.'
                            : 'Sweet moments are better with coffee and good company.'}
                        </Typography>
                      </div>
                      <Typography className="text-3xl font-black">
                        {billPreviewMode === 'kitchen'
                          ? `${(selectedBillingOrder.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} items`
                          : `$${getOrderTotal(selectedBillingOrder).toFixed(2)}`}
                      </Typography>
                    </div>
                    <div className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/90">
                      {billPreviewMode === 'kitchen'
                          ? `Kitchen copy for ${formatOrderLocation(selectedBillingOrder)} showing preparation batches and item counts.`
                        : `Thank you, ${billingCustomerName || 'dear guest'}! We hope your visit was delightful and we look forward to serving you again soon.`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-400 italic">Select a delivered order to preview the bill.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Payments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-2xl font-bold text-gray-900">Payment Management</h2>
                <p className="text-gray-500 mt-2">All order bills are listed here. Update payment status as paid, pending, or unpaid, and choose the payment mode.</p>
              </div>
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-gray-400">Visible Bills</div>
                <div className="mt-2 text-4xl font-black text-slate-900">{filteredPaymentOrders.length}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <input
                className="w-full rounded-2xl border border-gray-200 px-4 py-3"
                placeholder="Search by serial no, table, customer, or payment status"
                value={paymentSearch}
                onChange={(event) => setPaymentSearch(event.target.value)}
              />
              <select
                className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3"
                value={paymentStatusFilter}
                onChange={(event) => setPaymentStatusFilter(event.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="unpaid">Unpaid</option>
              </select>
            </div>

            {paymentNotice ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
                {paymentNotice}
              </div>
            ) : null}

            <div className="space-y-4">
              {filteredPaymentOrders.map((order) => {
                const draft = paymentDrafts[order.id] || {
                  payment_method: order.payment_method || 'cash',
                  payment_status: order.payment_status || (order.payment_received ? 'paid' : 'pending')
                };

                return (
                  <div key={order.id} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div>
                        <Typography className="font-bold text-slate-900">
                          Order #{formatOrderSerial(order)} • {formatOrderLocation(order)}
                        </Typography>
                        <Typography className="text-sm text-slate-500 mt-1">
                          {order.customer_name || 'Walk-in'} • {new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                        </Typography>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Chip size="small" label={`Order ${order.status}`} />
                          <Chip size="small" color={order.payment_received ? 'success' : 'warning'} label={order.payment_received ? 'Paid' : 'Unpaid'} />
                          <Chip size="small" variant="outlined" label={`Total $${getOrderTotal(order).toFixed(2)}`} />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:min-w-[620px]">
                        <select
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          value={draft.payment_status}
                          onChange={(event) => updatePaymentDraft(order.id, 'payment_status', event.target.value)}
                        >
                          <option value="paid">Paid</option>
                          <option value="pending">Pending</option>
                          <option value="unpaid">Unpaid</option>
                        </select>

                        <select
                          className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                          value={draft.payment_method}
                          onChange={(event) => updatePaymentDraft(order.id, 'payment_method', event.target.value)}
                        >
                          <option value="cash">Cash</option>
                          <option value="upi_qr">UPI QR</option>
                          <option value="coupon">Coupon</option>
                          <option value="card">Card</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => handleSavePayment(order)}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          Save Payment
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {!filteredPaymentOrders.length ? (
                <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                  No order bills match this payment filter.
                </div>
              ) : null}
            </div>
          </div>
        )}

        {activeTab === 'Reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Sales</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Orders Report</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Full order list with waiter, customer, payment, totals, add-ons, and print history.
                </Typography>
                <button type="button" onClick={() => handleDownloadReport('orders')} className="mt-5 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700">
                  Download CSV
                </button>
              </div>

              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Inventory</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Menu Stock Report</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Product list with category, price, availability, live stock quantity, and received stock.
                </Typography>
                <button type="button" onClick={() => handleDownloadReport('menu')} className="mt-5 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">
                  Download CSV
                </button>
              </div>

              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Team</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Waiter Performance</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Waiter-wise active orders, served orders, add-ons handled, and revenue contribution.
                </Typography>
                <button type="button" onClick={() => handleDownloadReport('waiters')} className="mt-5 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-sky-700">
                  Download CSV
                </button>
              </div>

              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Billing</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Billing Audit</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Delivered orders with payment received status, customer bill prints, and kitchen bill prints.
                </Typography>
                <button type="button" onClick={() => handleDownloadReport('bills')} className="mt-5 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-amber-600">
                  Download CSV
                </button>
              </div>

              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Insights</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Analytics Snapshot</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Revenue, completed orders, active queue, low-stock count, and top-selling items in JSON.
                </Typography>
                <button type="button" onClick={() => handleDownloadReport('analytics')} className="mt-5 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800">
                  Download JSON
                </button>
              </div>

              <div className="dashboard-panel p-6">
                <div className="dashboard-kicker">Database</div>
                <Typography className="mt-3 text-2xl font-black text-slate-900">Database File</Typography>
                <Typography className="mt-2 text-sm text-slate-500">
                  Active engine: SQLite. Use this backup file for archive, import, or migration into MySQL Workbench or PostgreSQL tools.
                </Typography>
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  {databaseStatus?.size_bytes
                    ? `${databaseStatus.file_name} • ${((databaseStatus.size_bytes || 0) / 1024).toFixed(1)} KB • Updated ${formatBillTimestamp(databaseStatus.updated_at)}`
                    : 'Live SQLite backup file ready for export'}
                </div>
                <button type="button" onClick={handleDownloadDatabase} disabled={downloadingBackup} className="mt-5 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-rose-300">
                  {downloadingBackup ? 'Preparing Backup...' : 'Download SQLite Backup'}
                </button>
                <button type="button" onClick={handleDownloadSqlExport} disabled={downloadingBackup} className="mt-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300">
                  Download SQL for MySQL Workbench
                </button>
              </div>
            </div>

            {reportNotice && (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-medium text-slate-700 shadow-sm">
                {reportNotice}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ManagerDashboard;
