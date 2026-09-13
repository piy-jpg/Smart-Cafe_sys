import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';

// Standard preparation time estimates for common categories
const getEstimatedPrepTime = (category) => {
  switch (category?.toLowerCase()) {
    case 'starters':
    case 'appetizers':
      return '8 - 12 mins';
    case 'main course':
    case 'mains':
      return '15 - 20 mins';
    case 'breads':
    case 'roti':
    case 'naan':
      return '4 - 6 mins';
    case 'rice':
    case 'biryani':
      return '12 - 15 mins';
    case 'beverages':
    case 'drinks':
      return '3 - 5 mins';
    case 'desserts':
      return '4 - 8 mins';
    default:
      return '10 - 15 mins';
  }
};

const KitchenMenuPage = ({ menu = [], onMenuUpdated }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [vegFilter, setVegFilter] = useState('all'); // 'all' | 'veg' | 'non-veg'
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [notice, setNotice] = useState('');

  // Extract unique categories
  const categories = useMemo(() => {
    const cats = new Set(menu.map((i) => i.category).filter(Boolean));
    return ['All', ...Array.from(cats)];
  }, [menu]);

  const filteredItems = useMemo(() => {
    return menu
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (vegFilter === 'veg' && item.item_type !== 'Veg') return false;
        if (vegFilter === 'non-veg' && item.item_type === 'Veg') return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return item.name.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menu, selectedCategory, vegFilter, search]);

  const toggleAvailability = async (item) => {
    try {
      setUpdatingItemId(item.id);
      const newAvailable = !item.available;
      const newStock = newAvailable ? (item.stock_quantity > 0 ? item.stock_quantity : 50) : 0;

      await axios.put(`${API_BASE_URL}/api/menu/${item.id}`, {
        available: newAvailable,
        stock_quantity: newStock,
      });

      setNotice(
        `Marked "${item.name}" as ${newAvailable ? 'AVAILABLE (In Stock)' : 'OUT OF STOCK'}. Updated across entire system.`
      );
      setTimeout(() => setNotice(''), 4000);

      if (onMenuUpdated) {
        onMenuUpdated();
      }
    } catch (error) {
      console.error('Failed to update item availability:', error);
      alert('Failed to update menu item status. Please try again.');
    } finally {
      setUpdatingItemId(null);
    }
  };

  const availableCount = menu.filter((i) => i.available !== false && (i.stock_quantity || 0) > 0).length;
  const outOfStockCount = menu.filter((i) => i.available === false || (i.stock_quantity || 0) <= 0).length;

  return (
    <div className="space-y-5">
      {/* Notice Banner */}
      {notice && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-bold text-blue-800 flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{notice}</span>
        </div>
      )}

      {/* Top Banner with Quick Stats */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Kitchen Live Menu Stock & Availability</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Mark ingredients or dishes out of stock with one click. Realtime changes reflect on Waiter POS and QR menus instantly.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>{availableCount} Available</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span>{outOfStockCount} Out of Stock</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dish name, category..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Veg / Non-Veg Radio Buttons */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'all', label: 'All Types' },
              { id: 'veg', label: 'Veg' },
              { id: 'non-veg', label: 'Non-Veg' },
            ].map((v) => (
              <button
                key={v.id}
                onClick={() => setVegFilter(v.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  vegFilter === v.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items Table / Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Dish / Item Name</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Est. Prep Time</th>
                <th className="py-3.5 px-4">Current Stock</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Kitchen Stock Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No menu items match your search or filter.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isVeg = item.item_type === 'Veg';
                  const isAvailable = item.available !== false && (item.stock_quantity || 0) > 0;
                  const isUpdating = updatingItemId === item.id;
                  const prepTime = getEstimatedPrepTime(item.category);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        !isAvailable ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Name */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                        <div className="text-[11px] text-slate-400">₹{item.price}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.category || 'General'}
                        </span>
                      </td>

                      {/* Veg / Non-Veg */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              isVeg ? 'border-emerald-600' : 'border-rose-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          </span>
                          <span className="font-semibold text-slate-700">{isVeg ? 'Veg' : 'Non-Veg'}</span>
                        </div>
                      </td>

                      {/* Prep Time */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1 font-mono font-medium text-slate-600">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{prepTime}</span>
                        </div>
                      </td>

                      {/* Stock Quantity */}
                      <td className="py-3.5 px-4 font-bold">
                        <span className={isAvailable ? 'text-slate-800' : 'text-rose-600 font-extrabold'}>
                          {item.stock_quantity ?? 0} units
                        </span>
                      </td>

                      {/* Availability Badge */}
                      <td className="py-3.5 px-4">
                        {isAvailable ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                            AVAILABLE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            OUT OF STOCK
                          </span>
                        )}
                      </td>

                      {/* 1-Click Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        {isAvailable ? (
                          <button
                            onClick={() => toggleAvailability(item)}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 active:scale-98 transition-all disabled:opacity-50"
                          >
                            {isUpdating ? 'Updating...' : 'MARK OUT OF STOCK'}
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleAvailability(item)}
                            disabled={isUpdating}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 active:scale-98 transition-all disabled:opacity-50"
                          >
                            {isUpdating ? 'Updating...' : 'MARK AVAILABLE'}
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
    </div>
  );
};

export default KitchenMenuPage;
