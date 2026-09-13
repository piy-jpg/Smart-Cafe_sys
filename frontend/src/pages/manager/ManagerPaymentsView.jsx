import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const ManagerPaymentsView = ({ orders = [], onOrderUpdated }) => {
  const [methodFilter, setMethodFilter] = useState('all'); // 'all' | 'cash' | 'upi' | 'card' | 'other'
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'paid' | 'pending'
  const [search, setSearch] = useState('');
  const [recordingId, setRecordingId] = useState(null);
  const [notice, setNotice] = useState('');

  // Payment totals
  const summary = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let other = 0;

    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const total = getOrderTotal(o);
      const m = String(o.payment_method || '').toLowerCase();

      if (m.includes('cash')) cash += total;
      else if (m.includes('upi')) upi += total;
      else if (m.includes('card')) card += total;
      else if (o.payment_received || o.payment_status === 'paid') other += total;
    });

    const totalRevenue = cash + upi + card + other;
    return { cash, upi, card, other, totalRevenue };
  }, [orders]);

  const filteredPayments = useMemo(() => {
    return orders
      .filter((o) => o.status !== 'cancelled')
      .filter((o) => {
        const isPaid = o.payment_received || o.payment_status === 'paid' || o.status === 'completed';
        if (statusFilter === 'paid') return isPaid;
        if (statusFilter === 'pending') return !isPaid;
        return true;
      })
      .filter((o) => {
        if (methodFilter === 'all') return true;
        const m = String(o.payment_method || '').toLowerCase();
        if (methodFilter === 'cash') return m.includes('cash');
        if (methodFilter === 'upi') return m.includes('upi');
        if (methodFilter === 'card') return m.includes('card');
        return !m.includes('cash') && !m.includes('upi') && !m.includes('card');
      })
      .filter((o) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        const serial = String(formatOrderSerial(o)).toLowerCase();
        const table = String(o.table_label || o.table_number || '').toLowerCase();
        const customer = String(o.customer_name || '').toLowerCase();
        return serial.includes(q) || table.includes(q) || customer.includes(q);
      })
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, methodFilter, statusFilter, search]);

  const handleRecordPayment = async (orderId, method) => {
    try {
      setRecordingId(orderId);
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/customer`, {
        payment_received: true,
        payment_method: method,
        payment_status: 'paid',
      });
      setNotice(`Payment recorded successfully via ${method.toUpperCase()}.`);
      setTimeout(() => setNotice(''), 4000);
      onOrderUpdated?.();
    } catch (err) {
      console.error('Failed to record payment:', err);
      alert('Failed to update payment.');
    } finally {
      setRecordingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{notice}</span>
        </div>
      )}

      {/* Payment Channel Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
          <div className="text-2xl font-black text-slate-900 mt-2">₹{summary.totalRevenue.toFixed(0)}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Total settled</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Register</span>
          <div className="text-2xl font-black text-slate-900 mt-2">₹{summary.cash.toFixed(0)}</div>
          <span className="text-[11px] text-slate-400">Cash in drawer</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">UPI QR Payments</span>
          <div className="text-2xl font-black text-blue-700 mt-2">₹{summary.upi.toFixed(0)}</div>
          <span className="text-[11px] text-blue-600 font-semibold">Instant bank settlement</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Card POS</span>
          <div className="text-2xl font-black text-purple-700 mt-2">₹{summary.card.toFixed(0)}</div>
          <span className="text-[11px] text-slate-400">Debit / Credit</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Other / Coupons</span>
          <div className="text-2xl font-black text-slate-900 mt-2">₹{summary.other.toFixed(0)}</div>
          <span className="text-[11px] text-slate-400">Vouchers / Wallets</span>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Method & Status Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'cash', 'upi', 'card', 'other'].map((m) => (
              <button
                key={m}
                onClick={() => setMethodFilter(m)}
                className={`px-3 py-1 text-xs font-bold rounded-lg uppercase transition-all ${
                  methodFilter === m ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Status' },
              { id: 'paid', label: 'Paid' },
              { id: 'pending', label: 'Pending Payment' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setStatusFilter(s.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  statusFilter === s.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, table..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

      {/* Transaction Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Order Ref</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Settled At</th>
                <th className="py-3 px-4 text-right">Settlement Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No payment records found matching filters.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((order) => {
                  const serial = `#${formatOrderSerial(order)}`;
                  const tableText = formatOrderLocation(order);
                  const total = getOrderTotal(order);
                  const isPaid = order.payment_received || order.payment_status === 'paid' || order.status === 'completed';
                  const settledTime = order.payment_recorded_at
                    ? new Date(order.payment_recorded_at).toLocaleTimeString()
                    : isPaid
                    ? new Date(order.created_at).toLocaleTimeString()
                    : 'Unsettled';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{serial}</td>
                      <td className="py-3 px-4 font-bold">{tableText}</td>
                      <td className="py-3 px-4">{order.customer_name || 'Walk-in'}</td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">₹{total.toFixed(2)}</td>
                      <td className="py-3 px-4 font-bold uppercase text-slate-700">
                        {order.payment_method || 'Cash'}
                      </td>
                      <td className="py-3 px-4">
                        {isPaid ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            PAID
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                            PENDING PAYMENT
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{settledTime}</td>
                      <td className="py-3 px-4 text-right">
                        {!isPaid && (
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleRecordPayment(order.id, 'cash')}
                              disabled={recordingId === order.id}
                              className="px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                            >
                              Cash
                            </button>
                            <button
                              onClick={() => handleRecordPayment(order.id, 'upi')}
                              disabled={recordingId === order.id}
                              className="px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg"
                            >
                              UPI QR
                            </button>
                            <button
                              onClick={() => handleRecordPayment(order.id, 'card')}
                              disabled={recordingId === order.id}
                              className="px-2 py-1 text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg"
                            >
                              Card
                            </button>
                          </div>
                        )}
                        {isPaid && (
                          <span className="text-xs text-slate-400 font-semibold">Settled</span>
                        )}
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

export default ManagerPaymentsView;
