import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';

const ManagerInventoryView = ({ menu = [], onMenuUpdated }) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'low' | 'out' | 'healthy'
  const [search, setSearch] = useState('');
  const [restockItem, setRestockItem] = useState(null);
  const [restockQty, setRestockQty] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const filteredItems = useMemo(() => {
    return menu
      .filter((item) => {
        const stock = Number(item.stock_quantity ?? 0);
        const isOut = stock <= 0 || item.available === false;
        const isLow = stock > 0 && stock <= 5;
        const isHealthy = stock > 5;

        if (filter === 'low') return isLow;
        if (filter === 'out') return isOut;
        if (filter === 'healthy') return isHealthy;
        return true;
      })
      .filter((item) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return item.name.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
      })
      .sort((a, b) => Number(a.stock_quantity ?? 0) - Number(b.stock_quantity ?? 0));
  }, [menu, filter, search]);

  const counts = useMemo(() => {
    const total = menu.length;
    const outCount = menu.filter((i) => (Number(i.stock_quantity ?? 0) <= 0) || i.available === false).length;
    const lowCount = menu.filter((i) => Number(i.stock_quantity ?? 0) > 0 && Number(i.stock_quantity ?? 0) <= 5).length;
    const healthyCount = menu.filter((i) => Number(i.stock_quantity ?? 0) > 5 && i.available !== false).length;
    return { total, outCount, lowCount, healthyCount };
  }, [menu]);

  const handleRestock = async (e) => {
    e.preventDefault();
    if (!restockItem) return;

    try {
      setSubmitting(true);
      const qtyToAdd = parseInt(restockQty, 10);

      await axios.put(`${API_BASE_URL}/api/menu/${restockItem.id}`, {
        restock_quantity: qtyToAdd,
        available: true,
      });

      setNotice(`Restocked ${restockItem.name} with +${qtyToAdd} units.`);
      setTimeout(() => setNotice(''), 4000);
      setRestockItem(null);
      onMenuUpdated?.();
    } catch (err) {
      console.error('Failed to restock item:', err);
      alert('Failed to restock menu item.');
    } finally {
      setSubmitting(false);
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

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Items Monitored</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{counts.total}</div>
          <span className="text-[11px] text-slate-400">Active catalog dishes</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Out of Stock</span>
          <div className="text-2xl font-black text-rose-600 mt-2">{counts.outCount}</div>
          <span className="text-[11px] text-rose-600 font-semibold">Immediate re-order required</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Low Stock (&le; 5 units)</span>
          <div className="text-2xl font-black text-amber-600 mt-2">{counts.lowCount}</div>
          <span className="text-[11px] text-amber-700 font-semibold">Watch warning</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Healthy Stock</span>
          <div className="text-2xl font-black text-emerald-700 mt-2">{counts.healthyCount}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Sufficient stock level</span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Items', count: counts.total, color: 'bg-slate-900 text-white' },
            { id: 'out', label: 'Out of Stock', count: counts.outCount, color: 'bg-rose-600 text-white' },
            { id: 'low', label: 'Low Stock', count: counts.lowCount, color: 'bg-amber-600 text-white' },
            { id: 'healthy', label: 'Healthy Stock', count: counts.healthyCount, color: 'bg-emerald-600 text-white' },
          ].map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
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
            placeholder="Search stock item..."
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

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Current Stock</th>
                <th className="py-3 px-4">Lifetime Received</th>
                <th className="py-3 px-4">Stock Status</th>
                <th className="py-3 px-4 text-right">Quick Restock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No inventory records match the selected filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const stock = Number(item.stock_quantity ?? 0);
                  const isOut = stock <= 0 || item.available === false;
                  const isLow = stock > 0 && stock <= 5;

                  let statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  let statusLabel = 'IN STOCK';

                  if (isOut) {
                    statusBadge = 'bg-rose-100 text-rose-800 border-rose-200';
                    statusLabel = 'OUT OF STOCK';
                  } else if (isLow) {
                    statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                    statusLabel = 'LOW STOCK';
                  }

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                        <span className="text-[11px] text-slate-400 ml-2">₹{item.price}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{item.category || 'Main Course'}</td>
                      <td className="py-3 px-4 font-black text-sm">
                        <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-700' : 'text-slate-900'}>
                          {stock} units
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-medium">
                        {item.total_received || stock} units
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge}`}>
                          {statusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setRestockItem(item)}
                          className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg transition-colors"
                        >
                          + Restock Units
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

      {/* Restock Modal */}
      {restockItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Restock Inventory</h3>
                <p className="text-xs text-slate-500">{restockItem.name}</p>
              </div>
              <button
                onClick={() => setRestockItem(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRestock} className="p-5 space-y-4 text-xs">
              <div>
                <span className="text-slate-500 block mb-1">Current Stock on Hand:</span>
                <span className="text-lg font-black text-slate-900">{restockItem.stock_quantity || 0} units</span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Units to Add into Stock:</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={restockQty}
                  onChange={(e) => setRestockQty(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-black text-base text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex items-center gap-2">
                {[10, 25, 50, 100].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRestockQty(preset)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 font-bold text-slate-700 text-xs"
                  >
                    +{preset}
                  </button>
                ))}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRestockItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {submitting ? 'Applying...' : 'Confirm Restock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerInventoryView;
