import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

// Components
import KitchenSidebar from '../components/KitchenSidebar';
import KitchenTopNav from '../components/KitchenTopNav';
import KitchenKanbanDashboard from './kitchen/KitchenKanbanDashboard';
import KitchenQueuePage from './kitchen/KitchenQueuePage';
import KitchenPreparingPage from './kitchen/KitchenPreparingPage';
import KitchenReadyPage from './kitchen/KitchenReadyPage';
import KitchenHistoryPage from './kitchen/KitchenHistoryPage';
import KitchenMenuPage from './kitchen/KitchenMenuPage';
import KitchenReportsPage from './kitchen/KitchenReportsPage';
import KitchenSettingsPage from './kitchen/KitchenSettingsPage';
import KitchenChatbot from '../components/KitchenChatbot';

const ALERT_AUDIO_URL = 'https://www.soundjay.com/misc/bell-ringing-05.mp3';
const LIVE_REFRESH_MS = 5000;

const getAudioContext = () => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
};

const playChimeSound = async (audioContext, audioElement) => {
  try {
    if (audioContext) {
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      const now = audioContext.currentTime;
      oscillator.frequency.setValueAtTime(800, now);
      oscillator.frequency.setValueAtTime(600, now + 0.12);
      oscillator.frequency.setValueAtTime(450, now + 0.24);

      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      oscillator.start(now);
      oscillator.stop(now + 0.55);
      return true;
    }

    if (audioElement) {
      audioElement.currentTime = 0;
      await audioElement.play();
      return true;
    }
  } catch (error) {
    console.log('Kitchen sound chime error', error);
  }
  return false;
};

