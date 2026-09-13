import React, { useEffect, useMemo, useState } from 'react';
import KitchenOrderTicket from '../../components/KitchenOrderTicket';
import { formatOrderSerial } from '../../lib/appConfig';

const KitchenQueuePage = ({
  orders = [],
  onStartCooking,
  onMarkReady,
  onHandoff,
  onViewDetails,
  recentlyUpdatedOrderIds = [],
}) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'preparing' | 'ready' | 'priority'
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('oldest'); // 'oldest' | 'newest' | 'priority'
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Only consider active orders in the queue (pending, preparing, ready)
  const activeOrders = useMemo(() => {
    return orders.filter((o) => ['pending', 'preparing', 'ready'].includes(o.status));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return activeOrders
      .filter((order) => {
        // Status & Priority Filter
        if (filter === 'all') return true;
        if (filter === 'pending') return order.status === 'pending';
        if (filter === 'preparing') return order.status === 'preparing';
        if (filter === 'ready') return order.status === 'ready';
        if (filter === 'priority') {
          const ageMinutes = Math.floor((currentTime - new Date(order.created_at).getTime()) / 60000);
          return ageMinutes >= 15 || order.order_source === 'qr';
        }
        return true;
      })
      .filter((order) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const serial = String(formatOrderSerial(order)).toLowerCase();
        const table = String(order.table_label || order.table_number || '').toLowerCase();
        const itemNames = (order.items || []).map((i) => i.menu_item?.name || i.name || '').join(' ').toLowerCase();
        return serial.includes(q) || table.includes(q) || itemNames.includes(q);
      })
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();

        if (sort === 'oldest') {
          return timeA - timeB; // FIFO standard kitchen priority
        }
        if (sort === 'newest') {
          return timeB - timeA;
        }
        if (sort === 'priority') {
          // Delayed > 15m first, then older orders
          const ageA = currentTime - timeA;
          const ageB = currentTime - timeB;
          return ageB - ageA;
        }
        return timeA - timeB;
      });
  }, [activeOrders, filter, search, sort, currentTime]);

  const counts = {
    all: activeOrders.length,
    pending: activeOrders.filter((o) => o.status === 'pending').length,
    preparing: activeOrders.filter((o) => o.status === 'preparing').length,
    ready: activeOrders.filter((o) => o.status === 'ready').length,
    priority: activeOrders.filter((o) => {
      const ageMinutes = Math.floor((currentTime - new Date(o.created_at).getTime()) / 60000);
      return ageMinutes >= 15;
    }).length,
  };

  return (
    <div className="space-y-5">
      {/* Control Bar: Filters, Search & Sorting */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Active', count: counts.all, color: 'bg-slate-800 text-white' },
            { id: 'pending', label: 'New / Pending', count: counts.pending, color: 'bg-amber-600 text-white' },
            { id: 'preparing', label: 'Preparing', count: counts.preparing, color: 'bg-blue-600 text-white' },
            { id: 'ready', label: 'Ready', count: counts.ready, color: 'bg-emerald-600 text-white' },
            { id: 'priority', label: 'Priority / Urgent', count: counts.priority, color: 'bg-red-600 text-white' },
          ].map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? `${f.color} shadow-sm scale-102`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{f.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[11px] font-black ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #104, Table 02, Dish..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sorting Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-500 hidden sm:inline">Sort:</label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="oldest">Oldest First (FIFO)</option>
              <option value="newest">Newest First</option>
              <option value="priority">Priority First</option>
            </select>
          </div>
        </div>
      </div>

      {/* Ticket Grid: Optimized for Distance Scanning */}
      <div>
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4 text-slate-400">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">No active kitchen orders found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {search
                ? `No orders matching "${search}". Try adjusting your search query.`
                : 'All kitchen tickets are currently served or none match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredOrders.map((order) => (
              <KitchenOrderTicket
                key={order.id}
                order={order}
                variant="large"
                onStartCooking={onStartCooking}
                onMarkReady={onMarkReady}
                onHandoff={onHandoff}
                onViewDetails={onViewDetails}
                isRecentlyUpdated={recentlyUpdatedOrderIds.includes(order.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KitchenQueuePage;
