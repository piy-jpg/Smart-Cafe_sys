import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const sanitizePhone = (phone) => String(phone || '').replace(/[^\d]/g, '');

const ManagerBillingView = ({ orders = [], onOrderUpdated, onReviewBill }) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'open' | 'paid' | 'cancelled'
  const [search, setSearch] = useState('');
  const [activeBillOrder, setActiveBillOrder] = useState(null);
  const [printing, setPrinting] = useState(false);
  const [notice, setNotice] = useState('');

  const filteredBills = useMemo(() => {
    return orders
      .filter((o) => {
        const isPaid = o.payment_received || o.payment_status === 'paid' || o.status === 'completed';
        const isCancelled = o.status === 'cancelled';
        const isOpen = !isPaid && !isCancelled;

        if (filter === 'open') return isOpen;
        if (filter === 'paid') return isPaid;
        if (filter === 'cancelled') return isCancelled;
        return true;
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
  }, [orders, filter, search]);

  const counts = useMemo(() => {
    return {
      all: orders.length,
      open: orders.filter((o) => !o.payment_received && o.payment_status !== 'paid' && o.status !== 'cancelled').length,
      paid: orders.filter((o) => (o.payment_received || o.payment_status === 'paid' || o.status === 'completed') && o.status !== 'cancelled').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };
  }, [orders]);

  const handlePrintBill = async (order, type = 'customer') => {
    try {
      setPrinting(true);
      await axios.put(`${API_BASE_URL}/api/orders/${order.id}/bill-print`, { bill_type: type });
      setNotice(`Recorded ${type} bill print for Order #${formatOrderSerial(order)}.`);
      setTimeout(() => setNotice(''), 4000);
      onOrderUpdated?.();
      window.print();
    } catch (err) {
      console.error('Failed to record bill print:', err);
    } finally {
      setPrinting(false);
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

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Bills', count: counts.all, color: 'bg-slate-900 text-white' },
            { id: 'open', label: 'Open / Unpaid', count: counts.open, color: 'bg-amber-600 text-white' },
            { id: 'paid', label: 'Paid / Settled', count: counts.paid, color: 'bg-emerald-600 text-white' },
            { id: 'cancelled', label: 'Cancelled', count: counts.cancelled, color: 'bg-rose-600 text-white' },
          ].map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? `${f.color} shadow-xs` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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

        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill #, table, customer..."
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

      {/* Bills Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Waiter</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Payment Status</th>
                <th className="py-3 px-4">Print Count</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No billing records found.
                  </td>
                </tr>
              ) : (
                filteredBills.map((order) => {
                  const serial = `#INV-${formatOrderSerial(order)}`;
                  const tableText = formatOrderLocation(order);
                  const total = getOrderTotal(order);
                  const isPaid = order.payment_received || order.payment_status === 'paid' || order.status === 'completed';
                  const isCancelled = order.status === 'cancelled';
                  const printCount = (order.customer_bill_print_count || 0) + (order.kitchen_bill_print_count || 0);

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{serial}</td>
                      <td className="py-3 px-4 font-bold">{tableText}</td>
                      <td className="py-3 px-4">{order.customer_name || 'Walk-in'}</td>
                      <td className="py-3 px-4 text-slate-500">{order.waiter?.name || 'Unassigned'}</td>
                      <td className="py-3 px-4 max-w-xs truncate">
                        {(order.items || []).map((i) => `${i.menu_item?.name || i.name} ×${i.quantity}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">₹{total.toFixed(2)}</td>
                      <td className="py-3 px-4">
                        {isCancelled ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-200">
                            Cancelled
                          </span>
                        ) : isPaid ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Paid ({order.payment_method || 'Cash'})
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                            Unpaid / Open
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500">
                        {printCount > 0 ? `${printCount} time${printCount > 1 ? 's' : ''}` : 'None'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {order.status === 'waiting_bill' ? (
                          <button
                            onClick={() => onReviewBill?.(order)}
                            className="px-3 py-1 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-lg shadow-2xs"
                          >
                            Review &amp; Settle
                          </button>
                        ) : (
                          <button
                            onClick={() => setActiveBillOrder(order)}
                            className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                          >
                            View Bill / Print
                          </button>
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

      {/* Invoice & Receipt Preview Modal */}
      {activeBillOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">Receipt Preview &amp; Print</h3>
              <button
                onClick={() => setActiveBillOrder(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Thermal Receipt Body */}
            <div className="p-6 overflow-y-auto font-mono text-xs text-slate-800 bg-white space-y-3">
              <div className="text-center pb-2 border-b border-dashed border-slate-300">
                <div className="text-lg font-black tracking-wider uppercase">SmartCafe</div>
                <div className="text-[11px] text-slate-500">Fine Dining &amp; Express POS</div>
                <div className="text-[10px] text-slate-400 mt-1">Invoice: #{formatOrderSerial(activeBillOrder)}</div>
                <div className="text-[10px] text-slate-400">{new Date(activeBillOrder.created_at).toLocaleString()}</div>
              </div>

              <div className="flex items-center justify-between text-[11px] pb-2 border-b border-dashed border-slate-200">
                <span>{formatOrderLocation(activeBillOrder)}</span>
                <span>Waiter: {activeBillOrder.waiter?.name || 'Staff'}</span>
              </div>

              {/* Items */}
              <div className="space-y-1.5 py-2 border-b border-dashed border-slate-300">
                {(activeBillOrder.items || []).map((item, idx) => {
                  const unitPrice = parseFloat(item.menu_item?.price || item.price || 0);
                  const lineTotal = unitPrice * item.quantity;
                  return (
                    <div key={idx} className="flex items-center justify-between">
                      <div className="truncate pr-2">
                        <span>{item.menu_item?.name || item.name}</span>
                        <span className="text-slate-400 text-[10px] ml-1">×{item.quantity}</span>
                      </div>
                      <span className="font-bold">₹{lineTotal.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Totals */}
              <div className="pt-1 space-y-1 text-right">
                <div className="flex justify-between font-black text-sm">
                  <span>NET TOTAL:</span>
                  <span>₹{getOrderTotal(activeBillOrder).toFixed(2)}</span>
                </div>
                <div className="text-[10px] text-slate-400">Payment: {activeBillOrder.payment_method || 'Cash / Pending'}</div>
              </div>

              <div className="text-center pt-3 text-[10px] text-slate-400">
                Thank you for dining with SmartCafe!
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
              {activeBillOrder.customer_phone && (
                <a
                  href={`https://wa.me/${sanitizePhone(activeBillOrder.customer_phone)}?text=${encodeURIComponent(
                    `Hello ${activeBillOrder.customer_name || 'Guest'}, your SmartCafe bill for ${formatOrderLocation(activeBillOrder)} is ₹${getOrderTotal(activeBillOrder).toFixed(2)}. Thank you for dining with us!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100"
                >
                  WhatsApp Bill
                </a>
              )}

              <button
                onClick={() => handlePrintBill(activeBillOrder, 'customer')}
                disabled={printing}
                className="flex-1 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
              >
                Print Customer Bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerBillingView;
