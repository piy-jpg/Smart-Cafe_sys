import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';
import { normalizeMenuItemType } from '../../lib/menuItemTypes';
import { getMenuImage, getFallbackMenuArt } from '../../lib/menuArt';

const OwnerMenuView = ({ menu = [], onMenuUpdated }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  // New Item State
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Hot Coffee',
    price: '',
    stock_quantity: '50',
    item_type: 'Veg',
    description: '',
    image_url: '',
  });

  const categories = useMemo(() => {
    return ['All', ...new Set(menu.map((m) => m.category).filter(Boolean))];
  }, [menu]);

  const filteredMenu = useMemo(() => {
    return menu
      .filter((m) => selectedCategory === 'All' || m.category === selectedCategory)
      .filter((m) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return m.name.toLowerCase().includes(q) || (m.category || '').toLowerCase().includes(q);
      });
  }, [menu, selectedCategory, search]);

  const handleCreateItem = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await axios.post(`${API_BASE_URL}/api/menu`, {
        name: newItem.name.trim(),
        category: newItem.category,
        price: parseFloat(newItem.price || 0),
        stock_quantity: parseInt(newItem.stock_quantity || 0, 10),
        item_type: newItem.item_type,
        description: newItem.description.trim() || null,
        image_url: newItem.image_url.trim() || null,
        available: true,
      });

      setNewItem({
        name: '',
        category: 'Hot Coffee',
        price: '',
        stock_quantity: '50',
        item_type: 'Veg',
        description: '',
        image_url: '',
      });
      setShowAddModal(false);
      onMenuUpdated?.();
      setNotice('New menu dish added successfully.');
    } catch (err) {
      console.error(err);
      setNotice(err.response?.data?.message || 'Failed to create menu item.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (item) => {
    try {
      const nextAvailable = item.available === false;
      await axios.put(`${API_BASE_URL}/api/menu/${item.id}`, {
        available: nextAvailable,
        stock_quantity: nextAvailable ? Math.max(item.stock_quantity || 0, 10) : 0,
      });
      onMenuUpdated?.();
      setNotice(`Updated ${item.name} availability.`);
    } catch (err) {
      console.error(err);
      setNotice('Failed to update item availability.');
    }
  };

  const handleQuickRestock = async (item, amount) => {
    try {
      await axios.put(`${API_BASE_URL}/api/menu/${item.id}`, {
        restock_quantity: amount,
        available: true,
      });
      onMenuUpdated?.();
      setNotice(`Restocked ${amount} units for ${item.name}.`);
    } catch (err) {
      console.error(err);
      setNotice('Failed to restock item.');
    }
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to remove "${item.name}" from the menu catalog?`)) {
      return;
    }
    try {
      await axios.delete(`${API_BASE_URL}/api/menu/${item.id}`);
      onMenuUpdated?.();
      setNotice(`Removed ${item.name} from menu.`);
    } catch (err) {
      console.error(err);
      setNotice('Failed to delete menu item.');
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
            Menu Master Control
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure dish prices, stock quantities, availability, dietary tags, and new menu offerings.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dish..."
            className="w-48 sm:w-56 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>+ Add Dish</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="bg-blue-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-bold text-blue-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
              selectedCategory === cat
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Menu Items Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="pb-3 text-center">Diet</th>
                <th className="pb-3 text-center w-12">Photo</th>
                <th className="pb-3">Item Name</th>
                <th className="pb-3">Category</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3 text-center">Stock</th>
                <th className="pb-3 text-center">Availability</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMenu.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No menu items match this category.
                  </td>
                </tr>
              ) : (
                filteredMenu.map((item) => {
                  const isNonVeg = normalizeMenuItemType(item.item_type) === 'Non Veg';
                  const isAvailable = item.available !== false && (item.stock_quantity ?? 50) > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 text-center">
                        <span
                          className={`w-3.5 h-3.5 rounded border inline-flex items-center justify-center ${
                            isNonVeg ? 'border-rose-500' : 'border-emerald-600'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isNonVeg ? 'bg-rose-500' : 'bg-emerald-600'}`} />
                        </span>
                      </td>

                      <td className="py-2.5 text-center">
                        <img
                          src={item.image_url || getMenuImage(item)}
                          alt={item.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shadow-2xs inline-block bg-slate-100"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getFallbackMenuArt(item);
                          }}
                        />
                      </td>

                      <td className="py-2.5 font-bold text-slate-900">
                        {item.name}
                        {item.description && (
                          <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs">
                            {item.description}
                          </div>
                        )}
                      </td>

                      <td className="py-3 text-slate-600">{item.category}</td>

                      <td className="py-3 text-right font-black text-slate-900">
                        ₹{parseFloat(item.price || 0).toLocaleString()}
                      </td>

                      <td className="py-3 text-center">
                        <span className={`font-bold ${(item.stock_quantity ?? 0) < 10 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {item.stock_quantity ?? 50} units
                        </span>
                      </td>

                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isAvailable ? 'In Stock' : 'Unavailable'}
                        </button>
                      </td>

                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleQuickRestock(item, 25)}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
                            title="Restock +25 units"
                          >
                            +25
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item)}
                            className="px-2 py-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors"
                            title="Delete dish"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Add Menu Offering
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Dish Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Paneer Butter Masala"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Starters">Starters</option>
                    <option value="Main Course">Main Course</option>
                    <option value="Breads">Breads</option>
                    <option value="Rice">Rice</option>
                    <option value="Beverages">Beverages</option>
                    <option value="Desserts">Desserts</option>
                    <option value="Hot Coffee">Hot Coffee</option>
                    <option value="Snacks">Snacks</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Dietary Tag</label>
                  <select
                    value={newItem.item_type}
                    onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    <option value="Veg">Vegetarian</option>
                    <option value="Non Veg">Non-Vegetarian</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="280.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Initial Stock</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={newItem.stock_quantity}
                    onChange={(e) => setNewItem({ ...newItem, stock_quantity: e.target.value })}
                    placeholder="50"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Image URL (Optional)</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="url"
                    value={newItem.image_url || ''}
                    onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                    placeholder="https://images.unsplash.com/photo-..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
                  />
                  {newItem.image_url && (
                    <img
                      src={newItem.image_url}
                      alt="Preview"
                      className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="Ingredients or preparation note..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-900"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-xs"
                >
                  {saving ? 'Saving...' : 'Add to Menu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerMenuView;