const KitchenDashboard = () => {
  const currentUser = getStoredUser();
  const [activeSection, setActiveSection] = useState('dashboard');
  const [orders, setOrders] = useState([]);
  const [menu, setMenu] = useState([]);
  const [socketConnected, setSocketConnected] = useState(() => socket.connected);
  const [muted, setMuted] = useState(false);
  const [recentlyUpdatedOrderIds, setRecentlyUpdatedOrderIds] = useState([]);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState(null);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const [readyPromptOrder, setReadyPromptOrder] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const mutedRef = useRef(muted);
  const audioContextRef = useRef(null);
  const fallbackAudioRef = useRef(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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
      return true;
    } catch (e) {
      console.log('Audio init warning:', e);
      return false;
    }
  };

  const triggerAlertSound = useCallback(() => {
    if (!mutedRef.current) {
      playChimeSound(audioContextRef.current, fallbackAudioRef.current).catch(console.error);
    }
  }, []);

  // Fetch orders & menu
  const fetchOrders = useCallback(() => {
    axios
      .get(`${API_BASE_URL}/api/orders`)
      .then((res) => setOrders(res.data.orders || []))
      .catch(console.error);
  }, []);

  const fetchMenu = useCallback(() => {
    axios
      .get(`${API_BASE_URL}/api/menu?includeUnavailable=true`)
      .then((res) => setMenu(res.data.menu || []))
      .catch(console.error);
  }, []);

  // Realtime socket integration
  useEffect(() => {
    fetchOrders();
    fetchMenu();
    unlockAudio().catch(console.error);

    socket.emit('join_kitchen');

    const handleNewOrder = (newOrder) => {
      triggerAlertSound();
      setNewOrderFlash(true);
      window.setTimeout(() => setNewOrderFlash(false), 2000);

      setOrders((prev) => {
        const filtered = prev.filter((o) => o.id !== newOrder.id);
        return [newOrder, ...filtered];
      });
    };

    const handleOrderUpdate = (updatedOrder) => {
      setOrders((prev) => {
        const exists = prev.some((o) => o.id === updatedOrder.id);
        if (!exists) {
          return [updatedOrder, ...prev];
        }
        return prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o));
      });
    };

    const handleItemsAdded = (updatedOrder) => {
      triggerAlertSound();
      handleOrderUpdate(updatedOrder);
      setRecentlyUpdatedOrderIds((prev) => [...new Set([updatedOrder.id, ...prev])]);
      window.setTimeout(() => {
        setRecentlyUpdatedOrderIds((prev) => prev.filter((id) => id !== updatedOrder.id));
      }, 120000);
    };

    const handleConnect = () => {
      setSocketConnected(true);
      fetchOrders();
      fetchMenu();
      socket.emit('join_kitchen');
    };

    const handleDisconnect = () => {
      setSocketConnected(false);
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderStatusUpdated', handleOrderUpdate);
    socket.on('orderUpdated', handleItemsAdded);
    socket.on('orderCustomerUpdated', handleOrderUpdate);
    socket.on('menuUpdated', fetchMenu);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('newOrder', handleNewOrder);
      socket.off('orderStatusUpdated', handleOrderUpdate);
      socket.off('orderUpdated', handleItemsAdded);
      socket.off('orderCustomerUpdated', handleOrderUpdate);
      socket.off('menuUpdated', fetchMenu);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [fetchOrders, fetchMenu, triggerAlertSound]);

  // Fallback Polling Interval
  useEffect(() => {
    const fallbackInterval = setInterval(() => {
      fetchOrders();
    }, LIVE_REFRESH_MS);

    const handleVisibility = () => {
      if (!document.hidden) {
        fetchOrders();
        fetchMenu();
      }
    };

    window.addEventListener('focus', handleVisibility);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(fallbackInterval);
      window.removeEventListener('focus', handleVisibility);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [fetchOrders, fetchMenu]);

  // Clock ticker for elapsed cooking calculations
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);

  // Order status transitions (Realtime calls)
  const handleUpdateStatus = async (orderId, newStatus, extra = {}) => {
    // Optimistic UI update
    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          const nowIso = new Date().toISOString();
          const patch = { ...o, status: newStatus };
          if (newStatus === 'preparing' && !o.preparing_at) patch.preparing_at = nowIso;
          if (newStatus === 'ready' && !o.ready_at) patch.ready_at = nowIso;
          if (newStatus === 'served' && !o.served_at) patch.served_at = nowIso;
          return patch;
        }
        return o;
      })
    );

    try {
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, {
        status: newStatus,
        ...extra,
      });
    } catch (error) {
      console.error('Failed to update order status:', error);
      fetchOrders(); // Revert on failure
    }
  };

  const handleStartCooking = (id) => handleUpdateStatus(id, 'preparing');
  const handleMarkReady = (id) => {
    handleUpdateStatus(id, 'ready');
    const target = orders.find((o) => o.id === id);
    if (target) {
      setReadyPromptOrder(target);
    }
  };
  const handleHandoff = (id, target = 'waiter') => {
    handleUpdateStatus(id, 'served', { handover_target: target });
    if (readyPromptOrder && readyPromptOrder.id === id) {
      setReadyPromptOrder(null);
    }
  };

  // Counts & KPIs
  const activeOrders = useMemo(() => {
    return orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));
  }, [orders]);

  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'preparing'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);

  const delayedOrders = useMemo(() => {
    return activeOrders.filter((o) => {
      const ageMinutes = Math.floor((now - new Date(o.created_at).getTime()) / 60000);
      return ageMinutes >= 15;
    });
  }, [activeOrders, now]);

  const itemsInQueue = useMemo(() => {
    return activeOrders.reduce((total, order) => {
      return total + (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    }, 0);
  }, [activeOrders]);

  const averageAgeMinutes = useMemo(() => {
    if (activeOrders.length === 0) return 0;
    const totalAge = activeOrders.reduce((sum, o) => {
      return sum + Math.max(0, Math.floor((now - new Date(o.created_at).getTime()) / 60000));
    }, 0);
    return Math.round(totalAge / activeOrders.length);
  }, [activeOrders, now]);

  const averagePrepTimeMinutes = useMemo(() => {
    const prepDurations = orders
      .filter((o) => o.preparing_at && (o.ready_at || o.served_at))
      .map((o) => {
        const start = new Date(o.preparing_at).getTime();
        const end = new Date(o.ready_at || o.served_at).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
        return Math.round((end - start) / 60000);
      })
      .filter((v) => v > 0);

    if (prepDurations.length === 0) return 12;
    return Math.round(prepDurations.reduce((a, b) => a + b, 0) / prepDurations.length);
  }, [orders]);

  const counts = {
    pending: pendingOrders.length,
    preparing: preparingOrders.length,
    ready: readyOrders.length,
    totalActive: activeOrders.length,
  };

  // Dynamic Header Titles
  const sectionTitles = {
    dashboard: { title: 'Kitchen Command Center', subtitle: 'Live order pipeline and station workflow' },
    queue: { title: 'Kitchen Queue', subtitle: 'High-speed tickets optimized for kitchen terminal' },
    preparing: { title: 'Active Cooking', subtitle: 'Dishes currently on the stove, grill, and prep station' },
    ready: { title: 'The Pass • Ready for Pickup', subtitle: 'Plated orders waiting for waiter pickup and delivery' },
    history: { title: 'Order History', subtitle: 'Completed and cancelled kitchen tickets archive' },
    menu: { title: 'Menu Availability', subtitle: 'Realtime 1-click item availability & stock control' },
    reports: { title: 'Kitchen Reports', subtitle: 'Preparation speed, rush hours, and workload analytics' },
    settings: { title: 'Kitchen Settings', subtitle: 'Chef station, audio alerts, printer and display preferences' },
  };

  return (
    <div className={`pos-layout transition-colors duration-500 ${newOrderFlash ? 'bg-amber-50/40' : ''}`}>
      {/* 1. Kitchen Sidebar */}
      <KitchenSidebar
        activeSection={activeSection}
        onSectionChange={(sec) => setActiveSection(sec)}
        counts={counts}
        currentUser={currentUser}
      />

      {/* 2. Main Pos Surface */}
      <div className="pos-main flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <KitchenTopNav
          title={sectionTitles[activeSection]?.title || 'Dashboard'}
          subtitle={sectionTitles[activeSection]?.subtitle}
          socketConnected={socketConnected}
          currentUser={currentUser}
          muted={muted}
          onToggleMute={async () => {
            if (muted) {
              await unlockAudio();
              playChimeSound(audioContextRef.current, fallbackAudioRef.current).catch(console.error);
            }
            setMuted(!muted);
          }}
          delayedCount={delayedOrders.length}
          onSelectDelayedOrder={() => setActiveSection('queue')}
        />

        {/* Scrollable Main Content */}
        <div className="pos-content flex-1 overflow-auto p-6 bg-[var(--color-background)]">
          {activeSection === 'dashboard' && (
            <KitchenKanbanDashboard
              orders={activeOrders}
              kpis={{
                pendingCount: counts.pending,
                preparingCount: counts.preparing,
                readyCount: counts.ready,
                itemsInQueue,
                averageAgeMinutes,
                averagePrepTimeMinutes,
              }}
              onStartCooking={handleStartCooking}
              onMarkReady={handleMarkReady}
              onHandoff={handleHandoff}
              onViewDetails={(order) => setSelectedOrderForModal(order)}
              recentlyUpdatedOrderIds={recentlyUpdatedOrderIds}
            />
          )}

          {activeSection === 'queue' && (
            <KitchenQueuePage
              orders={orders}
              onStartCooking={handleStartCooking}
              onMarkReady={handleMarkReady}
              onHandoff={handleHandoff}
              onViewDetails={(order) => setSelectedOrderForModal(order)}
              recentlyUpdatedOrderIds={recentlyUpdatedOrderIds}
            />
          )}

          {activeSection === 'preparing' && (
            <KitchenPreparingPage
              orders={orders}
              onMarkReady={handleMarkReady}
              onViewDetails={(order) => setSelectedOrderForModal(order)}
            />
          )}

          {activeSection === 'ready' && (
            <KitchenReadyPage
              orders={orders}
              onHandoff={handleHandoff}
              onViewDetails={(order) => setSelectedOrderForModal(order)}
            />
          )}

          {activeSection === 'history' && (
            <KitchenHistoryPage
              orders={orders}
              onViewDetails={(order) => setSelectedOrderForModal(order)}
            />
          )}

          {activeSection === 'menu' && (
            <KitchenMenuPage
              menu={menu}
              onMenuUpdated={fetchMenu}
            />
          )}

          {activeSection === 'reports' && (
            <KitchenReportsPage orders={orders} />
          )}

          {activeSection === 'settings' && (
            <KitchenSettingsPage
              currentUser={currentUser}
              muted={muted}
              onToggleMute={() => setMuted(!muted)}
              onTestSound={async () => {
                await unlockAudio();
                playChimeSound(audioContextRef.current, fallbackAudioRef.current);
              }}
              socketConnected={socketConnected}
              onResync={() => {
                fetchOrders();
                fetchMenu();
              }}
            />
          )}
        </div>
      </div>

      {/* Ready Handover Choice Modal */}
      {readyPromptOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                  Order Marked Ready
                </span>
              </div>
              <button
                onClick={() => setReadyPromptOrder(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900">
                Order #{formatOrderSerial(readyPromptOrder)} • {formatOrderLocation(readyPromptOrder)}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Items are cooked and ready. Choose handover destination:
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => {
                  handleHandoff(readyPromptOrder.id, 'customer');
                  setReadyPromptOrder(null);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-teal-200 bg-teal-50/70 hover:bg-teal-100 hover:border-teal-500 text-teal-950 active:scale-98 transition-all group text-center shadow-2xs"
              >
                <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <span className="font-extrabold text-sm">To Customer</span>
                <span className="text-[11px] text-teal-700 mt-0.5">Direct counter pickup</span>
              </button>

              <button
                onClick={() => {
                  handleHandoff(readyPromptOrder.id, 'waiter');
                  setReadyPromptOrder(null);
                }}
                className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-blue-200 bg-blue-50/70 hover:bg-blue-100 hover:border-blue-500 text-blue-950 active:scale-98 transition-all group text-center shadow-2xs"
              >
                <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mb-2 shadow-xs group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <span className="font-extrabold text-sm">To Waiter Counter</span>
                <span className="text-[11px] text-blue-700 mt-0.5">Pass for table delivery</span>
              </button>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <span className="text-[11px] text-slate-400">Can also hand over anytime from Ready pass</span>
              <button
                onClick={() => setReadyPromptOrder(null)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-lg hover:bg-slate-100"
              >
                Keep on Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Order Detail Modal */}
      {selectedOrderForModal && (
        <OrderDetailModal
          order={selectedOrderForModal}
          onClose={() => setSelectedOrderForModal(null)}
          onStartCooking={handleStartCooking}
          onMarkReady={handleMarkReady}
          onHandoff={handleHandoff}
        />
      )}

      {/* Chatbot helper */}
      <KitchenChatbot />
    </div>
  );
};

// Order Details Modal Component
const OrderDetailModal = ({ order, onClose, onStartCooking, onMarkReady, onHandoff }) => {
  const serialText = `#${formatOrderSerial(order)}`;
  const tableText = formatOrderLocation(order);
  const items = order.items || [];
  const totalPortions = items.reduce((s, i) => s + Number(i.quantity || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black text-slate-900">{serialText}</span>
              <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-slate-900 text-white">
                {tableText}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Order Placed: {new Date(order.created_at).toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Order Details Banner */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Order Status</span>
              <span className="font-extrabold text-sm uppercase text-blue-600">{order.status}</span>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-400 font-bold uppercase text-[10px] block">Source</span>
              <span className="font-extrabold text-sm uppercase text-slate-800">
                {order.order_source === 'qr' ? 'QR Code Customer' : `Waiter: ${order.waiter?.name || 'Staff'}`}
              </span>
            </div>
          </div>

          {/* Items */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Order Items ({totalPortions} portions)
            </h4>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-slate-900">{item.menu_item?.name || item.name}</span>
                    <span className="text-xs text-slate-400 ml-2">({item.menu_item?.category || 'Dish'})</span>
                  </div>
                  <span className="font-black text-sm px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-900">
                    ×{item.quantity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          {(order.special_instructions || order.notes) && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 block mb-1">
                Special Instructions
              </span>
              <p className="font-medium">{order.special_instructions || order.notes}</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
          >
            Close
          </button>

          {order.status === 'pending' && (
            <button
              onClick={() => {
                onStartCooking(order.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700"
            >
              Start Cooking
            </button>
          )}

          {order.status === 'preparing' && (
            <button
              onClick={() => {
                onMarkReady(order.id);
                onClose();
              }}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
            >
              Mark Ready
            </button>
          )}

          {order.status === 'ready' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onHandoff(order.id, 'customer');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition-all shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>To Customer</span>
              </button>

              <button
                onClick={() => {
                  onHandoff(order.id, 'waiter');
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span>To Waiter Counter</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitchenDashboard;
