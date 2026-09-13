import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const ManagerOrdersView = ({
  orders = [],
  initialFilter = 'all',
  onOrderUpdated,
  onOpenNewOrder
}) => {
  const [statusFilter, setStatusFilter] = useState(initialFilter);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (statusFilter === 'all') return true;
        return o.status === statusFilter;
      })
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const serial = String(formatOrderSerial(o)).toLowerCase();
        const table = String(o.table_label || o.table_number || '').toLowerCase();
        const customer = String(o.customer_name || '').toLowerCase();
        const waiter = String(o.waiter?.name || '').toLowerCase();
        const items = (o.items || []).map((i) => i.menu_item?.name || i.name || '').join(' ').toLowerCase();
        return serial.includes(q) || table.includes(q) || customer.includes(q) || waiter.includes(q) || items.includes(q);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, statusFilter, search]);

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'pending').length,
      preparing: orders.filter((o) => o.status === 'preparing').length,
      ready: orders.filter((o) => o.status === 'ready').length,
      served: orders.filter((o) => o.status === 'served').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };
  }, [orders]);

  const handleUpdateStatus = async (orderId, newStatus) => {
    try {
      setUpdatingId(orderId);
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: newStatus });
      onOrderUpdated?.();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error('Failed to update status:', err);
      alert('Failed to update order status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleCancelOrder = async (orderId) => {
    const reason = window.prompt('Please enter the reason for cancellation:');
    if (!reason) return;

    try {
      setUpdatingId(orderId);
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/owner-controls`, {
        status: 'cancelled',
        cancellation_reason: reason
      });
      onOrderUpdated?.();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(null);
      }
    } catch (err) {
      console.error('Failed to cancel order:', err);
      alert('Failed to cancel order.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Orders', count: counts.all, color: 'bg-slate-900 text-white' },
            { id: 'pending', label: 'Pending', count: counts.pending, color: 'bg-amber-600 text-white' },
            { id: 'preparing', label: 'Preparing', count: counts.preparing, color: 'bg-blue-600 text-white' },
            { id: 'ready', label: 'Ready', count: counts.ready, color: 'bg-emerald-600 text-white' },
            { id: 'served', label: 'Served', count: counts.served, color: 'bg-purple-600 text-white' },
            { id: 'completed', label: 'Completed', count: counts.completed, color: 'bg-slate-700 text-white' },
            { id: 'cancelled', label: 'Cancelled', count: counts.cancelled, color: 'bg-rose-600 text-white' },
          ].map((f) => {
            const isActive = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? `${f.color} shadow-xs`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & New Order Action */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order #, table, customer..."
              className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52 sm:w-64"
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

          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs whitespace-nowrap"
          >
            <span>+</span> New Order
          </button>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Order ID</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Waiter</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Items</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <svg className="w-8 h-8 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    No orders match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const serialText = `#${formatOrderSerial(order)}`;
                  const tableText = formatOrderLocation(order);
                  const total = getOrderTotal(order);
                  const items = order.items || [];
                  const portions = items.reduce((s, i) => s + i.quantity, 0);

                  let statusTone = 'bg-slate-100 text-slate-800 border-slate-200';
                  if (order.status === 'pending') statusTone = 'bg-amber-100 text-amber-800 border-amber-200';
                  else if (order.status === 'preparing') statusTone = 'bg-blue-100 text-blue-800 border-blue-200';
                  else if (order.status === 'ready') statusTone = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  else if (order.status === 'served') statusTone = 'bg-purple-100 text-purple-800 border-purple-200';
                  else if (order.status === 'completed') statusTone = 'bg-slate-100 text-slate-800 border-slate-200';
                  else if (order.status === 'cancelled') statusTone = 'bg-rose-100 text-rose-800 border-rose-200';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{serialText}</td>
                      <td className="py-3 px-4 font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200">
                          {tableText}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{order.waiter?.name || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-slate-600">{order.customer_name || 'Walk-in'}</td>
                      <td className="py-3 px-4 max-w-xs">
                        <span className="truncate block font-medium">
                          {items.map((i) => `${i.menu_item?.name || i.name} ×${i.quantity}`).join(', ')}
                        </span>
                        <span className="text-[10px] text-slate-400">{portions} portions</span>
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900">₹{total.toFixed(0)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusTone}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedOrder(order)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                          >
                            Details
                          </button>
                          {order.status !== 'cancelled' && order.status !== 'completed' && (
                            <button
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={updatingId === order.id}
                              className="px-2 py-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Inspection Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <span className="text-xl font-black text-slate-900">
                  Order #{formatOrderSerial(selectedOrder)}
                </span>
                <span className="text-xs text-slate-500 block">
                  {formatOrderLocation(selectedOrder)} • Placed {new Date(selectedOrder.created_at).toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Status</span>
                  <span className="text-sm font-extrabold uppercase text-blue-700">{selectedOrder.status}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Waiter</span>
                  <span className="text-sm font-bold text-slate-900">{selectedOrder.waiter?.name || 'Unassigned'}</span>
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Items Ordered
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <span className="font-bold text-slate-800">{item.menu_item?.name || item.name}</span>
                        <span className="text-slate-400 ml-2">×{item.quantity}</span>
                      </div>
                      <span className="font-bold text-slate-900">
                        ₹{(parseFloat(item.menu_item?.price || item.price || 0) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <span className="font-bold text-blue-900">Total Order Amount</span>
                <span className="text-lg font-black text-blue-950">₹{getOrderTotal(selectedOrder).toFixed(2)}</span>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'preparing')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Start Cooking
                  </button>
                )}
                {selectedOrder.status === 'preparing' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'ready')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700"
                  >
                    Mark Ready
                  </button>
                )}
                {selectedOrder.status === 'ready' && (
                  <button
                    onClick={() => handleUpdateStatus(selectedOrder.id, 'served')}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Mark Served
                  </button>
                )}
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerOrdersView;
