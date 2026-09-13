import React from 'react';
import { formatOrderSerial } from '../../lib/appConfig';

const ManagerTableDetailModal = ({
  tableNumber,
  tableOrder,
  isOpen,
  onClose,
  onOpenNewOrder,
  onNavigateToBilling,
  onReviewBill,
  onClearTable
}) => {
  if (!isOpen) return null;

  const isOccupied = Boolean(tableOrder);
  const serialText = tableOrder ? `#${formatOrderSerial(tableOrder)}` : null;
  const items = tableOrder?.items || [];
  const totalAmount = items.reduce((sum, item) => sum + parseFloat(item.menu_item?.price || item.price || 0) * item.quantity, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center justify-center">
              T{String(tableNumber).padStart(2, '0')}
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Table {String(tableNumber).padStart(2, '0')}</h3>
              <p className="text-xs text-slate-500">Floor Table Inspection</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                isOccupied
                  ? tableOrder.status === 'ready'
                    ? 'bg-emerald-100 text-emerald-800'
                    : tableOrder.status === 'waiting_bill'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-blue-100 text-blue-800'
                  : 'bg-emerald-100 text-emerald-800'
              }`}
            >
              {isOccupied ? tableOrder.status : 'AVAILABLE / FREE'}
            </span>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {isOccupied ? (
            <>
              {/* Order Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Active Ticket</span>
                  <span className="text-base font-black text-slate-900">{serialText}</span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    {new Date(tableOrder.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Service Staff</span>
                  <span className="text-sm font-bold text-slate-900 truncate block">
                    {tableOrder.waiter?.name || 'Unassigned'}
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Guest: {tableOrder.customer_name || 'Walk-in Guest'}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Ordered Dishes ({items.reduce((s, i) => s + i.quantity, 0)} portions)
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {items.map((item, idx) => {
                    const price = parseFloat(item.menu_item?.price || item.price || 0);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div>
                          <div className="font-bold text-slate-800">{item.menu_item?.name || item.name}</div>
                          <div className="text-[10px] text-slate-400">
                            ₹{price.toFixed(2)} × {item.quantity}
                          </div>
                        </div>
                        <span className="font-black text-slate-900">₹{(price * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-blue-950">Table Bill Total</span>
                <span className="text-lg font-black text-blue-900">₹{totalAmount.toFixed(2)}</span>
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-700">Table is Free &amp; Ready for Guests</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                No active orders currently placed on this table. Waiters or guests can scan QR code to order.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          {isOccupied ? (
            <>
              <button
                onClick={() => {
                  onClearTable?.(tableOrder.id);
                  onClose();
                }}
                className="px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-xl"
              >
                Clear Table
              </button>

              {tableOrder.status === 'waiting_bill' ? (
                <button
                  onClick={() => {
                    onReviewBill?.(tableOrder);
                  }}
                  className="flex-1 px-4 py-2 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>REVIEW &amp; SETTLE BILL</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onNavigateToBilling?.(tableOrder.id);
                    onClose();
                  }}
                  className="flex-1 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
                >
                  Go to Billing Desk
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => {
                onOpenNewOrder?.(tableNumber);
                onClose();
              }}
              className="w-full px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs"
            >
              + Place Order on Table {tableNumber}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManagerTableDetailModal;
