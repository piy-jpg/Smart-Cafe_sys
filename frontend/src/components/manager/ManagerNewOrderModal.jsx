import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';

const ManagerNewOrderModal = ({
  isOpen,
  onClose,
  menu = [],
  onOrderCreated,
  currentUser
}) => {
  const [tableNumber, setTableNumber] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cart, setCart] = useState([]); // [{ menu_id, name, price, quantity }]
  const [itemSearch, setItemSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const availableMenu = menu.filter((item) => item.available !== false && (item.stock_quantity || 0) > 0);
  const filteredMenu = availableMenu.filter((item) =>
    item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
    (item.category || '').toLowerCase().includes(itemSearch.toLowerCase())
  );

  const addToCart = (item) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menu_id === item.id);
      if (existing) {
        return prev.map((c) => c.menu_id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menu_id: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  };

  const updateQuantity = (menuId, delta) => {
    setCart((prev) => {
      return prev
        .map((c) => {
          if (c.menu_id === menuId) {
            const nextQty = c.quantity + delta;
            return nextQty > 0 ? { ...c, quantity: nextQty } : null;
          }
          return c;
        })
        .filter(Boolean);
    });
  };

  const totalAmount = cart.reduce((sum, item) => sum + parseFloat(item.price || 0) * item.quantity, 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one item to the order.');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const payload = {
        table_number: parseInt(tableNumber, 10),
        table_label: `Table ${tableNumber}`,
        customer_name: customerName.trim() || null,
        customer_phone: customerPhone.trim() || null,
        waiter_id: currentUser?.id || null,
        items: cart.map((c) => ({ menu_id: c.menu_id, quantity: c.quantity }))
      };

      const res = await axios.post(`${API_BASE_URL}/api/orders`, payload);
      if (res.data?.success) {
        onOrderCreated?.(res.data.order);
        onClose();
      } else {
        setError(res.data?.message || 'Failed to place order.');
      }
    } catch (err) {
      console.error('Order creation error:', err);
      setError(err.response?.data?.message || 'Failed to submit order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Create New Restaurant Order</h3>
            <p className="text-xs text-slate-500">Manager POS Quick Order Dispatch</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center font-bold"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {error}
            </div>
          )}

          {/* Table & Customer Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Table Number</label>
              <select
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 30 }, (_, i) => i + 1).map((t) => (
                  <option key={t} value={t}>
                    Table {String(t).padStart(2, '0')}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Customer Name (Optional)</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phone Number (Optional)</label>
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Menu Item Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">Select Menu Items</label>
              <input
                type="text"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Filter dishes..."
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs w-48"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto p-1 border border-slate-100 rounded-xl bg-slate-50">
              {filteredMenu.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="p-2 bg-white rounded-lg border border-slate-200 hover:border-blue-400 text-left transition-all hover:shadow-2xs"
                >
                  <div className="font-bold text-xs text-slate-800 truncate">{item.name}</div>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                    <span>₹{item.price}</span>
                    <span className="text-blue-600 font-bold">+ Add</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Cart */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              Selected Order Items ({cart.length})
            </label>
            {cart.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                Click items above to add them to this order ticket.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.menu_id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs"
                  >
                    <div className="font-bold text-slate-800">{item.name}</div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-600">₹{(item.price * item.quantity).toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menu_id, -1)}
                          className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.menu_id, 1)}
                          className="w-5 h-5 rounded bg-white border border-slate-200 flex items-center justify-center font-bold text-slate-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Subtotal */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 font-bold uppercase">Estimated Total</span>
              <div className="text-xl font-black text-slate-900">₹{totalAmount.toFixed(2)}</div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || cart.length === 0}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs"
              >
                {submitting ? 'Sending to Kitchen...' : 'Place Order Now'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ManagerNewOrderModal;
