import React, { useEffect, useState } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../lib/appConfig';

const formatTimer = (elapsedSeconds) => {
  const m = Math.floor(elapsedSeconds / 60);
  const s = elapsedSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const KitchenOrderTicket = ({
  order,
  onStartCooking,
  onMarkReady,
  onHandoff,
  onViewDetails,
  variant = 'standard', // 'standard' | 'large'
  isRecentlyUpdated = false,
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(() => {
    if (!order?.created_at) return 0;
    const startTime = order.status === 'preparing' && order.preparing_at
      ? new Date(order.preparing_at).getTime()
      : new Date(order.created_at).getTime();
    return Math.max(0, Math.floor((Date.now() - startTime) / 1000));
  });

  useEffect(() => {
    const startTime = order.status === 'preparing' && order.preparing_at
      ? new Date(order.preparing_at).getTime()
      : new Date(order.created_at).getTime();

    const interval = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [order.created_at, order.preparing_at, order.status]);

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const isUrgent = elapsedMinutes >= 15;
  const isWarning = elapsedMinutes >= 8 && !isUrgent;

  // Status color styles matching the prompt:
  // Green for READY, Orange for PENDING, Blue for PREPARING, Red for urgent/overdue
  const getStatusBadge = () => {
    switch (order.status) {
      case 'pending':
        return {
          label: 'PENDING',
          badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
          borderClass: 'border-l-4 border-l-amber-500',
        };
      case 'preparing':
        return {
          label: 'COOKING',
          badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
          borderClass: 'border-l-4 border-l-blue-500',
        };
      case 'ready':
        return {
          label: 'READY FOR PICKUP',
          badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          borderClass: 'border-l-4 border-l-emerald-500',
        };
      default:
        return {
          label: order.status?.toUpperCase(),
          badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
          borderClass: 'border-l-4 border-l-slate-400',
        };
    }
  };

  const statusMeta = getStatusBadge();
  const serialText = `#${formatOrderSerial(order)}`;
  const tableText = formatOrderLocation(order);
  const items = order.items || [];
  const totalItemCount = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

  // Time pill styling
  let timerTone = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (isUrgent) {
    timerTone = 'bg-red-100 text-red-700 border-red-300 animate-pulse font-bold';
  } else if (isWarning) {
    timerTone = 'bg-amber-50 text-amber-700 border-amber-200 font-semibold';
  }

  const isLarge = variant === 'large';

  return (
    <div
      className={`bg-white rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col justify-between ${
        statusMeta.borderClass
      } ${
        isRecentlyUpdated ? 'ring-2 ring-blue-400 bg-blue-50/20' : 'border-slate-200'
      } ${isUrgent ? 'border-red-300 bg-red-50/10' : ''}`}
    >
      {/* Ticket Header */}
      <div className={`p-4 border-b border-slate-100 ${isLarge ? 'pb-3' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          {/* Order # and Table */}
          <div className="flex items-center gap-2.5">
            <span
              className={`font-black tracking-tight text-slate-900 ${
                isLarge ? 'text-2xl' : 'text-lg'
              }`}
            >
              {serialText}
            </span>
            <span
              className={`font-bold rounded-lg px-2.5 py-1 bg-slate-900 text-white ${
                isLarge ? 'text-base' : 'text-xs'
              }`}
            >
              {tableText}
            </span>
          </div>

          {/* Elapsed Timer */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs ${timerTone}`}
            title={`Elapsed cooking time: ${formatTimer(elapsedSeconds)}`}
          >
            <svg
              className={`w-3.5 h-3.5 ${isUrgent ? 'text-red-600 animate-spin' : 'text-current'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-mono font-bold tracking-wider">{formatTimer(elapsedSeconds)}</span>
          </div>
        </div>

        {/* Sub-meta: Order Source, Priority & Time */}
        <div className="flex items-center justify-between mt-2 pt-1 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">
              {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {order.order_source === 'qr' && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                QR ORDER
              </span>
            )}
            {order.waiter?.name && (
              <span className="text-[11px] text-slate-500 truncate max-w-[100px]">
                W: {order.waiter.name}
              </span>
            )}
          </div>

          {isUrgent ? (
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-600 text-white shadow-sm animate-pulse">
              URGENT
            </span>
          ) : (
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${statusMeta.badgeClass}`}
            >
              {statusMeta.label}
            </span>
          )}
        </div>
      </div>

      {/* Ticket Body: Item List */}
      <div className={`p-4 flex-1 space-y-2.5 ${isLarge ? 'p-5' : ''}`}>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const itemName = item.menu_item?.name || item.name || 'Custom Item';
            const isVeg = item.menu_item?.item_type === 'Veg';
            const isAddon = Boolean(item.add_on_batch && item.add_on_batch > 0);

            return (
              <div
                key={item.id || idx}
                className={`flex items-start justify-between gap-3 p-2 rounded-lg ${
                  isAddon ? 'bg-amber-50/70 border border-amber-200' : 'bg-slate-50 border border-slate-100'
                }`}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {/* Veg / Non-Veg Indicator Dot */}
                  <span
                    className={`mt-1 flex-shrink-0 w-3.5 h-3.5 rounded border flex items-center justify-center ${
                      isVeg ? 'border-emerald-600' : 'border-rose-600'
                    }`}
                    title={isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isVeg ? 'bg-emerald-600' : 'bg-rose-600'
                      }`}
                    />
                  </span>

                  <div>
                    <div
                      className={`font-bold text-slate-800 tracking-tight ${
                        isLarge ? 'text-lg leading-snug' : 'text-sm'
                      }`}
                    >
                      {itemName}
                    </div>
                    {isAddon && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] font-black uppercase tracking-wider bg-amber-200 text-amber-800">
                        ADD-ON
                      </span>
                    )}
                  </div>
                </div>

                {/* Big Quantity */}
                <div
                  className={`font-black rounded-lg px-2.5 py-1 text-slate-900 bg-white border border-slate-200 flex-shrink-0 shadow-2xs ${
                    isLarge ? 'text-xl' : 'text-base'
                  }`}
                >
                  ×{item.quantity}
                </div>
              </div>
            );
          })}
        </div>

        {/* Special Instructions / Notes */}
        {(order.notes || order.special_instructions || order.customer_name) && (
          <div className="mt-3 p-2.5 rounded-lg bg-yellow-50/80 border border-yellow-200 text-xs text-yellow-900">
            <div className="font-bold flex items-center gap-1 text-[11px] uppercase tracking-wider text-yellow-800 mb-0.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Instructions / Notes
            </div>
            {order.special_instructions && <p className="font-medium">{order.special_instructions}</p>}
            {order.notes && <p className="text-yellow-800">{order.notes}</p>}
            {order.customer_name && (
              <p className="text-yellow-700 text-[11px] mt-0.5">Guest: {order.customer_name}</p>
            )}
          </div>
        )}
      </div>

      {/* Ticket Footer / Action Buttons */}
      <div className="p-3 bg-slate-50 border-t border-slate-100 rounded-b-xl flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-500">
          {totalItemCount} item{totalItemCount !== 1 ? 's' : ''}
        </span>

        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(order)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
              title="View full order details"
            >
              Details
            </button>
          )}

          {/* Dynamic Order Actions per Status */}
          {order.status === 'pending' && (
            <button
              onClick={() => onStartCooking(order.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
                />
              </svg>
              <span>START PREPARING</span>
            </button>
          )}

          {order.status === 'preparing' && (
            <button
              onClick={() => onMarkReady(order.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-98 transition-all shadow-sm"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>MARK READY</span>
            </button>
          )}

          {order.status === 'ready' && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => onHandoff(order.id, 'customer')}
                title="Hand over directly to customer"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-98 transition-all shadow-xs"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>To Customer</span>
              </button>

              <button
                onClick={() => onHandoff(order.id, 'waiter')}
                title="Hand over to waiter counter"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-xs"
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

export default KitchenOrderTicket;
