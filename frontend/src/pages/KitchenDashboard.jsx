import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  AccessTime,
  AlarmOn,
  BedroomParent,
  CheckCircle,
  Fastfood,
  HourglassTop,
  Inventory,
  Kitchen,
  NotificationsActive,
  NotificationsOff,
  Restaurant,
  Schedule,
  SoupKitchen,
  Sync
} from '@mui/icons-material';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';
import KitchenChatbot from '../components/KitchenChatbot';
const ALERT_AUDIO_URL = 'https://www.soundjay.com/misc/bell-ringing-05.mp3';
const LIVE_REFRESH_MS = 5000;

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
};

const playBellSound = async (audioContext, audioElement) => {
  try {
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      return true;
    }

    if (audioElement) {
      audioElement.currentTime = 0;
      await audioElement.play();
      return true;
    }
  } catch (error) {
    console.log('Kitchen alert sound failed', error);
  }

  return false;
};

const getUrgencyMeta = (createdAt, now) => {
  if (!createdAt) return { label: 'Unknown age', tone: 'bg-slate-100 text-slate-700 border-slate-200' };
  const ageMinutes = Math.floor((now - new Date(createdAt).getTime()) / 60000);
  if (ageMinutes >= 20) return { label: `Critical ${ageMinutes}m`, tone: 'bg-red-100 text-red-700 border-red-300 shadow-red-100' };
  if (ageMinutes >= 10) return { label: `Watch ${ageMinutes}m`, tone: 'bg-amber-100 text-amber-700 border-amber-300 shadow-amber-100' };
  return { label: `On time ${Math.max(ageMinutes, 0)}m`, tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
};

const getOrderAgeMinutes = (createdAt, now, delayMinutes = 0) => {
  if (!createdAt) return 0;
  return Math.max(0, Math.floor((now - new Date(createdAt).getTime()) / 60000) + Number(delayMinutes || 0));
};

const getTimerMeta = (createdAt, now, delayMinutes = 0) => {
  const ageMinutes = getOrderAgeMinutes(createdAt, now, delayMinutes);
  if (ageMinutes >= 15) return { label: `${ageMinutes} min`, tone: 'bg-red-100 text-red-700 border-red-300', hint: 'Delayed' };
  if (ageMinutes >= 8) return { label: `${ageMinutes} min`, tone: 'bg-amber-100 text-amber-700 border-amber-300', hint: 'Watch' };
  return { label: `${ageMinutes} min`, tone: 'bg-emerald-100 text-emerald-700 border-emerald-300', hint: 'On time' };
};

const getStatusColor = (status) => {
  switch (status) {
    case 'pending': return 'bg-rose-100 text-rose-800 border border-rose-200';
    case 'preparing': return 'bg-sky-100 text-sky-800 border border-sky-200';
    case 'ready': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getHandoverLabel = (value) => {
  if (value === 'waiter') return 'Handed to waiter';
  if (value === 'customer') return 'Handed to customer';
  return 'Completed';
};

const getSourceMeta = (order) => {
  if (order?.order_source === 'qr') {
    return { label: 'QR', detail: 'QR Order', tone: 'bg-violet-100 text-violet-700 border-violet-200' };
  }
  return { label: 'Waiter', detail: 'Waiter Order', tone: 'bg-sky-100 text-sky-700 border-sky-200' };
};

const getPriorityMeta = (order, now, delayMinutes = 0) => {
  const ageMinutes = getOrderAgeMinutes(order?.created_at, now, delayMinutes);
  if (ageMinutes >= 15) return { label: 'Delayed', tone: 'bg-red-100 text-red-700 border-red-200' };
  if (order?.order_source === 'qr') return { label: 'Priority', tone: 'bg-amber-100 text-amber-700 border-amber-200' };
  return null;
};

const groupOrderItemsByCategory = (items = []) => items.reduce((groups, item) => {
  const category = item.menu_item?.category || 'Kitchen';
  if (!groups[category]) groups[category] = [];
  groups[category].push(item);
  return groups;
}, {});

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || 0) * item.quantity)
  ), 0)
);

const mergeKitchenOrder = (orders, incomingOrder) => {
  const exists = orders.some((order) => order.id === incomingOrder.id);
  if (!exists) {
    return [incomingOrder, ...orders];
  }
  return orders.map((order) => (order.id === incomingOrder.id ? incomingOrder : order));
};

const getHistoryRangeStart = (range) => {
  if (range === 'all') return null;

  const now = new Date();
  if (range === 'day') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (range === 'week') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    start.setDate(start.getDate() - 6);
    return start;
  }
  if (range === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }
  if (range === 'year') {
    return new Date(now.getFullYear(), 0, 1);
  }

  return null;
};

