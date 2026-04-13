import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, CardContent, CardMedia, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { socket } from '../lib/socket';
import { getMenuImage } from '../lib/menuArt';
import { normalizeMenuItemType } from '../lib/menuItemTypes';

const SESSION_KEY = 'smartCafeQrSessionId';
const RESTAURANT_KEY = 'smartCafeRestaurantCode';
const TABLE_KEY = 'smartCafeTableNumber';
const LIVE_REFRESH_MS = 5000;

const STATUS_META = {
  pending: { label: 'Pending', tone: 'bg-amber-100 text-amber-800 border border-amber-200', accent: 'bg-amber-500' },
  preparing: { label: 'Preparing', tone: 'bg-sky-100 text-sky-800 border border-sky-200', accent: 'bg-sky-500' },
  ready: { label: 'Ready', tone: 'bg-emerald-100 text-emerald-800 border border-emerald-200', accent: 'bg-emerald-500' },
  served: { label: 'Served', tone: 'bg-slate-200 text-slate-800 border border-slate-300', accent: 'bg-slate-600' },
  cancelled: { label: 'Cancelled', tone: 'bg-rose-100 text-rose-800 border border-rose-200', accent: 'bg-rose-500' }
};

const POPULAR_KEYWORDS = ['cappuccino', 'latte', 'espresso', 'brownie', 'croissant', 'sandwich', 'smoothie', 'milkshake'];

const createSessionId = () => `qr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const formatCurrency = (value) => `$${Number(value || 0).toFixed(2)}`;

const normalizeStatus = (status) => STATUS_META[status] || STATUS_META.pending;

const sanitizePhoneForWhatsApp = (phone) => String(phone || '').replace(/[^\d]/g, '');

const escapePdfText = (value) => String(value || '')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/[^\x20-\x7E]/g, ' ');

const wrapPdfText = (text, maxLength = 74) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (!words.length) return [''];

  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (nextLine.length <= maxLength) {
      currentLine = nextLine;
      return;
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    currentLine = word;
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
};

const getOrderTotal = (order) => (
  (order?.items || []).reduce((sum, item) => (
    sum + (Number(item.menu_item?.price || 0) * Number(item.quantity || 0))
  ), 0)
);

const buildBillLines = (order) => (
  (order?.items || []).map((item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.menu_item?.price || 0);
    const lineTotal = quantity * unitPrice;
    return `${quantity} x ${item.menu_item?.name || 'Item'} - ${formatCurrency(lineTotal)}`;
  })
);

const buildCustomerBillPdf = (order, customerName, customerPhone) => {
  const detailLines = [
    'SmartCafe Customer Bill',
    `Order #${formatOrderSerial(order)}`,
    formatOrderLocation(order),
    `Customer: ${customerName || order?.customer_name || 'Guest'}`,
    `Mobile: ${customerPhone || order?.customer_phone || 'Not provided'}`,
    '',
    'Items'
  ];

  buildBillLines(order).forEach((line) => {
    wrapPdfText(line).forEach((wrappedLine) => {
      detailLines.push(wrappedLine);
    });
  });

  detailLines.push('');
  detailLines.push(`Total: ${formatCurrency(getOrderTotal(order))}`);
  detailLines.push(`Generated: ${new Date().toLocaleString()}`);

  const contentLines = detailLines.slice(0, 38);
  const stream = [
    'BT',
    '/F1 12 Tf'
  ];

  contentLines.forEach((line, index) => {
    const y = 760 - (index * 18);
    stream.push(`1 0 0 1 50 ${y} Tm (${escapePdfText(line)}) Tj`);
  });

  stream.push('ET');

  const content = `${stream.join('\n')}\n`;
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new Blob([pdf], { type: 'application/pdf' });
};

