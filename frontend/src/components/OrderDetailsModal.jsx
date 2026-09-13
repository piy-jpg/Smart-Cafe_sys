import React from 'react';
import { formatOrderLocation, formatOrderSerial } from '../lib/appConfig';

const OrderDetailsModal = ({
  isOpen,
  onClose,
  order,
  onMarkServed,
  onRequestBill,
  onAddMoreItems,
  onClearTable,
}) => {
  if (!isOpen || !order) return null;

  const items = order.items || [];
  const subtotal = items.reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0);
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending Kitchen</span>;
      case 'preparing':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-200">Cooking in Kitchen</span>;
      case 'ready':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 animate-pulse">● Ready to Serve</span>;
      case 'served':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Served to Guests</span>;
      case 'waiting_bill':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Bill Requested</span>;
      case 'completed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">Paid &amp; Settled</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">{status}</span>;
    }
  };

  const handlePrintKOT = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
              T{String(order.table_number || '').padStart(2, '0')}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900">
                  Order #{formatOrderSerial(order)}
                </h2>
                {getStatusBadge(order.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatOrderLocation(order)} • Placed at {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Guest / Table Info Banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">Customer:</span>{' '}
              <span className="font-bold text-slate-800">{order.customer_name || 'Walk-in Guest'}</span>
              {order.customer_phone && (
                <span className="text-slate-500 ml-1.5">({order.customer_phone})</span>
              )}
            </div>
            <div>
              <span className="text-slate-400">Assigned Waiter:</span>{' '}
              <span className="font-bold text-slate-800">{order.waiter?.name || 'Front of House'}</span>
            </div>
            <div>
              <span className="text-slate-400">Source:</span>{' '}
              <span className="font-bold uppercase text-slate-800">{order.order_source === 'qr' ? 'QR Mobile' : 'POS'}</span>
            </div>
          </div>

          {/* Items Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-wider text-slate-500 grid grid-cols-12 gap-2">
              <div className="col-span-6">Item</div>
              <div className="col-span-2 text-center">Qty</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Amount</div>
            </div>

            <div className="divide-y divide-slate-100 bg-white">
              {items.map((item, idx) => {
                const itemPrice = parseFloat(item.menu_item?.price || item.price || 0);
                const lineTotal = itemPrice * item.quantity;
                const isAddOn = item.add_on_batch > 0;

                return (
                  <div key={item.id || idx} className="px-4 py-2.5 text-xs grid grid-cols-12 gap-2 items-center">
                    <div className="col-span-6">
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{item.menu_item?.name || item.name}</span>
                        {isAddOn && (
                          <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            Add-on #{item.add_on_batch}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <div className="text-[11px] text-slate-400 italic mt-0.5">
                          Note: {item.notes}
                        </div>
                      )}
                    </div>
                    <div className="col-span-2 text-center font-bold text-slate-700">
                      ×{item.quantity}
                    </div>
                    <div className="col-span-2 text-right text-slate-500">
                      ₹{itemPrice.toLocaleString()}
                    </div>
                    <div className="col-span-2 text-right font-black text-slate-900">
                      ₹{lineTotal.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bill Summary Breakdown */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-medium">₹{subtotal.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST / Taxes (5%)</span>
              <span className="font-medium">₹{tax.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="font-medium">₹0</span>
            </div>
            <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
              <span>Total Amount</span>
              <span className="text-blue-600">₹{grandTotal.toFixed(0)}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintKOT}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Ticket
            </button>
            {order.status !== 'waiting_bill' && order.status !== 'completed' && (
              <button
                onClick={() => {
                  onClose();
                  onAddMoreItems?.(order);
                }}
                className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
              >
                <span>+ Add Items</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {order.status === 'ready' && (
              <button
                onClick={() => {
                  onMarkServed?.(order.id);
                  onClose();
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>✓ Mark Served</span>
              </button>
            )}

            {order.status === 'served' && (
              <button
                onClick={() => {
                  if (window.confirm(`Complete Table ${order.table_number}? This will send the table to the manager counter for final billing.`)) {
                    onRequestBill?.(order.id, order.table_number);
                    onClose();
                  }
                }}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
              >
                <span>COMPLETE TABLE</span>
              </button>
            )}

            {order.status === 'waiting_bill' && (
              <div className="px-3 py-1.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600 animate-pulse" />
                <span>Sent to Counter - Waiting for Final Bill</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default OrderDetailsModal;