// --- Enhanced Sidebar Component ---
const KitchenSidebar = ({ metrics, muted, onToggleMute }) => (
  <div className="z-20 flex w-full flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 shadow-xl xl:sticky xl:top-24 xl:h-[calc(100vh-7rem)] xl:w-[320px] xl:flex-shrink-0">
    {/* Header */}
    <div className="p-6 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
          <Kitchen className="text-white text-2xl" />
        </div>
        <div>
          <Typography variant="h5" className="font-bold text-slate-800 tracking-tight">Kitchen OS</Typography>
          <Typography variant="body2" className="text-slate-500">Live Dashboard</Typography>
        </div>
      </div>
    </div>

    {/* Metrics Area */}
    <div className="flex-1 p-4 space-y-3 overflow-y-auto xl:pr-1">
      <Typography variant="overline" className="text-slate-500 pl-2 font-bold">Queue Metrics</Typography>
      
      {metrics.map((metric, index) => (
        <div 
          key={index} 
          className={`p-4 rounded-2xl transition-all duration-300 hover:scale-[1.02] ${metric.bgClass || 'bg-white'} shadow-sm border border-slate-100`}
        >
          <div className="flex justify-between items-start">
            <div>
              <Typography variant="body2" className="text-slate-500 font-medium mb-1">
                {metric.label}
              </Typography>
              <Typography variant="h4" className={`font-bold ${metric.textClass || 'text-slate-800'}`}>
                {metric.value}
              </Typography>
            </div>
            <div className={`p-2 rounded-lg ${metric.iconBg || 'bg-slate-100'}`}>
              {metric.icon}
            </div>
          </div>
          {metric.hint && (
            <Typography variant="caption" className="text-slate-400 mt-2 block">
              {metric.hint}
            </Typography>
          )}
        </div>
      ))}
    </div>

    {/* Footer Controls */}
    <div className="p-4 border-t border-slate-200 bg-white">
      <div className="flex items-center justify-between bg-slate-100 rounded-xl p-3">
        <div className="flex items-center gap-2">
          {muted ? (
            <NotificationsOff className="text-slate-500" />
          ) : (
            <NotificationsActive className="text-orange-500 animate-pulse" />
          )}
          <Typography variant="body2" className="font-medium text-slate-700">
            {muted ? 'Sound Off' : 'Sound On'}
          </Typography>
        </div>
        <IconButton 
          onClick={onToggleMute} 
          className={muted ? 'bg-slate-300' : 'bg-orange-500 text-white hover:bg-orange-600'}
          size="small"
        >
          {muted ? <NotificationsOff fontSize="small" /> : <NotificationsActive fontSize="small" />}
        </IconButton>
      </div>
    </div>
  </div>
);

