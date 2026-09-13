import React from 'react';
import { formatOrderSerial } from '../lib/appConfig';

const OrderPanel = ({
  selectedTable,
  tableStatus = 'free', // 'free' | 'occupied' | 'preparing' | 'ready' | 'waiting_bill'
  activeOrder = null,
  cart = [],
  customerName = '',
  onCustomerNameChange,
  guestCount = 2,
  onGuestCountChange,
  onOpenAddItemModal,
  onSendToKitchen,
  onMarkServed,
  onRequestBill,
  onClearTable,
  onOpenOrderDetails,
  onUpdateCartQuantity,
  onCloseMobileDrawer,
  submitting = false,
}) => {
  // If no table is selected
  if (!selectedTable) {
    return (
      <aside className="w-full lg:w-88 xl:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-xs">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wider">POS Order Desk</h3>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 ring-1 ring-blue-100 shadow-2xs">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h4 className="text-base font-black text-slate-900">SELECT A TABLE</h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
            Choose a table from the restaurant floor to start an order, add items, or manage service.
          </p>
        </div>
      </aside>
    );
  }

  const isFree = !activeOrder || tableStatus === 'free';
  const orderItems = activeOrder?.items || [];
  const [showCompleteTableModal, setShowCompleteTableModal] = React.useState(false);

  // Totals calculations
  const existingSubtotal = orderItems.reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0);

  const cartSubtotal = cart.reduce((sum, item) => (
    sum + (parseFloat(item.price || 0) * item.quantity)
  ), 0);

  const combinedSubtotal = existingSubtotal + cartSubtotal;
  const tax = combinedSubtotal * 0.05; // 5% GST
  const grandTotal = combinedSubtotal + tax;

  const currentStatus = activeOrder?.status || (isFree ? 'free' : 'occupied');
  const isWaitingBill = currentStatus === 'waiting_bill';
  const isAllServed = currentStatus === 'served';

  // Status display badge text & style
  let statusBadgeText = 'FREE';
  let statusBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (!isFree) {
    if (isWaitingBill) {
      statusBadgeText = 'READY FOR BILLING / COUNTER';
      statusBadgeStyle = 'bg-purple-100 text-purple-900 border-purple-300 font-black animate-pulse';
    } else if (currentStatus === 'ready') {
      statusBadgeText = 'READY TO SERVE';
      statusBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-200 animate-pulse';
    } else if (currentStatus === 'preparing') {
      statusBadgeText = 'ORDER ACTIVE • PREPARING';
      statusBadgeStyle = 'bg-sky-100 text-sky-800 border-sky-200';
    } else if (currentStatus === 'served') {
      statusBadgeText = 'ORDER ACTIVE • SERVED';
      statusBadgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
    } else {
      statusBadgeText = 'ORDER ACTIVE';
      statusBadgeStyle = 'bg-blue-100 text-blue-800 border-blue-200';
    }
  }

  return (
    <aside className="w-full lg:w-88 xl:w-96 bg-white border-l border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-30">
      
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-slate-900">
              TABLE {String(selectedTable).padStart(2, '0')}
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${statusBadgeStyle}`}>
              ● {statusBadgeText}
            </span>
          </div>

          {/* Close / dismiss button (especially for mobile/tablet drawer) */}
          {onCloseMobileDrawer && (
            <button
              onClick={onCloseMobileDrawer}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
            >
              ✕
            </button>
          )}
        </div>

        {/* Customer & Guest Info */}
        {isFree ? (
          <div className="mt-3 space-y-2.5 pt-2.5 border-t border-slate-200/80">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Customer Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => onCustomerNameChange?.(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">Number of Guests</span>
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1 shadow-2xs">
                <button
                  type="button"
                  onClick={() => onGuestCountChange?.(Math.max(1, guestCount - 1))}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors"
                >
                  −
                </button>
                <span className="w-6 text-center text-xs font-black text-slate-900">
                  {guestCount}
                </span>
                <button
                  type="button"
                  onClick={() => onGuestCountChange?.(guestCount + 1)}
                  className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Customer:</span>
              <span className="font-bold text-slate-900">
                {activeOrder.customer_name || 'Walk-in Guest'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Guests:</span>
              <span className="font-bold text-slate-900">{activeOrder.guest_count || 2}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Order:</span>
              <span className="font-bold text-blue-600">
                #{formatOrderSerial(activeOrder)} • ₹{existingSubtotal.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status:</span>
              <span className="font-black text-slate-900">
                {isWaitingBill ? 'READY FOR BILLING' : isAllServed ? 'ORDER ACTIVE (All Served)' : currentStatus.toUpperCase().replace('_', ' ')}
              </span>
            </div>
            {activeOrder.handover_target && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-500">Handover:</span>
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold border inline-flex items-center gap-1 ${
                  activeOrder.handover_target === 'customer'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-blue-50 text-blue-800 border-blue-200'
                }`}>
                  <span>{activeOrder.handover_target === 'customer' ? '👤' : '🛎️'}</span>
                  <span>{activeOrder.handover_target === 'customer' ? 'Customer Pickup' : 'At Waiter Counter'}</span>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Cart & Order Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        
        {/* Waiting for Billing Banner when locked */}
        {isWaitingBill && (
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 shadow-2xs space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
              <span className="text-xs font-black uppercase tracking-wider text-purple-900">
                Sent to Counter - Waiting for Final Bill
              </span>
            </div>
            <p className="text-[11px] text-purple-700 leading-relaxed">
              This table is waiting for Manager bill review &amp; payment collection. Order is locked from edits.
            </p>
          </div>
        )}

        {/* If occupied: Existing Placed Items */}
        {!isFree && orderItems.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                Kitchen Items ({orderItems.length})
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {isAllServed ? '✓ All Served' : 'Sent to Kitchen'}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {orderItems.map((item, index) => {
                const price = parseFloat(item.menu_item?.price || item.price || 0);
                const lineTotal = price * item.quantity;
                return (
                  <div key={item.id || index} className="py-2 flex items-start justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">
                        {item.menu_item?.name || item.name}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {item.quantity} × ₹{price.toFixed(0)}
                        {item.add_on_batch > 0 && (
                          <span className="ml-1.5 px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[10px] font-bold rounded">
                            Batch #{item.add_on_batch}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="font-black text-slate-900 text-right">
                      ₹{lineTotal.toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Draft Add-On or New Order Cart Items */}
        {!isWaitingBill && cart.length > 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between pb-1 border-b border-blue-100">
              <span className="text-[11px] font-black uppercase tracking-wider text-blue-700">
                {isFree ? 'New Order Draft' : 'Add-on Items (Unsent)'}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                Pending Send
              </span>
            </div>

            <div className="divide-y divide-blue-50">
              {cart.map((item) => {
                const price = parseFloat(item.price || 0);
                const lineTotal = price * item.quantity;

                return (
                  <div key={item.menu_id} className="py-2 flex items-center justify-between gap-2 text-xs bg-blue-50/40 p-2 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 truncate">{item.name}</div>
                      <div className="text-[11px] text-slate-500">
                        ₹{price.toFixed(0)} each
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onUpdateCartQuantity?.(item.menu_id, -1)}
                        className="w-5 h-5 rounded bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-600 font-bold text-xs flex items-center justify-center shadow-2xs border border-slate-200"
                      >
                        −
                      </button>
                      <span className="w-4 text-center font-black text-xs text-slate-900">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateCartQuantity?.(item.menu_id, 1)}
                        className="w-5 h-5 rounded bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs flex items-center justify-center shadow-2xs"
                      >
                        +
                      </button>
                    </div>

                    <div className="font-black text-slate-900 text-right min-w-[50px]">
                      ₹{lineTotal.toFixed(0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state if neither cart nor order items */}
        {isFree && cart.length === 0 && (
          <div className="py-12 text-center text-slate-400">
            <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <p className="text-xs font-bold text-slate-600">Cart is empty</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Click "+ ADD ITEMS" to browse menu</p>
          </div>
        )}
      </div>

      {/* Financial Breakdown & Action Buttons Footer */}
      <div className="p-4 border-t border-slate-200 bg-white space-y-3">
        {/* Bill Summary */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500">
            <span>Subtotal</span>
            <span className="font-medium text-slate-800">₹{combinedSubtotal.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Tax (5% GST)</span>
            <span className="font-medium text-slate-800">₹{tax.toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Discount</span>
            <span className="font-medium text-slate-800">₹0</span>
          </div>
          <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
            <span>TOTAL</span>
            <span className="text-blue-600">₹{grandTotal.toFixed(0)}</span>
          </div>
        </div>

        {/* Action Buttons Matrix */}
        <div className="space-y-2 pt-1">
          {/* 1. Add Items Button (Disabled/hidden if waiting for billing) */}
          {!isWaitingBill && (
            <button
              type="button"
              onClick={onOpenAddItemModal}
              className="w-full py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold shadow-2xs transition-all flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>+ ADD ITEM{cart.length > 0 ? 'S' : ''}</span>
            </button>
          )}

          {/* 2. Send To Kitchen (if cart has items & not waiting for bill) */}
          {!isWaitingBill && cart.length > 0 && (
            <button
              type="button"
              disabled={submitting}
              onClick={onSendToKitchen}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>{submitting ? 'Sending Ticket...' : 'SEND TO KITCHEN'}</span>
            </button>
          )}

          {/* Actions for Occupied Table */}
          {!isFree && (
            <div className="space-y-2">
              {/* If Ready to serve */}
              {currentStatus === 'ready' && (
                <button
                  type="button"
                  onClick={() => onMarkServed?.(activeOrder.id)}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-2 animate-bounce"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>SERVE TO TABLE</span>
                </button>
              )}

              {/* If all items are served and table is not yet sent to counter */}
              {isAllServed && !isWaitingBill && (
                <button
                  type="button"
                  onClick={() => setShowCompleteTableModal(true)}
                  className="w-full py-2.5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>COMPLETE TABLE</span>
                </button>
              )}

              {/* View Order button */}
              <button
                type="button"
                onClick={() => onOpenOrderDetails?.(activeOrder)}
                className="w-full py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                VIEW ORDER
              </button>
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal: Complete Table? */}
      {showCompleteTableModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 mx-auto flex items-center justify-center font-black text-base mb-3">
                T{String(selectedTable).padStart(2, '0')}
              </div>
              <h3 className="text-base font-black text-slate-900">
                Complete Table {String(selectedTable).padStart(2, '0')}?
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                All ordered items have been served. Once completed, the table will be sent to the counter for final billing.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Customer</span>
                <span className="font-bold text-slate-900">{activeOrder.customer_name || 'Walk-in Guest'}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Total Items</span>
                <span className="font-bold text-slate-900">
                  {orderItems.reduce((sum, i) => sum + i.quantity, 0)} items (All served)
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                <span>Total Amount</span>
                <span className="text-purple-700">₹{grandTotal.toFixed(0)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowCompleteTableModal(false)}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCompleteTableModal(false);
                  onRequestBill?.(activeOrder.id, selectedTable);
                }}
                className="py-2.5 px-4 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black transition-colors shadow-xs"
              >
                PROCEED TO COUNTER
              </button>
            </div>
          </div>
        </div>
      )}

    </aside>
  );
};

export default OrderPanel;