const downloadBillPdf = (order, customerName, customerPhone) => {
  const pdfBlob = buildCustomerBillPdf(order, customerName, customerPhone);
  const blobUrl = URL.createObjectURL(pdfBlob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = `smartcafe-bill-${formatOrderSerial(order)}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
};

const buildWhatsAppBillMessage = (order, customerName) => [
  `Hello ${customerName || order?.customer_name || 'Customer'},`,
  'Here is your SmartCafe bill summary:',
  `Order #${formatOrderSerial(order)} | ${formatOrderLocation(order)}`,
  `Payment: ${order?.payment_method === 'upi' ? 'UPI' : 'Pay at Counter'}`,
  ...buildBillLines(order),
  `Total: ${formatCurrency(getOrderTotal(order))}`,
  'Your PDF bill can be downloaded from the order screen.'
].join('\n');

const getAvailabilityMeta = (item) => {
  const stock = Number(item?.stock_quantity || 0);
  const available = Boolean(item?.available) && stock > 0;

  if (!available) {
    return { label: 'Out of stock', tone: 'bg-rose-100 text-rose-700 border border-rose-200' };
  }

  if (stock <= 2) {
    return { label: `Only ${stock} left`, tone: 'bg-amber-100 text-amber-700 border border-amber-200' };
  }

  if (stock <= 6) {
    return { label: `${stock} left`, tone: 'bg-yellow-100 text-yellow-700 border border-yellow-200' };
  }

  return { label: 'Available', tone: 'bg-emerald-100 text-emerald-700 border border-emerald-200' };
};

const getPrepTimeLabel = (item) => {
  const name = String(item?.name || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();

  if (name.includes('sandwich') || name.includes('wrap') || category.includes('lunch')) return '12 min';
  if (name.includes('pancake') || name.includes('omelette') || category.includes('breakfast')) return '10 min';
  if (category.includes('bakery') || category.includes('dessert')) return '3 min';
  if (category.includes('smoothie') || category.includes('milkshake')) return '6 min';
  return '5 min';
};

const getPopularScore = (item) => {
  const name = String(item?.name || '').toLowerCase();
  const category = String(item?.category || '').toLowerCase();
  const keywordBonus = POPULAR_KEYWORDS.some((keyword) => name.includes(keyword)) ? 100 : 0;
  const categoryBonus = ['hot coffee', 'iced coffee', 'dessert', 'bakery'].includes(category) ? 25 : 0;
  const stockBonus = Math.min(20, Number(item?.stock_quantity || 0));
  return keywordBonus + categoryBonus + stockBonus;
};

const PublicOrderPage = () => {
  const [searchParams] = useSearchParams();
  const [menu, setMenu] = useState([]);
  const [cart, setCart] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('pay_at_counter');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [notice, setNotice] = useState('');
  const [statusNotice, setStatusNotice] = useState('');
  const [billNotice, setBillNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState(null);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [liveSyncMessage, setLiveSyncMessage] = useState('Realtime menu and order tracking are active.');

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const cartSectionRef = useRef(null);
  const categoryRefs = useRef({});

  const restaurantCode = searchParams.get('res') || localStorage.getItem(RESTAURANT_KEY) || 'smartcafe_main';
  const tableNumber = searchParams.get('table') || localStorage.getItem(TABLE_KEY) || '';

  useEffect(() => {
    localStorage.setItem(RESTAURANT_KEY, restaurantCode);
    if (tableNumber) {
      localStorage.setItem(TABLE_KEY, String(tableNumber));
    }

    if (!localStorage.getItem(SESSION_KEY)) {
      localStorage.setItem(SESSION_KEY, createSessionId());
    }
  }, [restaurantCode, tableNumber]);

  const sessionId = localStorage.getItem(SESSION_KEY) || createSessionId();

  const fetchMenu = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/public/menu`, {
        params: {
          restaurant: restaurantCode,
          table: tableNumber
        }
      });
      setMenu(response.data.menu || []);
    } catch (error) {
      console.error(error);
      setNotice('Failed to load menu for this table.');
    }
  }, [restaurantCode, tableNumber]);

  const fetchOrderStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/public/order-status`, {
        params: {
          restaurant: restaurantCode,
          table: tableNumber,
          sessionId
        }
      });

      setOrder(response.data.order || null);
      if (response.data.order?.status) {
        setStatusNotice(`Order ${formatOrderSerial(response.data.order)} is ${normalizeStatus(response.data.order.status).label.toLowerCase()}.`);
      }
    } catch (error) {
      console.error(error);
    }
  }, [restaurantCode, sessionId, tableNumber]);

  useEffect(() => {
    fetchMenu();
    fetchOrderStatus();

    const refreshStatus = (incomingOrder) => {
      const sameTable = String(incomingOrder?.table_number) === String(tableNumber);
      const sameRestaurant = String(incomingOrder?.restaurant_code || 'smartcafe_main') === String(restaurantCode);
      if (sameTable && sameRestaurant) {
        setLiveSyncMessage(`Live update received for table ${tableNumber}.`);
        fetchMenu();
        fetchOrderStatus();
      }
    };

    const handleReconnect = () => {
      setSocketConnected(true);
      setLiveSyncMessage('Realtime connection restored for this table.');
      fetchMenu();
      fetchOrderStatus();
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
      setLiveSyncMessage('Realtime connection lost. Auto-refresh is still running for this table.');
    };

    socket.on('newOrder', refreshStatus);
    socket.on('orderUpdated', refreshStatus);
    socket.on('orderStatusUpdated', refreshStatus);
    socket.on('orderCustomerUpdated', refreshStatus);
    socket.on('menuUpdated', fetchMenu);
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', refreshStatus);
      socket.off('orderUpdated', refreshStatus);
      socket.off('orderStatusUpdated', refreshStatus);
      socket.off('orderCustomerUpdated', refreshStatus);
      socket.off('menuUpdated', fetchMenu);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchMenu, fetchOrderStatus, restaurantCode, sessionId, tableNumber]);

  useEffect(() => {
    const refreshPublicOrderData = () => {
      fetchMenu();
      fetchOrderStatus();
    };

    const fallbackInterval = window.setInterval(() => {
      refreshPublicOrderData();
    }, LIVE_REFRESH_MS);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshPublicOrderData();
      }
    };

    window.addEventListener('focus', refreshPublicOrderData);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', refreshPublicOrderData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchMenu, fetchOrderStatus]);

  const categoryList = useMemo(() => (
    ['All', ...Array.from(new Set(menu.map((item) => item.category).filter(Boolean)))]
  ), [menu]);

  const filteredMenu = useMemo(() => {
    const query = deferredSearchTerm.trim().toLowerCase();

    return menu.filter((item) => {
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      const matchesSearch = !query || String(item.name || '').toLowerCase().includes(query) || String(item.category || '').toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [menu, selectedCategory, deferredSearchTerm]);

  const groupedMenu = useMemo(() => {
    const groups = filteredMenu.reduce((acc, item) => {
      const category = item.category || 'Menu';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    return Object.entries(groups);
  }, [filteredMenu]);

  const popularItems = useMemo(() => (
    [...menu]
      .sort((left, right) => getPopularScore(right) - getPopularScore(left))
      .slice(0, 4)
  ), [menu]);

  const cartCount = useMemo(() => (
    cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
  ), [cart]);

  const cartTotal = useMemo(() => (
    cart.reduce((sum, item) => sum + (Number(item.price || 0) * Number(item.quantity || 0)), 0)
  ), [cart]);

  const getCartItem = (menuId) => cart.find((item) => item.menu_id === menuId);

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

      return [...prev, {
        menu_id: item.id,
        quantity: 1,
        name: item.name,
        price: item.price,
        category: item.category
      }];
    });
  };

  const updateQuantity = (menuId, delta) => {
    setCart((prev) => prev
      .map((item) => (item.menu_id === menuId ? { ...item, quantity: item.quantity + delta } : item))
      .filter((item) => item.quantity > 0));
  };

  const scrollToCart = () => {
    cartSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const jumpToCategory = (category) => {
    setSelectedCategory(category);
    if (category === 'All') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    window.setTimeout(() => {
      categoryRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const repeatLastOrder = () => {
    if (!order?.items?.length) return;

    setCart(
      order.items.map((item) => ({
        menu_id: item.menu_id,
        quantity: Number(item.quantity || 0),
        name: item.menu_item?.name || 'Item',
        price: Number(item.menu_item?.price || 0),
        category: item.menu_item?.category || ''
      }))
    );
    scrollToCart();
    setNotice('Last order copied into your cart.');
  };

  const placeOrder = async () => {
    if (!cart.length) {
      setNotice('Add items before placing the order.');
      return;
    }

    setSubmitting(true);
    setNotice('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/public/order`, {
        restaurantCode,
        tableNumber: Number(tableNumber),
        sessionId,
        customerName,
        customerPhone,
        paymentMethod,
        specialInstructions,
        items: cart.map((item) => ({
          menu_id: item.menu_id,
          quantity: item.quantity
        })),
        order_source: 'qr'
      });

      setOrder(response.data.order || null);
      setCart([]);
      setSpecialInstructions('');
      setBillNotice('');
      setNotice(response.data.mergedIntoExisting ? 'Items added to your active table order.' : 'Order placed successfully.');
      fetchMenu();
      fetchOrderStatus();
    } catch (error) {
      console.error(error);
      setNotice(error.response?.data?.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadBill = () => {
    if (!order) return;

    try {
      downloadBillPdf(order, customerName, customerPhone);
      setBillNotice('Bill PDF downloaded successfully.');
    } catch (error) {
      console.error(error);
      setBillNotice('Failed to download the bill PDF.');
    }
  };

  const handleSendWhatsAppBill = () => {
    if (!order) return;

    const phone = sanitizePhoneForWhatsApp(customerPhone || order.customer_phone || '');
    if (phone.length < 10) {
      setBillNotice('Enter a valid mobile number to receive the bill on WhatsApp.');
      return;
    }

    try {
      const message = encodeURIComponent(buildWhatsAppBillMessage(order, customerName));
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
      setBillNotice('WhatsApp opened with your bill summary.');
    } catch (error) {
      console.error(error);
      setBillNotice('Failed to open WhatsApp for bill sharing.');
    }
  };

  const currentStatus = normalizeStatus(order?.status);

  return (
    <div className="dashboard-page pb-28">
      <div className="dashboard-shell space-y-6">
        <div className="dashboard-hero">
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_360px]">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.26em] text-white">
                SmartCafe QR Dining
              </div>
              <Typography variant="h3" className="mt-4 font-black tracking-tight text-slate-900">
                Table {tableNumber || '--'} ordering
              </Typography>
              <Typography className="mt-3 max-w-2xl text-sm text-slate-600 md:text-base">
                Browse the live menu, add items in one tap, and track your order in real time while the kitchen prepares it.
              </Typography>
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                {socketConnected ? 'Realtime connected' : 'Realtime reconnecting'}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <Typography className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Restaurant</Typography>
                  <Typography className="mt-1 text-sm font-bold text-slate-900">{restaurantCode}</Typography>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <Typography className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Live Menu Items</Typography>
                  <Typography className="mt-1 text-sm font-bold text-slate-900">{menu.length}</Typography>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                  <Typography className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-400">Active Cart</Typography>
                  <Typography className="mt-1 text-sm font-bold text-slate-900">{cartCount} items</Typography>
                </div>
              </div>
            </div>

            <div className="min-w-0 rounded-[30px] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-900 p-5 text-white shadow-[0_24px_60px_-36px_rgba(2,6,23,0.85)]">
              <Typography className="text-xs font-black uppercase tracking-[0.28em] text-slate-300">Order tracking</Typography>
              {order ? (
                <>
                  <Typography className="mt-4 text-3xl font-black">#{formatOrderSerial(order)}</Typography>
                  <Typography className="mt-2 text-sm text-slate-300">{formatOrderLocation(order)}</Typography>
                  <div className={`mt-5 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${currentStatus.tone}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${currentStatus.accent}`} />
                    {currentStatus.label}
                  </div>
                  <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                    {['pending', 'preparing', 'ready'].map((step, index) => {
                      const activeIndex = ['pending', 'preparing', 'ready', 'served'].indexOf(order.status);
                      const isComplete = activeIndex >= index;
                      return (
                        <div key={step} className={`rounded-2xl border px-3 py-3 ${isComplete ? 'border-emerald-400/40 bg-emerald-500/15 text-white' : 'border-white/10 bg-white/5 text-slate-300'}`}>
                          <Typography className="text-[11px] font-black uppercase tracking-[0.18em]">{normalizeStatus(step).label}</Typography>
                        </div>
                      );
                    })}
                  </div>
                  {order.special_instructions ? (
                    <Typography className="mt-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Note: {order.special_instructions}
                    </Typography>
                  ) : null}
                  <Button
                    variant="contained"
                    fullWidth
                    className="mt-5 rounded-2xl bg-white py-3 font-black text-slate-900 hover:bg-slate-100"
                    onClick={repeatLastOrder}
                  >
                    Order Again
                  </Button>
                </>
              ) : (
                <>
                  <Typography className="mt-4 text-2xl font-black">Kitchen updates live here</Typography>
                  <Typography className="mt-3 text-sm text-slate-300">
                    Once you place your order, this panel will update automatically from pending to preparing to ready.
                  </Typography>
                </>
              )}
            </div>
          </div>
        </div>

        {notice ? <Alert severity="info" className="rounded-2xl">{notice}</Alert> : null}
        {statusNotice ? <Alert severity="success" className="rounded-2xl">{statusNotice}</Alert> : null}
        <Alert severity={socketConnected ? 'success' : 'warning'} className="rounded-2xl">
          {liveSyncMessage}
        </Alert>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
          <div className="min-w-0 space-y-6">
            <div className="dashboard-panel p-4">
              <TextField
                label="Search food or drinks"
                placeholder="Coffee, brownie, sandwich..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                fullWidth
              />
              <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
                {categoryList.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => jumpToCategory(category)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                      selectedCategory === category
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'border border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {popularItems.length ? (
              <div className="dashboard-panel p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <Typography className="text-xs font-black uppercase tracking-[0.28em] text-rose-500">Popular Picks</Typography>
                    <Typography variant="h5" className="mt-2 font-black text-slate-900">Recommended for this table</Typography>
                  </div>
                  <div className="inline-flex w-fit rounded-full bg-rose-100 px-4 py-2 text-sm font-bold text-rose-700">Hot right now</div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {popularItems.map((item) => (
                    <div key={`popular-${item.id}`} className="overflow-hidden rounded-[26px] border border-slate-200 bg-slate-50">
                      <img src={getMenuImage(item)} alt={item.name} className="h-36 w-full object-cover" />
                      <div className="p-4">
                        <Typography className="font-black text-slate-900">{item.name}</Typography>
                        <Typography className="mt-1 text-sm text-slate-500">{item.category} • {getPrepTimeLabel(item)}</Typography>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <Typography className="text-lg font-black text-emerald-600">{formatCurrency(item.price)}</Typography>
                          <Button variant="contained" className="rounded-full bg-slate-900 px-4 font-bold" onClick={() => addToCart(item)}>
                            + Add
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {groupedMenu.length ? groupedMenu.map(([category, items]) => (
              <section
                key={category}
                ref={(node) => { categoryRefs.current[category] = node; }}
                className="dashboard-panel p-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <Typography className="text-xs font-black uppercase tracking-[0.26em] text-slate-400">{category}</Typography>
                    <Typography variant="h5" className="mt-2 font-black text-slate-900">{items.length} items ready to order</Typography>
                  </div>
                  <Typography className="text-sm text-slate-500">Live menu visibility and pricing synced from the restaurant dashboard.</Typography>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                  {items.map((item) => {
                    const cartItem = getCartItem(item.id);
                    const availability = getAvailabilityMeta(item);

                    return (
                      <Card key={item.id} className="overflow-hidden rounded-[28px] border border-white/80 bg-white/92 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.34)]">
                        <CardMedia
                          component="img"
                          height="160"
                          image={getMenuImage(item)}
                          alt={item.name}
                          className="h-44 object-cover"
                        />
                        <CardContent className="flex h-full flex-col space-y-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <Typography variant="h6" className="font-black text-slate-900">{item.name}</Typography>
                              <Typography className="mt-1 text-sm text-slate-500">{item.category} • Prep {getPrepTimeLabel(item)}</Typography>
                            </div>
                            <Typography className="shrink-0 text-lg font-black text-emerald-600">{formatCurrency(item.price)}</Typography>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${availability.tone}`}>{availability.label}</span>
                            <span className={`rounded-full px-3 py-1 text-xs font-bold ${normalizeMenuItemType(item.item_type) === 'Non Veg' ? 'bg-rose-100 text-rose-700' : 'bg-lime-100 text-lime-700'}`}>
                              {normalizeMenuItemType(item.item_type)}
                            </span>
                            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                              Stock {Number(item.stock_quantity || 0)}
                            </span>
                          </div>

                          {cartItem ? (
                            <div className="mt-auto flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                              <Typography className="text-sm font-bold text-slate-700">In cart</Typography>
                              <div className="flex items-center gap-2">
                                <button type="button" onClick={() => updateQuantity(item.id, -1)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-lg font-black text-slate-900">
                                  -
                                </button>
                                <span className="min-w-[26px] text-center font-black text-slate-900">{cartItem.quantity}</span>
                                <button type="button" onClick={() => updateQuantity(item.id, 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-lg font-black text-white">
                                  +
                                </button>
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="contained"
                              fullWidth
                              className="mt-auto rounded-2xl bg-slate-900 py-3 font-black"
                              disabled={!item.available || Number(item.stock_quantity || 0) < 1}
                              onClick={() => addToCart(item)}
                            >
                              + Add to Cart
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )) : (
              <div className="dashboard-panel border-dashed border-slate-300 p-10 text-center">
                <Typography variant="h5" className="font-black text-slate-900">No items match this search</Typography>
                <Typography className="mt-3 text-slate-500">Try another category or clear the search to see the full live menu.</Typography>
              </div>
            )}
          </div>

          <div ref={cartSectionRef} className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
            <Card className="dashboard-panel overflow-hidden">
              <CardContent className="space-y-4 p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Typography variant="h5" className="font-black text-slate-900">Your cart</Typography>
                    <Typography className="mt-1 text-sm text-slate-500">Review items before sending them to the kitchen.</Typography>
                  </div>
                  <div className="shrink-0 rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-white">{cartCount}</div>
                </div>

                <TextField
                  label="Name (optional)"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  fullWidth
                />
                <TextField
                  label="Mobile Number (optional)"
                  value={customerPhone}
                  onChange={(event) => setCustomerPhone(event.target.value)}
                  fullWidth
                />
                <TextField
                  select
                  label="Payment Method"
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  fullWidth
                >
                  <MenuItem value="pay_at_counter">Pay at Counter</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                </TextField>
                <TextField
                  label="Special Instructions"
                  value={specialInstructions}
                  onChange={(event) => setSpecialInstructions(event.target.value)}
                  fullWidth
                  multiline
                  minRows={3}
                  placeholder="Less sugar, no ice, serve together..."
                />

                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.menu_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Typography className="font-bold text-slate-900">{item.name}</Typography>
                          <Typography className="text-sm text-slate-500">{item.category} • {formatCurrency(item.price)} each</Typography>
                        </div>
                        <Typography className="shrink-0 font-black text-slate-900">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</Typography>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button variant="outlined" size="small" onClick={() => updateQuantity(item.menu_id, -1)}>-</Button>
                        <span className="min-w-[24px] text-center font-semibold">{item.quantity}</span>
                        <Button variant="outlined" size="small" onClick={() => updateQuantity(item.menu_id, 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                  {!cart.length ? (
                    <Typography className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm italic text-slate-500">
                      Add items from the menu to start your table order.
                    </Typography>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <Typography className="text-sm font-semibold text-slate-500">Items</Typography>
                    <Typography className="font-black text-slate-900">{cartCount}</Typography>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Typography className="text-sm font-semibold text-slate-500">Payment</Typography>
                    <Typography className="font-black text-slate-900">{paymentMethod === 'upi' ? 'UPI' : 'Pay at Counter'}</Typography>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Typography className="text-sm font-semibold text-slate-500">Total</Typography>
                    <Typography variant="h6" className="font-black text-emerald-700">{formatCurrency(cartTotal)}</Typography>
                  </div>
                </div>

                <Button
                  variant="contained"
                  fullWidth
                  className="rounded-2xl bg-emerald-600 py-3 font-black"
                  disabled={submitting || !cart.length}
                  onClick={placeOrder}
                >
                  {submitting ? 'Placing Order...' : 'Place Order'}
                </Button>
              </CardContent>
            </Card>

            {order ? (
              <Card className="dashboard-panel overflow-hidden">
                <CardContent className="space-y-4 p-6">
                  <Typography variant="h6" className="font-black text-slate-900">Order details</Typography>
                  <Typography className="text-sm text-slate-500">
                    Order #{formatOrderSerial(order)} • {formatOrderLocation(order)}
                  </Typography>
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold ${currentStatus.tone}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${currentStatus.accent}`} />
                    {currentStatus.label}
                  </div>
                  <div className="space-y-2">
                    {(order.items || []).map((item) => (
                      <div key={`${order.id}-${item.id}`} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2">
                        <Typography className="text-sm font-medium text-slate-800">{item.quantity}x {item.menu_item?.name || 'Item'}</Typography>
                        <Typography className="text-sm text-slate-500">{formatCurrency(Number(item.menu_item?.price || 0) * Number(item.quantity || 0))}</Typography>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <Typography className="text-sm font-semibold text-emerald-800">Bill Total</Typography>
                      <Typography className="text-lg font-black text-emerald-700">{formatCurrency(getOrderTotal(order))}</Typography>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Typography className="text-sm font-black uppercase tracking-[0.2em] text-slate-500">Bill options</Typography>
                    <Typography className="mt-2 text-sm text-slate-600">
                      After placing your order, you can download the bill PDF or send the bill summary to WhatsApp.
                    </Typography>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Button
                        variant="contained"
                        className="rounded-2xl bg-slate-900 py-3 font-black"
                        onClick={handleDownloadBill}
                      >
                        Download Bill PDF
                      </Button>
                      <Button
                        variant="outlined"
                        className="rounded-2xl py-3 font-black"
                        onClick={handleSendWhatsAppBill}
                      >
                        Receive via WhatsApp
                      </Button>
                    </div>
                    {billNotice ? (
                      <Typography className="mt-3 text-sm font-medium text-slate-600">{billNotice}</Typography>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>

      {cart.length ? (
        <div className="fixed inset-x-0 bottom-0 z-[90] border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-18px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur xl:hidden">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
            <div>
              <Typography className="text-sm font-black text-slate-900">Cart {cartCount} items</Typography>
              <Typography className="text-sm text-slate-500">{formatCurrency(cartTotal)}</Typography>
            </div>
            <Button variant="contained" className="rounded-full bg-slate-900 px-5 font-black" onClick={scrollToCart}>
              View Cart
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PublicOrderPage;