const KitchenDashboard = () => {
  const currentUser = getStoredUser();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [sortBy, setSortBy] = useState('oldest');
  const [search, setSearch] = useState('');
  const [muted, setMuted] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [recentlyUpdatedOrderIds, setRecentlyUpdatedOrderIds] = useState([]);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [connectionNotice, setConnectionNotice] = useState('Kitchen realtime is active.');
  const [delayMinutesByOrder, setDelayMinutesByOrder] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [draggedOrderId, setDraggedOrderId] = useState(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyRange, setHistoryRange] = useState('week');
  const mutedRef = useRef(muted);
  const audioContextRef = useRef(null);
  const fallbackAudioRef = useRef(null);

  const fetchOrders = () => {
    axios.get(`${API_BASE_URL}/api/orders`)
      .then((res) => setOrders(res.data.orders || []))
      .catch(console.error);
  };

  const unlockAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = getAudioContext();
      }

      if (!fallbackAudioRef.current) {
        fallbackAudioRef.current = new Audio(ALERT_AUDIO_URL);
        fallbackAudioRef.current.preload = 'auto';
      }

      if (audioContextRef.current?.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      setAudioReady(Boolean(audioContextRef.current || fallbackAudioRef.current));
      return true;
    } catch (error) {
      console.log('Audio unlock failed', error);
      setAudioReady(false);
      return false;
    }
  };

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    unlockAudio().catch(console.error);
  }, []);

  useEffect(() => {
    fetchOrders();
    socket.emit('join_kitchen');

    const handleNewOrder = (order) => {
      if (!mutedRef.current) {
        playBellSound(audioContextRef.current, fallbackAudioRef.current).catch(console.error);
      }
      setNewOrderFlash(true);
      setTimeout(() => setNewOrderFlash(false), 2000);
      setOrders((prev) => {
        const deduped = prev.filter((o) => o.id !== order.id);
        return [order, ...deduped];
      });
    };

    const handleOrderUpdated = (updatedOrder) => {
      setOrders((prev) => mergeKitchenOrder(prev, updatedOrder));
    };

    const handleItemsAdded = (updatedOrder) => {
      if (!mutedRef.current) {
        playBellSound(audioContextRef.current, fallbackAudioRef.current).catch(console.error);
      }
      setOrders((prev) => mergeKitchenOrder(prev, updatedOrder));
      setRecentlyUpdatedOrderIds((prev) => [...new Set([updatedOrder.id, ...prev])]);
      window.setTimeout(() => {
        setRecentlyUpdatedOrderIds((prev) => prev.filter((id) => id !== updatedOrder.id));
      }, 120000);
    };

    const handleReconnect = () => {
      setSocketConnected(true);
      setConnectionNotice('Realtime connection restored. Kitchen queue resynced.');
      fetchOrders();
      socket.emit('join_kitchen');
    };
    const handleDisconnect = () => {
      setSocketConnected(false);
      setConnectionNotice('Realtime connection lost. Fallback refresh is keeping kitchen updated.');
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderUpdated);
    socket.on('orderUpdated', handleItemsAdded);
    socket.on('orderCustomerUpdated', handleOrderUpdated);
    socket.on('connect', handleReconnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderUpdated);
      socket.off('orderUpdated', handleItemsAdded);
      socket.off('orderCustomerUpdated', handleOrderUpdated);
      socket.off('connect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    const fallbackInterval = window.setInterval(() => {
      fetchOrders();
    }, LIVE_REFRESH_MS);

    const refreshOrders = () => {
      fetchOrders();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        refreshOrders();
      }
    };

    window.addEventListener('focus', refreshOrders);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(fallbackInterval);
      window.removeEventListener('focus', refreshOrders);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(interval);
  }, []);

  const updateStatus = (id, status, extra = {}) => {
    axios.put(`${API_BASE_URL}/api/orders/${id}/status`, { status, ...extra }).catch(console.error);
  };

  const applyDelay = (orderId, minutes) => {
    setDelayMinutesByOrder((prev) => ({
      ...prev,
      [orderId]: Number(prev[orderId] || 0) + minutes
    }));
  };

  const activeOrders = orders.filter((order) => !['served', 'waiting_bill', 'completed', 'cancelled'].includes(order.status));
  const readyOrders = activeOrders.filter((order) => order.status === 'ready');
  const preparingOrders = activeOrders.filter((order) => order.status === 'preparing');
  const pendingOrders = activeOrders.filter((order) => order.status === 'pending');
  
  const tableOptions = [...new Set(activeOrders.map((order) => order.table_label || `Table ${order.table_number}`))];
  
  const totalItemsInQueue = activeOrders.reduce((total, order) => (
    total + (order.items || []).reduce((sum, item) => sum + item.quantity, 0)
  ), 0);
  
  const averageAgeMinutes = activeOrders.length > 0
    ? Math.round(activeOrders.reduce((sum, order) => (
      sum + Math.floor((now - new Date(order.created_at).getTime()) / 60000)
    ), 0) / activeOrders.length)
    : 0;
  const completedOrdersCount = orders.filter((order) => ['served', 'waiting_bill', 'completed'].includes(order.status)).length;
  const delayedOrdersCount = activeOrders.filter((order) => getOrderAgeMinutes(order.created_at, now, delayMinutesByOrder[order.id]) >= 15).length;
  const prepDurations = orders
    .filter((order) => order.preparing_at && (order.ready_at || order.served_at))
    .map((order) => {
      const start = new Date(order.preparing_at).getTime();
      const end = new Date(order.ready_at || order.served_at).getTime();
      if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
      return Math.round((end - start) / 60000);
    })
    .filter((value) => value > 0);
  const averagePrepTime = prepDurations.length
    ? Math.round(prepDurations.reduce((sum, value) => sum + value, 0) / prepDurations.length)
    : 0;

  // Sidebar Metrics with Icons
  const sidebarMetrics = [
    { 
      label: 'Pending Orders', 
      value: pendingOrders.length, 
      hint: 'Orders waiting to start', 
      icon: <HourglassTop className="text-rose-600" />, 
      bgClass: 'bg-rose-50',
      textClass: 'text-rose-700',
      iconBg: 'bg-rose-100'
    },
    { 
      label: 'Preparing', 
      value: preparingOrders.length, 
      hint: 'Currently active', 
      icon: <SoupKitchen className="text-sky-600" />, 
      bgClass: 'bg-sky-50',
      textClass: 'text-sky-700',
      iconBg: 'bg-sky-100'
    },
    { 
      label: 'Ready for Pickup', 
      value: readyOrders.length, 
      hint: 'Ready to serve', 
      icon: <CheckCircle className="text-emerald-600" />, 
      bgClass: 'bg-emerald-50',
      textClass: 'text-emerald-700',
      iconBg: 'bg-emerald-100'
    },
    { 
      label: 'Items in Queue', 
      value: totalItemsInQueue, 
      hint: 'Total items to prep', 
      icon: <Fastfood className="text-amber-600" />, 
      bgClass: 'bg-amber-50',
      textClass: 'text-amber-700',
      iconBg: 'bg-amber-100'
    },
    { 
      label: 'Avg Order Age', 
      value: `${averageAgeMinutes}m`, 
      hint: 'Time since order', 
      icon: <AccessTime className="text-indigo-600" />, 
      bgClass: 'bg-indigo-50',
      textClass: 'text-indigo-700',
      iconBg: 'bg-indigo-100'
    },
    {
      label: 'Avg Prep Time',
      value: `${averagePrepTime}m`,
      hint: 'Kitchen completion speed',
      icon: <Schedule className="text-fuchsia-600" />,
      bgClass: 'bg-fuchsia-50',
      textClass: 'text-fuchsia-700',
      iconBg: 'bg-fuchsia-100'
    },
    {
      label: 'Orders Completed',
      value: completedOrdersCount,
      hint: 'Finished and handed off',
      icon: <Restaurant className="text-slate-700" />,
      bgClass: 'bg-slate-100',
      textClass: 'text-slate-800',
      iconBg: 'bg-slate-200'
    },
    {
      label: 'Delayed Orders',
      value: delayedOrdersCount,
      hint: '15 min and above',
      icon: <AlarmOn className="text-red-600" />,
      bgClass: 'bg-red-50',
      textClass: 'text-red-700',
      iconBg: 'bg-red-100'
    }
  ];

  const filteredOrders = activeOrders
    .filter((order) => statusFilter === 'all' || order.status === statusFilter)
    .filter((order) => tableFilter === 'all' || (order.table_label || `Table ${order.table_number}`) === tableFilter)
    .filter((order) => {
      if (!search.trim()) return true;
      const query = search.trim().toLowerCase();
      const itemNames = (order.items || []).map((item) => item.menu_item?.name || '').join(' ').toLowerCase();
      return (
        String(order.id).includes(query) ||
        String(order.serial_no || '').includes(query) ||
        String(order.table_number).includes(query) ||
        (order.table_label || '').toLowerCase().includes(query) ||
        order.status.toLowerCase().includes(query) ||
        itemNames.includes(query)
      );
    })
    .sort((a, b) => {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return sortBy === 'oldest' ? aTime - bTime : bTime - aTime;
    });

  const pendingColumnOrders = filteredOrders.filter((order) => order.status === 'pending');
  const preparingColumnOrders = filteredOrders.filter((order) => order.status === 'preparing');
  const readyColumnOrders = filteredOrders.filter((order) => order.status === 'ready');
  const historyRangeStart = useMemo(() => getHistoryRangeStart(historyRange), [historyRange]);
  const historicalOrders = useMemo(() => (
    [...orders].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
  ), [orders]);
  const filteredHistoryOrders = useMemo(() => {
    const query = historySearch.trim().toLowerCase();

    return historicalOrders
      .filter((order) => {
        if (!historyRangeStart) return true;
        const createdAt = new Date(order.created_at);
        return createdAt >= historyRangeStart;
      })
      .filter((order) => {
        if (!query) return true;
        const itemNames = (order.items || []).map((item) => item.menu_item?.name || '').join(' ').toLowerCase();
        return (
          String(order.id).includes(query) ||
          String(order.serial_no || '').includes(query) ||
          String(order.table_number || '').includes(query) ||
          (order.table_label || '').toLowerCase().includes(query) ||
          (order.customer_name || '').toLowerCase().includes(query) ||
          String(order.status || '').toLowerCase().includes(query) ||
          itemNames.includes(query)
        );
      });
  }, [historicalOrders, historyRangeStart, historySearch]);
  const historyTotalItems = useMemo(() => (
    filteredHistoryOrders.reduce((sum, order) => (
      sum + (order.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0)
    ), 0)
  ), [filteredHistoryOrders]);
  const historyRevenue = useMemo(() => (
    filteredHistoryOrders
      .filter((order) => order.status !== 'cancelled')
      .reduce((sum, order) => sum + getOrderTotal(order), 0)
  ), [filteredHistoryOrders]);
  const historyCompletedCount = useMemo(() => (
    filteredHistoryOrders.filter((order) => ['served', 'waiting_bill', 'completed'].includes(order.status)).length
  ), [filteredHistoryOrders]);
  const historyCancelledCount = useMemo(() => (
    filteredHistoryOrders.filter((order) => order.status === 'cancelled').length
  ), [filteredHistoryOrders]);
  const historyPrepDurations = useMemo(() => (
    filteredHistoryOrders
      .filter((order) => order.preparing_at && (order.ready_at || order.served_at))
      .map((order) => {
        const start = new Date(order.preparing_at).getTime();
        const end = new Date(order.ready_at || order.served_at).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
        return Math.round((end - start) / 60000);
      })
      .filter((value) => value > 0)
  ), [filteredHistoryOrders]);
  const historyAveragePrepTime = historyPrepDurations.length
    ? Math.round(historyPrepDurations.reduce((sum, value) => sum + value, 0) / historyPrepDurations.length)
    : 0;
  const historyTopItems = useMemo(() => {
    const itemMap = new Map();

    filteredHistoryOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const itemName = item.menu_item?.name || 'Item';
        const current = itemMap.get(itemName) || { name: itemName, quantity: 0 };
        current.quantity += Number(item.quantity || 0);
        itemMap.set(itemName, current);
      });
    });

    return [...itemMap.values()]
      .sort((left, right) => right.quantity - left.quantity)
      .slice(0, 5);
  }, [filteredHistoryOrders]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-layout">
      {/* New Enhanced Sidebar */}
      <KitchenSidebar 
        metrics={sidebarMetrics} 
        muted={muted} 
        onToggleMute={async () => {
          if (muted) {
            const ready = await unlockAudio();
            if (ready) {
              await playBellSound(audioContextRef.current, fallbackAudioRef.current);
            }
          }
          setMuted((prev) => !prev);
        }} 
      />

      {/* Main Content Area */}
      <div className={`dashboard-main dashboard-content-surface transition-colors duration-500 ${newOrderFlash ? 'bg-orange-50/50' : ''}`}>
        <div className="dashboard-shell dashboard-stack">
        <div className="dashboard-hero">
          <div className="dashboard-kicker">Kitchen Flow</div>
          <Typography className="mt-3 text-sm font-semibold text-slate-500">
            Welcome, {currentUser?.name || 'Chef'}
          </Typography>
          <Typography variant="h4" className="dashboard-title mt-3">Kitchen Command View</Typography>
          <Typography className="dashboard-subtitle">
            Manage live tickets, handoffs, and kitchen timing from one structured command center.
          </Typography>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-slate-600 shadow-sm">
            <span className={`h-2.5 w-2.5 rounded-full ${socketConnected ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {socketConnected ? 'Realtime connected' : 'Realtime reconnecting'}
          </div>
        </div>

        <Alert
          severity={socketConnected ? 'success' : 'warning'}
          className="mb-8 rounded-2xl border border-slate-200/60 bg-white/90 shadow-sm"
          icon={socketConnected ? <Sync className="text-emerald-600" /> : <NotificationsActive className="text-amber-600" />}
        >
          <span className={`font-bold ${socketConnected ? 'text-emerald-800' : 'text-amber-800'}`}>{connectionNotice}</span>
        </Alert>

        {!muted && !audioReady && (
          <Alert
            severity="warning"
            className="mb-8 rounded-2xl border border-amber-200/50 bg-gradient-to-r from-amber-50 to-orange-50 shadow-lg"
            icon={<AlarmOn className="text-amber-600" />}
          >
            <span className="font-bold text-amber-800">Tap Sound On once to enable chef alerts in this browser.</span>
          </Alert>
        )}
        
        {readyOrders.length > 0 && (
          <Alert
            severity="success"
            className="mb-8 rounded-2xl border border-emerald-200/50 bg-gradient-to-r from-emerald-50 to-teal-50 shadow-lg backdrop-blur-sm"
            icon={<CheckCircle className="text-emerald-600" />}
          >
            <span className="font-bold text-emerald-800">
              {readyOrders.length} order{readyOrders.length > 1 ? 's are' : ' is'} ready for pickup.
            </span>
          </Alert>
        )}

        {newOrderFlash && (
          <Alert
            severity="warning"
            className="mb-8 rounded-2xl border border-orange-200/50 bg-gradient-to-r from-orange-50 to-red-50 shadow-lg animate-bounce"
            icon={<NotificationsActive className="text-orange-600" />}
          >
            <span className="font-bold text-orange-800">New order received!</span>
          </Alert>
        )}

        {delayedOrdersCount > 0 && (
          <Alert
            severity="error"
            className="mb-8 rounded-2xl border border-red-200/50 bg-gradient-to-r from-red-50 to-rose-50 shadow-lg"
            icon={<AlarmOn className="text-red-600" />}
          >
            <span className="font-bold text-red-800">
              {delayedOrdersCount} delayed order{delayedOrdersCount > 1 ? 's need' : ' needs'} immediate attention.
            </span>
          </Alert>
        )}

        {/* Filters Section */}
        <div className="dashboard-section mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-5">
              <TextField
                label="Search orders..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Table, ID, or item name"
                fullWidth
                variant="outlined"
                InputProps={{
                  className: "rounded-xl"
                }}
              />
            </div>

            <FormControl className="lg:col-span-2">
              <InputLabel>Status</InputLabel>
              <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl">
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="preparing">Preparing</MenuItem>
                <MenuItem value="ready">Ready</MenuItem>
              </Select>
            </FormControl>

            <FormControl className="lg:col-span-2">
              <InputLabel>Table</InputLabel>
              <Select value={tableFilter} label="Table" onChange={(e) => setTableFilter(e.target.value)} className="rounded-xl">
                <MenuItem value="all">All Tables</MenuItem>
                {tableOptions.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl className="lg:col-span-2">
              <InputLabel>Sort</InputLabel>
              <Select value={sortBy} label="Sort" onChange={(e) => setSortBy(e.target.value)} className="rounded-xl">
                <MenuItem value="oldest">Oldest First</MenuItem>
                <MenuItem value="newest">Newest First</MenuItem>
              </Select>
            </FormControl>

            <div className="lg:col-span-1 text-center text-slate-400 text-sm hidden lg:block">
              <Sync className="animate-spin" />
            </div>
          </div>
        </div>

        {/* Order Columns */}
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {[
            { key: 'pending', title: 'Pending', subtitle: 'New tickets waiting to start', orders: pendingColumnOrders, tone: 'border-rose-200 bg-rose-50/70' },
            { key: 'preparing', title: 'Preparing', subtitle: 'Active work in the kitchen', orders: preparingColumnOrders, tone: 'border-sky-200 bg-sky-50/70' },
            { key: 'ready', title: 'Ready', subtitle: 'Ready for pickup and handoff', orders: readyColumnOrders, tone: 'border-emerald-200 bg-emerald-50/70' }
          ].map((column) => (
            <div
              key={column.key}
              className={`rounded-[30px] border p-4 shadow-sm ${column.tone}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (draggedOrderId) {
                  updateStatus(draggedOrderId, column.key);
                  setDraggedOrderId(null);
                }
              }}
            >
              <div className="mb-4 rounded-[24px] bg-white/80 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <Typography variant="h5" className="font-black text-slate-900">{column.title}</Typography>
                    <Typography className="text-sm text-slate-500">{column.subtitle}</Typography>
                  </div>
                  <div className="rounded-full bg-slate-900 px-3 py-1 text-sm font-black text-white">
                    {column.orders.length}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {column.orders.map((order) => {
                  const urgency = getUrgencyMeta(order.created_at, now);
                  const timerMeta = getTimerMeta(order.created_at, now, delayMinutesByOrder[order.id]);
                  const itemCount = (order.items || []).reduce((sum, item) => sum + item.quantity, 0);
                  const wasRecentlyUpdated = recentlyUpdatedOrderIds.includes(order.id);
                  const latestAddOnItems = order.add_on_count > 0 && order.status !== 'ready'
                    ? (order.items || []).filter((item) => item.add_on_batch === order.add_on_count)
                    : [];
                  const sourceMeta = getSourceMeta(order);
                  const priorityMeta = getPriorityMeta(order, now, delayMinutesByOrder[order.id]);
                  const groupedItems = Object.entries(groupOrderItemsByCategory(order.items || []));
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <Card
                      key={order.id}
                      draggable
                      onDragStart={() => setDraggedOrderId(order.id)}
                      onDragEnd={() => setDraggedOrderId(null)}
                      className={`group overflow-visible rounded-[28px] border bg-slate-950 text-white shadow-[0_22px_55px_-34px_rgba(15,23,42,0.55)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_-34px_rgba(2,6,23,0.75)] ${
                        order.status === 'ready'
                          ? 'border-emerald-400'
                          : order.status === 'preparing'
                            ? 'border-sky-400'
                            : 'border-rose-400'
                      }`}
                    >
                      <CardContent className="space-y-4 p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Typography variant="h5" className="font-black tracking-tight text-white">
                              Order #{formatOrderSerial(order)}
                            </Typography>
                            <Typography className="mt-1 text-sm text-slate-300">
                              {formatOrderLocation(order)} {order.waiter?.name ? `• ${order.waiter.name}` : ''}
                            </Typography>
                          </div>
                          <div className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${timerMeta.tone}`}>
                            {timerMeta.label}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${sourceMeta.tone}`}>
                            {sourceMeta.detail}
                          </span>
                          <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${getStatusColor(order.status)}`}>
                            {order.status}
                          </span>
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${urgency.tone}`}>
                            {urgency.label}
                          </span>
                          {priorityMeta ? (
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${priorityMeta.tone}`}>
                              {priorityMeta.label}
                            </span>
                          ) : null}
                        </div>

                        {wasRecentlyUpdated && (
                          <div className="rounded-2xl border border-amber-200 bg-amber-100/90 px-4 py-3 text-sm font-bold text-amber-900">
                            New add-on items received.
                          </div>
                        )}

                        <div className="space-y-3">
                          {groupedItems.map(([category, items]) => (
                            <div key={category} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                              <Typography className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                                {category}
                              </Typography>
                              <div className="mt-2 space-y-2">
                                {items.map((item) => (
                                  <div key={item.id} className={`flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm ${latestAddOnItems.some((i) => i.id === item.id) ? 'bg-amber-100/90 text-amber-950' : 'bg-white/5 text-slate-100'}`}>
                                    <div className="font-semibold">
                                      {item.quantity}x {item.menu_item?.name || 'Item'}
                                    </div>
                                    <div className="text-xs font-bold uppercase tracking-[0.14em]">
                                      {order.status === 'ready' ? 'Ready' : order.status === 'preparing' ? 'Preparing' : 'Pending'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        {isExpanded ? (
                          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
                            <div className="font-bold text-white">Kitchen Notes</div>
                            <div className="mt-2">{order.special_instructions || 'No customer notes for this order.'}</div>
                            <div className="mt-3 text-xs uppercase tracking-[0.16em] text-slate-400">
                              Prep estimate {timerMeta.label} • {itemCount} items
                            </div>
                          </div>
                        ) : null}

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          {order.status === 'pending' ? (
                            <Button
                              variant="contained"
                              className="py-3 font-bold rounded-xl shadow-md bg-sky-500 hover:bg-sky-600"
                              startIcon={<SoupKitchen />}
                              onClick={() => updateStatus(order.id, 'preparing')}
                            >
                              Start
                            </Button>
                          ) : null}

                          {order.status === 'preparing' ? (
                            <Button
                              variant="contained"
                              className="py-3 font-bold rounded-xl shadow-md bg-emerald-500 hover:bg-emerald-600"
                              startIcon={<CheckCircle />}
                              onClick={() => updateStatus(order.id, 'ready')}
                            >
                              Mark Ready
                            </Button>
                          ) : null}

                          <Button
                            variant="outlined"
                            className="py-3 font-bold rounded-xl border-white/20 text-white"
                            onClick={() => applyDelay(order.id, 5)}
                          >
                            Delay +5 min
                          </Button>

                          <Button
                            variant="outlined"
                            className="py-3 font-bold rounded-xl border-white/20 text-white"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            {isExpanded ? 'Hide Notes' : 'Expand Ticket'}
                          </Button>
                        </div>

                        {order.status === 'ready' ? (
                          order.order_source === 'qr' ? (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <Button
                                variant="contained"
                                className="py-3 font-bold rounded-xl shadow-md bg-slate-100 text-slate-900 hover:bg-white"
                                startIcon={<Restaurant />}
                                onClick={() => updateStatus(order.id, 'served', { handover_target: 'waiter' })}
                              >
                                Hand to Waiter
                              </Button>
                              <Button
                                variant="contained"
                                className="py-3 font-bold rounded-xl shadow-md bg-emerald-600 hover:bg-emerald-700"
                                startIcon={<CheckCircle />}
                                onClick={() => updateStatus(order.id, 'served', { handover_target: 'customer' })}
                              >
                                Hand to Customer
                              </Button>
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-emerald-300 bg-emerald-100 px-4 py-3 text-center text-sm font-bold text-emerald-900">
                              Ready for Pickup. Waiter dashboard will be notified.
                            </div>
                          )
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}

                {column.orders.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
                    <Typography variant="h6" className="font-bold text-slate-500">No {column.title.toLowerCase()} tickets</Typography>
                    <Typography className="mt-2 text-sm text-slate-400">New kitchen tickets will appear here automatically.</Typography>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>

        {filteredOrders.length === 0 && (
          <div className="text-center py-20 bg-white rounded-[32px] border border-slate-100 shadow-sm mt-4">
            <BedroomParent className="text-6xl text-slate-200 mb-4" />
            <Typography variant="h5" className="font-bold text-slate-500">No Active Orders</Typography>
            <Typography className="text-slate-400 mt-2">The kitchen is quiet for now.</Typography>
          </div>
        )}

        {/* History Section */}
        <div className="mt-12">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Typography variant="h5" className="font-bold text-slate-800">Kitchen History</Typography>
              <Typography className="text-sm text-slate-500">
                Full order history with search, time filters, and kitchen reporting.
              </Typography>
            </div>
            <Chip label={`${filteredHistoryOrders.length} orders shown`} size="small" />
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_180px]">
            <TextField
              label="Search kitchen history"
              value={historySearch}
              onChange={(event) => setHistorySearch(event.target.value)}
              placeholder="Table, serial no, status, customer, item..."
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Range</InputLabel>
              <Select value={historyRange} label="Range" onChange={(event) => setHistoryRange(event.target.value)}>
                <MenuItem value="day">Day</MenuItem>
                <MenuItem value="week">Week</MenuItem>
                <MenuItem value="month">Month</MenuItem>
                <MenuItem value="year">Year</MenuItem>
                <MenuItem value="all">All Time</MenuItem>
              </Select>
            </FormControl>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-none">
              <CardContent>
                <Typography className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Orders</Typography>
                <Typography variant="h4" className="mt-2 font-black text-slate-900">{filteredHistoryOrders.length}</Typography>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-emerald-200 bg-emerald-50 shadow-none">
              <CardContent>
                <Typography className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">Completed</Typography>
                <Typography variant="h4" className="mt-2 font-black text-emerald-900">{historyCompletedCount}</Typography>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-rose-200 bg-rose-50 shadow-none">
              <CardContent>
                <Typography className="text-xs font-bold uppercase tracking-[0.22em] text-rose-500">Cancelled</Typography>
                <Typography variant="h4" className="mt-2 font-black text-rose-900">{historyCancelledCount}</Typography>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-sky-200 bg-sky-50 shadow-none">
              <CardContent>
                <Typography className="text-xs font-bold uppercase tracking-[0.22em] text-sky-500">Items Prepared</Typography>
                <Typography variant="h4" className="mt-2 font-black text-sky-900">{historyTotalItems}</Typography>
              </CardContent>
            </Card>
            <Card className="rounded-2xl border border-amber-200 bg-amber-50 shadow-none">
              <CardContent>
                <Typography className="text-xs font-bold uppercase tracking-[0.22em] text-amber-500">Avg Prep</Typography>
                <Typography variant="h4" className="mt-2 font-black text-amber-900">{historyAveragePrepTime}m</Typography>
              </CardContent>
            </Card>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_360px]">
            <Card className="rounded-2xl border border-slate-200 bg-white shadow-none">
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <Typography variant="h6" className="font-black text-slate-900">Kitchen Report</Typography>
                  <Typography className="text-sm text-slate-500">Revenue from visible range: ${historyRevenue.toFixed(2)}</Typography>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Typography className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Completion Summary</Typography>
                    <Typography className="mt-2 text-sm text-slate-600">
                      {historyCompletedCount} completed or handed-off orders in the selected range.
                    </Typography>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <Typography className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">Kitchen Throughput</Typography>
                    <Typography className="mt-2 text-sm text-slate-600">
                      {historyTotalItems} total items prepared with an average prep time of {historyAveragePrepTime} minutes.
                    </Typography>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-slate-200 bg-white shadow-none">
              <CardContent>
                <Typography variant="h6" className="font-black text-slate-900">Top Prepared Items</Typography>
                <div className="mt-4 space-y-3">
                  {historyTopItems.length ? historyTopItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <Typography className="font-semibold text-slate-800">{item.name}</Typography>
                      <Chip label={`${item.quantity} qty`} size="small" />
                    </div>
                  )) : (
                    <Typography className="text-sm text-slate-500">No item history in this range yet.</Typography>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredHistoryOrders.map((order) => (
              <Card key={order.id} className="bg-slate-50/80 border border-slate-100 shadow-none rounded-2xl">
                <CardContent>
                  <div className="flex justify-between items-start gap-3 mb-2">
                    <Typography variant="subtitle1" className="font-bold text-slate-700">
                      {formatOrderLocation(order)}
                    </Typography>
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <Typography className="text-xs text-slate-400 mb-3">
                    Created {new Date(order.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                  {order.handover_target ? (
                    <div className="mb-3">
                      <span className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                        {getHandoverLabel(order.handover_target)}
                      </span>
                    </div>
                  ) : null}
                  <Divider className="mb-3" />
                  <div className="flex flex-wrap gap-1">
                    {(order.items || []).slice(0, 3).map((item) => (
                      <Chip
                        key={`${order.id}-${item.id}`}
                        size="small"
                        variant="outlined"
                        label={`${item.quantity}x ${item.menu_item?.name || 'Item'}`}
                        className="text-xs"
                      />
                    ))}
                    {(order.items || []).length > 3 && (
                      <Chip size="small" label={`+${order.items.length - 3}`} className="text-xs bg-slate-100" />
                    )}
                  </div>
                  <div className="mt-3 pt-2 border-t border-dashed flex justify-between text-xs font-medium text-slate-600">
                    <span>Total</span>
                    <span>${getOrderTotal(order).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!filteredHistoryOrders.length && (
            <div className="mt-4 rounded-[28px] border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
              <Typography variant="h6" className="font-bold text-slate-500">No kitchen history for this filter</Typography>
              <Typography className="mt-2 text-sm text-slate-400">Try another search term or switch the range to month, year, or all time.</Typography>
            </div>
          )}
        </div>
        </div>
      </div>
      
      <KitchenChatbot />
      </div>
    </div>
  );
};

export default KitchenDashboard;
