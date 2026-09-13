import React, { useEffect, useState } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const formatTimer = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const KitchenReadyPage = ({
  orders = [],
  onHandoff,
  onViewDetails,
}) => {
  const readyOrders = orders.filter((o) => o.status === 'ready');
  const [bellRungOrderId, setBellRungOrderId] = useState(null);

  const ringWaiter = (orderId) => {
    setBellRungOrderId(orderId);
    window.setTimeout(() => setBellRungOrderId(null), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <h2 className="text-xl font-bold tracking-tight">The Pass • Ready for Pickup</h2>
          </div>
          <p className="text-xs text-emerald-200 mt-1">
            Plated dishes awaiting waiter pickup. When waiter takes food to the table, click [HANDOFF / SERVED].
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 text-center border border-white/15">
            <div className="text-2xl font-black">{readyOrders.length}</div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-200">On The Pass</div>
          </div>
        </div>
      </div>

      {readyOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">The Pass is Clear</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All finished orders have been picked up and delivered to tables. When cooking orders are marked ready, they will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {readyOrders.map((order) => (
            <ReadyTicketCard
              key={order.id}
              order={order}
              isBellRung={bellRungOrderId === order.id}
              onRingWaiter={() => ringWaiter(order.id)}
              onHandoff={(target) => onHandoff(order.id, target)}
              onViewDetails={() => onViewDetails && onViewDetails(order)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ReadyTicketCard = ({
  order,
  isBellRung,
  onRingWaiter,
  onHandoff,
  onViewDetails,
}) => {
  const [waitSeconds, setWaitSeconds] = useState(() => {
    const readyTime = order.ready_at ? new Date(order.ready_at).getTime() : new Date(order.created_at).getTime();
    return Math.max(0, Math.floor((Date.now() - readyTime) / 1000));
  });

  useEffect(() => {
    const readyTime = order.ready_at ? new Date(order.ready_at).getTime() : new Date(order.created_at).getTime();
    const interval = setInterval(() => {
      setWaitSeconds(Math.max(0, Math.floor((Date.now() - readyTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.ready_at, order.created_at]);

  const waitMinutes = Math.floor(waitSeconds / 60);
  const isColdAlert = waitMinutes >= 5; // Food sitting on pass for more than 5 minutes

  const serialText = `#${formatOrderSerial(order)}`;
  const tableText = formatOrderLocation(order);
  const readyTimeText = order.ready_at
    ? new Date(order.ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Just now';

  const items = order.items || [];
  const totalItemCount = items.reduce((sum, i) => sum + Number(i.quantity || 0), 0);

  return (
    <div
      className={`bg-white rounded-2xl border-2 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
        isColdAlert
          ? 'border-amber-400 bg-amber-50/20 ring-2 ring-amber-300/40'
          : 'border-emerald-500 bg-white'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-100 bg-emerald-50/40 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">{serialText}</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-700 text-white">
              {tableText}
            </span>
          </div>

          {/* Pass Wait Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-black border ${
              isColdAlert
                ? 'bg-amber-100 text-amber-900 border-amber-300 animate-pulse'
                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
            }`}
            title="Time food has been sitting waiting on the pass"
          >
            <svg className="w-3.5 h-3.5 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Pass: {formatTimer(waitSeconds)}</span>
          </div>
        </div>

        {/* Completed Time & Waiter Info */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>Plated at: </span>
            <span className="font-bold text-slate-700">{readyTimeText}</span>
          </div>
          {order.waiter?.name && (
            <span className="text-slate-600 font-medium">Assigned Waiter: {order.waiter.name}</span>
          )}
        </div>

        {isColdAlert && (
          <div className="mt-2 py-1 px-2 rounded-lg bg-amber-100/90 border border-amber-300 text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
            Food sitting &gt; 5 mins! Ring waiter for immediate pickup.
          </div>
        )}
      </div>

      {/* Item List */}
      <div className="p-4 flex-1 space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Plated Dishes ({totalItemCount} portions):
        </div>

        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const itemName = item.menu_item?.name || item.name || 'Custom Dish';
            const isVeg = item.menu_item?.item_type === 'Veg';

            return (
              <div
                key={item.id || idx}
                className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  </span>
                  <span className="font-bold text-sm text-slate-800 truncate">{itemName}</span>
                </div>
                <span className="font-black text-sm px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-slate-900">
                  ×{item.quantity}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Footer */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl space-y-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onViewDetails}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
          >
            View Order
          </button>

          <button
            onClick={onRingWaiter}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              isBellRung
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>{isBellRung ? 'Waiter Pinged!' : 'Ring Waiter'}</span>
          </button>

          <button
            onClick={() => onHandoff('customer')}
            className="flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition-all shadow-xs"
            title="Hand over directly to customer"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>To Customer</span>
          </button>

          <button
            onClick={() => onHandoff('waiter')}
            className="flex-1 flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-xs"
            title="Hand over to waiter counter"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span>To Waiter Counter</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitchenReadyPage;
