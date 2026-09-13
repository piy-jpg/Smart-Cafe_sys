import React, { useMemo, useState } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const getPreparationDuration = (order) => {
  const start = order.preparing_at ? new Date(order.preparing_at).getTime() : new Date(order.created_at).getTime();
  const end = order.ready_at
    ? new Date(order.ready_at).getTime()
    : order.served_at
    ? new Date(order.served_at).getTime()
    : order.cancelled_at
    ? new Date(order.cancelled_at).getTime()
    : null;

  if (!end || Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return '—';
  }

  const minutes = Math.round((end - start) / 60000);
  if (minutes < 1) return '< 1 min';
  return `${minutes} min${minutes > 1 ? 's' : ''}`;
};

const KitchenHistoryPage = ({ orders = [], onViewDetails }) => {
  const [dateFilter, setDateFilter] = useState('today'); // 'today' | 'yesterday' | 'week' | 'month' | 'all'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'completed' | 'cancelled'
  const [search, setSearch] = useState('');

  // Historical orders: completed, served, waiting_bill, cancelled
  const historicalOrders = useMemo(() => {
    return orders.filter((o) => ['served', 'waiting_bill', 'completed', 'cancelled'].includes(o.status));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return historicalOrders
      .filter((order) => {
        const orderTime = new Date(order.created_at).getTime();

        if (dateFilter === 'today') return orderTime >= todayStart;
        if (dateFilter === 'yesterday') return orderTime >= yesterdayStart && orderTime < todayStart;
        if (dateFilter === 'week') return orderTime >= weekStart;
        if (dateFilter === 'month') return orderTime >= monthStart;
        return true;
      })
      .filter((order) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'completed') return order.status !== 'cancelled';
        if (statusFilter === 'cancelled') return order.status === 'cancelled';
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
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [historicalOrders, dateFilter, statusFilter, search]);

  const totalHistoryCount = historicalOrders.length;
  const completedCount = historicalOrders.filter((o) => o.status !== 'cancelled').length;
  const cancelledCount = historicalOrders.filter((o) => o.status === 'cancelled').length;

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Date Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'week', label: 'Last 7 Days' },
            { id: 'month', label: 'This Month' },
            { id: 'all', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                dateFilter === tab.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Status Filter & Search */}
        <div className="flex items-center gap-3">
          {/* Status Dropdown */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Records ({totalHistoryCount})</option>
            <option value="completed">Completed / Served ({completedCount})</option>
            <option value="cancelled">Cancelled ({cancelledCount})</option>
          </select>

          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search #ID, Table, Dish..."
              className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* History Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Order #</th>
                <th className="py-3.5 px-4">Table</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Handover</th>
                <th className="py-3.5 px-4">Order Placed</th>
                <th className="py-3.5 px-4">Completed / Finish</th>
                <th className="py-3.5 px-4">Prep Duration</th>
                <th className="py-3.5 px-4">Items & Portions</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    No historical orders match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isCancelled = order.status === 'cancelled';
                  const serialText = `#${formatOrderSerial(order)}`;
                  const tableText = formatOrderLocation(order);
                  const items = order.items || [];
                  const totalPortions = items.reduce((s, i) => s + Number(i.quantity || 0), 0);
                  const prepTime = getPreparationDuration(order);

                  const placedTime = order.created_at
                    ? new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—';

                  const finishTime = order.served_at
                    ? new Date(order.served_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : order.ready_at
                    ? new Date(order.ready_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : order.cancelled_at
                    ? new Date(order.cancelled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '—';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Order # */}
                      <td className="py-3.5 px-4">
                        <span className="font-extrabold text-slate-900 text-sm">{serialText}</span>
                      </td>

                      {/* Table */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {tableText}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isCancelled ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">
                            Cancelled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                          </span>
                        )}
                      </td>

                      {/* Handover Target */}
                      <td className="py-3.5 px-4">
                        {order.handover_target === 'customer' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-200 inline-flex items-center gap-1">
                            <span>👤</span> Customer
                          </span>
                        ) : order.handover_target === 'waiter' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 inline-flex items-center gap-1">
                            <span>🛎️</span> Waiter Counter
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">—</span>
                        )}
                      </td>

                      {/* Order Placed */}
                      <td className="py-3.5 px-4 text-slate-500">{placedTime}</td>

                      {/* Completed Time */}
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{finishTime}</td>

                      {/* Prep Duration */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                          {prepTime}
                        </span>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-medium text-slate-800 truncate">
                          {items.map((i) => `${i.menu_item?.name || i.name} ×${i.quantity}`).join(', ')}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {totalPortions} portion{totalPortions !== 1 ? 's' : ''} total
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onViewDetails && onViewDetails(order)}
                          className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          View Ticket
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default KitchenHistoryPage;
