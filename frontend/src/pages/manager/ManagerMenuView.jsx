import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';
import { getMenuCategoryOptions } from '../../lib/menuCategories';
import { readImageFileAsDataUrl } from '../../lib/menuImageUpload';

const ManagerMenuView = ({ menu = [], onMenuUpdated }) => {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'Veg' | 'Non-Veg'
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // New Item State
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'Main Course',
    price: '',
    stock_quantity: 50,
    item_type: 'Veg',
    image_url: '',
  });

  const categories = useMemo(() => {
    const list = getMenuCategoryOptions(menu);
    return ['All', ...list];
  }, [menu]);

  const filteredItems = useMemo(() => {
    return menu
      .filter((item) => {
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;
        if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return item.name.toLowerCase().includes(q) || (item.category || '').toLowerCase().includes(q);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [menu, selectedCategory, typeFilter, search]);

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItem.name.trim() || !newItem.price) {
      alert('Please provide item name and price.');
      return;
    }

    try {
      setSubmitting(true);
      await axios.post(`${API_BASE_URL}/api/menu`, {
        ...newItem,
        price: parseFloat(newItem.price),
        stock_quantity: parseInt(newItem.stock_quantity || 0, 10),
      });

      setIsAddModalOpen(false);
      setNewItem({
        name: '',
        category: 'Main Course',
        price: '',
        stock_quantity: 50,
        item_type: 'Veg',
        image_url: '',
      });
      onMenuUpdated?.();
    } catch (err) {
      console.error('Failed to add item:', err);
      alert('Failed to add menu item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      setSubmitting(true);
      await axios.put(`${API_BASE_URL}/api/menu/${editingItem.id}`, {
        name: editingItem.name,
        price: parseFloat(editingItem.price),
        category: editingItem.category,
        item_type: editingItem.item_type,
        stock_quantity: parseInt(editingItem.stock_quantity || 0, 10),
        image_url: editingItem.image_url || null,
        available: editingItem.available,
      });

      setEditingItem(null);
      onMenuUpdated?.();
    } catch (err) {
      console.error('Failed to update item:', err);
      alert('Failed to update item.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAvailable = async (item) => {
    try {
      const nextAvailable = !item.available;
      await axios.put(`${API_BASE_URL}/api/menu/${item.id}`, {
        available: nextAvailable,
        stock_quantity: nextAvailable ? (item.stock_quantity > 0 ? item.stock_quantity : 50) : 0,
      });
      onMenuUpdated?.();
    } catch (err) {
      console.error('Failed to toggle availability:', err);
      alert('Failed to toggle status.');
    }
  };

  const handleDeleteItem = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from the menu master?`)) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/menu/${id}`);
      onMenuUpdated?.();
    } catch (err) {
      console.error('Failed to delete item:', err);
      alert('Failed to delete menu item.');
    }
  };

  const handleImageUpload = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      if (isEdit) {
        setEditingItem((prev) => prev ? { ...prev, image_url: dataUrl } : null);
      } else {
        setNewItem((prev) => ({ ...prev, image_url: dataUrl }));
      }
    } catch (err) {
      console.error('Image read failed:', err);
    }
  };

  return (
    <div className="space-y-5">
      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search & Type Filter */}
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes or categories..."
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

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {['all', 'Veg', 'Non-Veg'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  typeFilter === t ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>
        </div>

        {/* Add Item Button */}
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs whitespace-nowrap"
        >
          <span>+</span> Add Menu Item
        </button>
      </div>

      {/* Category Pills */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-2xs flex items-center gap-1.5 overflow-x-auto">
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

      {/* Menu Master Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Price</th>
                <th className="py-3 px-4">Stock Level</th>
                <th className="py-3 px-4">Availability</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No menu items found. Click "+ Add Menu Item" to expand the catalog.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isVeg = item.item_type === 'Veg';
                  const isAvailable = item.available !== false && (item.stock_quantity || 0) > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Name */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-sm">{item.name}</div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 font-semibold text-slate-600">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 border border-slate-200">
                          {item.category || 'General'}
                        </span>
                      </td>

                      {/* Veg / Non-Veg */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                              isVeg ? 'border-emerald-600' : 'border-rose-600'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${isVeg ? 'bg-emerald-600' : 'bg-rose-600'}`} />
                          </span>
                          <span className="font-semibold text-slate-700">{item.item_type || 'Veg'}</span>
                        </div>
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        ₹{parseFloat(item.price || 0).toFixed(2)}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 font-bold">
                        <span className={item.stock_quantity <= 5 ? 'text-rose-600 font-extrabold' : 'text-slate-800'}>
                          {item.stock_quantity ?? 0} units
                        </span>
                      </td>

                      {/* Available Toggle */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleAvailable(item)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border transition-all ${
                            isAvailable
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                              : 'bg-rose-100 text-rose-800 border-rose-200 hover:bg-rose-200'
                          }`}
                        >
                          {isAvailable ? 'AVAILABLE' : 'OUT OF STOCK'}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.name)}
                            className="px-2 py-1 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                          >
                            Delete
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
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">Add New Menu Item</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="e.g. Paneer Butter Masala"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newItem.price}
                    onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="250"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Initial Stock</label>
                  <input
                    type="number"
                    value={newItem.stock_quantity}
                    onChange={(e) => setNewItem({ ...newItem, stock_quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    placeholder="e.g. Main Course"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Food Type</label>
                  <select
                    value={newItem.item_type}
                    onChange={(e) => setNewItem({ ...newItem, item_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Veg">Veg (Green)</option>
                    <option value="Non-Veg">Non-Veg (Red)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Upload Photo (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, false)}
                  className="w-full text-slate-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Add to Menu Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900 text-base">Edit: {editingItem.name}</h3>
              <button
                onClick={() => setEditingItem(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateItem} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Item Name</label>
                <input
                  type="text"
                  required
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editingItem.price}
                    onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Units</label>
                  <input
                    type="number"
                    value={editingItem.stock_quantity}
                    onChange={(e) => setEditingItem({ ...editingItem, stock_quantity: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Category</label>
                  <input
                    type="text"
                    value={editingItem.category}
                    onChange={(e) => setEditingItem({ ...editingItem, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Food Type</label>
                  <select
                    value={editingItem.item_type || 'Veg'}
                    onChange={(e) => setEditingItem({ ...editingItem, item_type: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Veg">Veg</option>
                    <option value="Non-Veg">Non-Veg</option>
                  </select>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl shadow-xs"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerMenuView;
