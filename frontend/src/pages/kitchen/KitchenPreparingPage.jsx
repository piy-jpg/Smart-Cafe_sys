import React, { useState, useEffect } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const formatTimer = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const KitchenPreparingPage = ({
  orders = [],
  onMarkReady,
  onViewDetails,
}) => {
  // Active cooking orders
  const preparingOrders = orders.filter((o) => o.status === 'preparing');

  // Track checked items for each order: { [orderId]: { [itemIndex]: boolean } }
  const [checkedItems, setCheckedItems] = useState({});

  const toggleItemChecked = (orderId, idx) => {
    setCheckedItems((prev) => {
      const orderChecks = { ...(prev[orderId] || {}) };
      orderChecks[idx] = !orderChecks[idx];
      return { ...prev, [orderId]: orderChecks };
    });
  };

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-slate-900 rounded-2xl p-5 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
            <h2 className="text-xl font-bold tracking-tight">Active Stove & Grill Line</h2>
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Focus on food on the fire. Check items off as they are plated and click [MARK READY] to pass to waiters.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white/10 backdrop-blur-md rounded-xl px-4 py-2 text-center border border-white/15">
            <div className="text-2xl font-black">{preparingOrders.length}</div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-blue-200">Active Cooking</div>
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      {preparingOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-500">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
            </svg>
          </div>
          <h3 className="text-base font-bold text-slate-800">No active cooking orders</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            All pending tickets have either been cooked or the kitchen queue is clear. Check the Dashboard or Kitchen Queue to start cooking pending orders.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {preparingOrders.map((order) => {
            const items = order.items || [];
            const orderChecks = checkedItems[order.id] || {};
            const checkedCount = Object.values(orderChecks).filter(Boolean).length;
            const progressPercent = items.length > 0 ? Math.round((checkedCount / items.length) * 100) : 0;

            return (
              <PreparingTicketCard
                key={order.id}
                order={order}
                items={items}
                orderChecks={orderChecks}
                checkedCount={checkedCount}
                progressPercent={progressPercent}
                onToggleItem={(idx) => toggleItemChecked(order.id, idx)}
                onMarkReady={() => onMarkReady(order.id)}
                onViewDetails={() => onViewDetails && onViewDetails(order)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

const PreparingTicketCard = ({
  order,
  items,
  orderChecks,
  checkedCount,
  progressPercent,
  onToggleItem,
  onMarkReady,
  onViewDetails,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    const startTime = order.preparing_at ? new Date(order.preparing_at).getTime() : new Date(order.created_at).getTime();
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  });

  useEffect(() => {
    const startTime = order.preparing_at ? new Date(order.preparing_at).getTime() : new Date(order.created_at).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [order.preparing_at, order.created_at]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const isUrgent = elapsedMinutes >= 15;
  const isWarning = elapsedMinutes >= 8 && !isUrgent;

  const serialText = `#${formatOrderSerial(order)}`;
  const tableText = formatOrderLocation(order);
  const startTimeText = order.preparing_at
    ? new Date(order.preparing_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      className={`bg-white rounded-2xl border-2 transition-all shadow-sm hover:shadow-md flex flex-col justify-between ${
        isUrgent
          ? 'border-red-400 bg-red-50/15'
          : 'border-blue-500 bg-white'
      }`}
    >
      {/* Ticket Header */}
      <div className="p-4 border-b border-slate-100 bg-blue-50/40 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">{serialText}</span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-blue-700 text-white">
              {tableText}
            </span>
          </div>

          {/* Cooking Timer */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-black border ${
              isUrgent
                ? 'bg-red-600 text-white border-red-600 animate-pulse'
                : isWarning
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-blue-100 text-blue-800 border-blue-300'
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{formatTimer(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Timestamps & Info */}
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <div>
            <span>Started cooking at: </span>
            <span className="font-bold text-slate-700">{startTimeText}</span>
          </div>
          {order.waiter?.name && (
            <span className="text-slate-500 text-[11px]">Waiter: {order.waiter.name}</span>
          )}
        </div>

        {/* Preparation Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1">
            <span>Prep Checklist</span>
            <span>
              {checkedCount} of {items.length} items ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Ticket Body: Interactive Item Checklist */}
      <div className="p-4 flex-1 space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Tap item to mark prepared:
        </p>
        <div className="space-y-1.5">
          {items.map((item, idx) => {
            const itemName = item.menu_item?.name || item.name || 'Custom Dish';
            const isVeg = item.menu_item?.item_type === 'Veg';
            const isChecked = Boolean(orderChecks[idx]);

            return (
              <button
                key={item.id || idx}
                onClick={() => onToggleItem(idx)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isChecked
                    ? 'bg-emerald-50 border-emerald-300 opacity-75'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-emerald-600 border-emerald-600 text-white'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {isChecked && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <span
                    className={`flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                  </span>

                  <span
                    className={`font-bold text-sm tracking-tight ${
                      isChecked ? 'line-through text-slate-400' : 'text-slate-800'
                    }`}
                  >
                    {itemName}
                  </span>
                </div>

                <span
                  className={`font-extrabold text-sm px-2 py-0.5 rounded-lg border ${
                    isChecked
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-white text-slate-900 border-slate-200'
                  }`}
                >
                  ×{item.quantity}
                </span>
              </button>
            );
          })}
        </div>

        {/* Special Notes / Instructions */}
        {(order.special_instructions || order.notes) && (
          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
            <div className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-amber-800 mb-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Chef Cooking Note
            </div>
            <p className="font-semibold">{order.special_instructions || order.notes}</p>
          </div>
        )}
      </div>

      {/* Ticket Footer Action */}
      <div className="p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl flex items-center justify-between gap-3">
        <button
          onClick={onViewDetails}
          className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
        >
          Details
        </button>

        <button
          onClick={onMarkReady}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>MARK READY (MOVE TO PASS)</span>
        </button>
      </div>
    </div>
  );
};

export default KitchenPreparingPage;
