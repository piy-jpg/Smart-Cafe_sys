import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const ManagerBillingReviewModal = ({
  isOpen,
  onClose,
  order,
  onSettleSuccess,
  onReturnSuccess,
}) => {
  if (!isOpen || !order) return null;

  const [discountInput, setDiscountInput] = useState(order.discount_amount || 0);
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'upi' | 'card'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // 1. Multi-Batch Consolidation: Combine all items from all batches into ONE list
  const consolidatedItems = useMemo(() => {
    const rawItems = order.items || [];
    const itemMap = new Map();

    rawItems.forEach((item) => {
      const key = item.menu_id || item.name;
      const unitPrice = parseFloat(item.menu_item?.price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const batchNo = item.add_on_batch || 0;

      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        existing.quantity += qty;
        existing.totalPrice += qty * unitPrice;
        if (!existing.batches.includes(batchNo)) {
          existing.batches.push(batchNo);
        }
      } else {
        itemMap.set(key, {
          key,
          name: item.menu_item?.name || item.name || 'Menu Item',
          unitPrice,
          quantity: qty,
          totalPrice: qty * unitPrice,
          batches: [batchNo],
        });
      }
    });

    return Array.from(itemMap.values());
  }, [order]);

  // Financial calculations
  const subtotal = useMemo(() => {
    return consolidatedItems.reduce((sum, item) => sum + item.totalPrice, 0);
  }, [consolidatedItems]);

  const tax = subtotal * 0.05; // 5% GST
  const discount = Math.min(Math.max(0, Number(discountInput) || 0), subtotal + tax);
  const finalTotal = Math.max(0, subtotal + tax - discount);

  // Return to Waiter Action
  const handleReturnToWaiter = async () => {
    if (!window.confirm(`Return Table ${order.table_number || ''} to waiter? The order status will become ORDER ACTIVE so waiter can add more items.`)) {
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      try {
        await axios.post(`${API_BASE_URL}/api/orders/${order.id}/return-to-waiter`);
      } catch (apiErr) {
        // Fallback to PUT /status which is supported on all server processes
        await axios.put(`${API_BASE_URL}/api/orders/${order.id}/status`, { status: 'served' });
      }

      onReturnSuccess?.();
      onClose();
    } catch (err) {
      console.error('Failed to return order to waiter:', err);
      setError('Failed to return table to waiter. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Print Bill Action
  const handlePrintBill = async () => {
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${order.id}/bill-print`, { bill_type: 'customer' });
      window.print();
    } catch (err) {
      console.error('Failed to record bill print:', err);
      window.print();
    }
  };

  // Settle Final Bill & Collect Payment Action
  const handleGenerateFinalBill = async () => {
    try {
      setSubmitting(true);
      setError('');
      
      const payload = {
        payment_method: paymentMode,
        payment_status: 'paid',
        payment_received: true,
        discount_amount: discount,
        status: 'completed',
        table_cleared: true,
      };

      try {
        await axios.post(`${API_BASE_URL}/api/orders/${order.id}/settle-bill`, payload);
      } catch (apiErr) {
        // Fallback to PUT /owner-controls and /table-clear for running server compatibility
        await axios.put(`${API_BASE_URL}/api/orders/${order.id}/owner-controls`, payload);
        await axios.put(`${API_BASE_URL}/api/orders/${order.id}/table-clear`, { table_cleared: true });
      }

      onSettleSuccess?.(order);
      onClose();
    } catch (err) {
      console.error('Failed to settle final bill:', err);
      setError(err.response?.data?.message || 'Failed to settle final bill. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const tableLabel = order.table_number ? `TABLE ${String(order.table_number).padStart(2, '0')}` : formatOrderLocation(order);
  const totalItemCount = consolidatedItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-xl max-h-[92vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-sm shadow-sm">
              T{String(order.table_number || '').padStart(2, '0')}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  BILL REVIEW — {tableLabel}
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-purple-500/30 text-purple-200 border border-purple-400/40">
                  Counter Queue
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Order #{formatOrderSerial(order)} • Sent by {order.waiter?.name || 'Waiter'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={submitting}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-bold flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* Metadata Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 grid grid-cols-3 gap-2 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Customer</span>
              <span className="font-bold text-slate-900">{order.customer_name || 'Walk-in Guest'}</span>
              {order.customer_phone && <span className="text-slate-500 block text-[11px]">{order.customer_phone}</span>}
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Waiter</span>
              <span className="font-bold text-slate-900">{order.waiter?.name || 'Staff'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Placed At</span>
              <span className="font-bold text-slate-900">
                {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Consolidated Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-600 flex items-center justify-between">
              <span>Ordered Items (Consolidated: {totalItemCount} items)</span>
              <span className="text-[10px] font-bold text-slate-400">All batches combined</span>
            </div>

            <div className="divide-y divide-slate-100 bg-white">
              {consolidatedItems.map((item) => (
                <div key={item.key} className="px-4 py-2.5 text-xs flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span>{item.name}</span>
                      {item.batches.length > 1 && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                          {item.batches.length} Batches
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {item.quantity} × ₹{item.unitPrice.toFixed(0)}
                    </div>
                  </div>
                  <div className="font-black text-slate-900 text-right min-w-[70px]">
                    ₹{item.totalPrice.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Financial Calculation Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2.5 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal</span>
              <span className="font-bold text-slate-800">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Tax (5% GST)</span>
              <span className="font-bold text-slate-800">₹{tax.toFixed(2)}</span>
            </div>
            
            {/* Manager Editable Discount */}
            <div className="flex items-center justify-between pt-1 border-t border-slate-200/80">
              <label className="text-slate-700 font-bold flex items-center gap-1.5">
                <span>Discount:</span>
                <span className="text-[10px] text-slate-400 font-normal">(Manager editable)</span>
              </label>
              <div className="flex items-center gap-1">
                <span className="font-bold text-slate-500">₹</span>
                <input
                  type="number"
                  min="0"
                  max={subtotal + tax}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-24 px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Final Total */}
            <div className="flex justify-between items-center text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>FINAL TOTAL</span>
              <span className="text-xl text-blue-600 tracking-tight">₹{finalTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Mode Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Payment Mode
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: 'cash', label: 'CASH', icon: '💵' },
                { id: 'upi', label: 'UPI QR', icon: '📱' },
                { id: 'card', label: 'CARD', icon: '💳' },
              ].map((m) => {
                const isSelected = paymentMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMode(m.id)}
                    className={`py-3 px-3 rounded-xl border text-xs font-black flex flex-col items-center justify-center gap-1 transition-all ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-base">{m.icon}</span>
                    <span>{m.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleReturnToWaiter}
            disabled={submitting}
            className="w-full sm:w-auto px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>RETURN TO WAITER</span>
          </button>

          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrintBill}
              disabled={submitting}
              className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>PRINT BILL</span>
            </button>

            <button
              type="button"
              onClick={handleGenerateFinalBill}
              disabled={submitting}
              className="flex-1 sm:flex-none px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{submitting ? 'Settling...' : 'GENERATE FINAL BILL'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default ManagerBillingReviewModal;
