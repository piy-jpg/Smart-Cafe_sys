import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderSerial, formatOrderLocation } from '../../lib/appConfig';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const OwnerOrdersView = ({ orders = [], users = [], onOrdersUpdated }) => {
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Financial Control Form State
  const [discountAmount, setDiscountAmount] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [reassignWaiterId, setReassignWaiterId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const waiters = useMemo(() => users.filter((u) => u.role === 'waiter'), [users]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (statusFilter === 'all') return true;
        if (statusFilter === 'active') return !['completed', 'cancelled'].includes(o.status);
        return o.status === statusFilter;
      })
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const serial = String(formatOrderSerial(o)).toLowerCase();
        const table = String(o.table_number || '').toLowerCase();
        const customer = String(o.customer_name || '').toLowerCase();
        return serial.includes(q) || table.includes(q) || customer.includes(q);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, statusFilter, search]);

  const handleSelectOrder = (order) => {
    setSelectedOrder(order);
    setDiscountAmount(order.discount_amount ? String(order.discount_amount) : '');
    setRefundAmount(order.refund_amount ? String(order.refund_amount) : '');
    setReassignWaiterId(order.waiter_id || '');
    setCancelReason(order.cancellation_reason || '');
    setNotice('');
  };

  const handleApplyFinancialAdjustment = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${selectedOrder.id}/owner-controls`, {
        discount_amount: Number(discountAmount || 0),
        refund_amount: Number(refundAmount || 0),
      });
      if (response.data?.order) {
        setSelectedOrder(response.data.order);
        onOrdersUpdated?.();
        setNotice('Discount & refund controls updated successfully.');
      }
    } catch (err) {
      console.error(err);
      setNotice('Failed to apply financial controls.');
    } finally {
      setSaving(false);
    }
  };

  const handleReassignStaff = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setSaving(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${selectedOrder.id}/owner-controls`, {
        waiter_id: reassignWaiterId || null,
      });
      if (response.data?.order) {
        setSelectedOrder(response.data.order);
        onOrdersUpdated?.();
        setNotice('Waiter reassigned successfully.');
      }
    } catch (err) {
      console.error(err);
      setNotice('Failed to reassign staff.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelOrder = async (e) => {
    e.preventDefault();
    if (!selectedOrder) return;
    if (!window.confirm(`Are you sure you want to cancel Order #${formatOrderSerial(selectedOrder)}? Items will be restocked.`)) {
      return;
    }
    setSaving(true);
    try {
      const response = await axios.put(`${API_BASE_URL}/api/orders/${selectedOrder.id}/owner-controls`, {
        status: 'cancelled',
        cancellation_reason: cancelReason.trim() || 'Cancelled by restaurant owner',
      });
      if (response.data?.order) {
        setSelectedOrder(response.data.order);
        onOrdersUpdated?.();
        setNotice('Order cancelled and inventory restored to stock.');
      }
    } catch (err) {
      console.error(err);
      setNotice('Failed to cancel order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Filter Controls */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
            Executive Order Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit live orders, apply owner discounts, refunds, reassign staff, or manage exceptions.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, table, customer..."
            className="w-full sm:w-60 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 focus:outline-none"
          >
            <option value="all">All Statuses ({orders.length})</option>
            <option value="active">Active Dining</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {notice && (
        <div className="bg-blue-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-bold text-blue-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Orders Matrix & Inspector Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Orders Table (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="pb-3">Order #</th>
                  <th className="pb-3">Location</th>
                  <th className="pb-3">Customer</th>
                  <th className="pb-3 text-center">Items</th>
                  <th className="pb-3 text-right">Amount</th>
                  <th className="pb-3 text-center">Status</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No matching orders found.
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((o) => {
                    const total = getOrderTotal(o);
                    const isSelected = selectedOrder?.id === o.id;

                    return (
                      <tr
                        key={o.id}
                        onClick={() => handleSelectOrder(o)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70 font-semibold' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 font-bold text-slate-900">
                          #{formatOrderSerial(o)}
                        </td>
                        <td className="py-3 text-slate-700">
                          {formatOrderLocation(o)}
                        </td>
                        <td className="py-3 text-slate-600">
                          {o.customer_name || 'Walk-in'}
                        </td>
                        <td className="py-3 text-center text-slate-600">
                          {(o.items || []).reduce((sum, i) => sum + i.quantity, 0)}
                        </td>
                        <td className="py-3 text-right font-black text-slate-900">
                          ₹{total.toLocaleString()}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              o.status === 'ready'
                                ? 'bg-emerald-100 text-emerald-800'
                                : o.status === 'preparing'
                                  ? 'bg-sky-100 text-sky-800'
                                  : o.status === 'pending'
                                    ? 'bg-amber-100 text-amber-800'
                                    : o.status === 'cancelled'
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectOrder(o);
                            }}
                            className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-blue-600 hover:text-white rounded-lg text-xs font-bold transition-all"
                          >
                            Controls
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

        {/* Right: Owner Control Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase pb-2 border-b border-slate-100">
            Owner Controls
          </h3>

          {!selectedOrder ? (
            <div className="py-16 text-center text-slate-400">
              <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xs font-bold text-slate-700">No order selected</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Select an order from the list to apply discounts, reassign staff, or manage status.
              </p>
            </div>
          ) : (
            <div className="space-y-4 text-xs">
              {/* Selected Order Summary Banner */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between font-black text-slate-900">
                  <span>Order #{formatOrderSerial(selectedOrder)}</span>
                  <span>₹{getOrderTotal(selectedOrder).toLocaleString()}</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {formatOrderLocation(selectedOrder)} • {selectedOrder.customer_name || 'Walk-in'}
                </div>
              </div>

              {/* 1. Discounts & Refunds */}
              <form onSubmit={handleApplyFinancialAdjustment} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-900">Financial Adjustments</div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-0.5">
                      Refund (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-bold"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  Apply Financial Update
                </button>
              </form>

              {/* 2. Reassign Waiter */}
              <form onSubmit={handleReassignStaff} className="p-3 bg-slate-50/60 rounded-xl border border-slate-200 space-y-2.5">
                <div className="font-bold text-slate-900">Reassign Waiter</div>
                <select
                  value={reassignWaiterId}
                  onChange={(e) => setReassignWaiterId(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-800"
                >
                  <option value="">Unassigned Waiter</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold shadow-2xs transition-colors"
                >
                  Save Staff Assignment
                </button>
              </form>

              {/* 3. Cancel Order */}
              {selectedOrder.status !== 'cancelled' && (
                <form onSubmit={handleCancelOrder} className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2">
                  <div className="font-bold text-rose-900">Owner Order Cancellation</div>
                  <input
                    type="text"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="Reason (e.g., Guest left, duplicate order)"
                    className="w-full bg-white border border-rose-200 rounded-lg px-2.5 py-1 text-xs"
                    required
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold shadow-2xs transition-colors"
                  >
                    Cancel Order &amp; Restock
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OwnerOrdersView;
