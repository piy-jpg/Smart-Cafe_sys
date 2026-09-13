import React, { useEffect, useState } from 'react';
import { formatOrderSerial } from '../lib/appConfig';

const LiveOrders = ({ orders = [], onSelectOrder }) => {
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const getOrderTotal = (order) => {
    return (order.items || []).reduce(
      (sum, item) => sum + ((item.menu_item?.price || item.price || 0) * item.quantity),
      0
    );
  };

  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Just now';
    const seconds = Math.floor((currentTime - new Date(dateString).getTime()) / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes <= 0) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Pending
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ready
          </span>
        );
      case 'served':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            Served
          </span>
        );
      case 'waiting_bill':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Bill Req.
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const activeOrders = orders.filter(
    (o) => !['completed', 'cancelled'].includes(o.status) && !(o.status === 'waiting_bill' && o.table_cleared)
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Live Orders
          </h3>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <span className="text-xs text-slate-400 font-semibold">
          {activeOrders.length} active
        </span>
      </div>

      {/* Orders Grid / List */}
      {activeOrders.length === 0 ? (
        <div className="py-10 text-center text-slate-400">
          <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <div className="text-xs font-bold text-slate-700">No active orders</div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            New orders will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {activeOrders.map((order) => {
            const itemCount = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);
            const total = getOrderTotal(order);
            const timeAgo = getTimeAgo(order.created_at);

            return (
              <div
                key={order.id}
                className="bg-slate-50 hover:bg-blue-50/40 border border-slate-200 hover:border-blue-300 rounded-xl p-3 flex flex-col justify-between transition-all shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900">
                      #{formatOrderSerial(order)}
                    </span>
                    <span className="text-xs font-black text-blue-600">
                      Table {String(order.table_number).padStart(2, '0')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                    <span>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
                    <span className="font-bold text-slate-900">₹{total.toLocaleString()}</span>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {getStatusBadge(order.status)}
                    <span className="text-[10px] text-slate-400">{timeAgo}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectOrder?.(order)}
                    className="px-2.5 py-1 bg-white hover:bg-blue-600 text-slate-700 hover:text-white border border-slate-200 hover:border-blue-600 rounded-lg text-xs font-bold transition-all shadow-2xs"
                  >
                    View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
};

export default LiveOrders;