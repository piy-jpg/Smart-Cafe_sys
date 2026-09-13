import React, { useMemo, useState } from 'react';
import { normalizeMenuItemType } from '../lib/menuItemTypes';
import { getMenuImage, getFallbackMenuArt } from '../lib/menuArt';

const AddItemModal = ({
  isOpen,
  onClose,
  menu = [],
  cart = [],
  onAddToCart,
  onUpdateCartQuantity,
  tableNumber,
  isAddOn = false,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [dietFilter, setDietFilter] = useState('all'); // 'all' | 'veg' | 'non-veg'
  const [itemNotes, setItemNotes] = useState({});
  const [activeNoteItemId, setActiveNoteItemId] = useState(null);

  // Dynamic categories
  const categories = useMemo(() => {
    const raw = ['All', ...new Set(menu.map((m) => m.category).filter(Boolean))];
    return raw;
  }, [menu]);

  // Filtered menu
  const filteredMenu = useMemo(() => {
    return menu
      .filter((item) => {
        // Category filter
        if (selectedCategory !== 'All' && item.category !== selectedCategory) return false;

        // Diet filter
        const isNonVeg = normalizeMenuItemType(item.item_type) === 'Non Veg';
        if (dietFilter === 'veg' && isNonVeg) return false;
        if (dietFilter === 'non-veg' && !isNonVeg) return false;

        // Search query
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const nameMatch = item.name.toLowerCase().includes(q);
          const descMatch = (item.description || '').toLowerCase().includes(q);
          const catMatch = (item.category || '').toLowerCase().includes(q);
          return nameMatch || descMatch || catMatch;
        }

        return true;
      })
      .sort((a, b) => (b.available !== false ? 1 : 0) - (a.available !== false ? 1 : 0));
  }, [menu, selectedCategory, dietFilter, search]);

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (parseFloat(item.price || 0) * item.quantity), 0);
  }, [cart]);

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 sm:px-6 sm:py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-blue-600 text-white">
                Table {String(tableNumber).padStart(2, '0')}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                {isAddOn ? 'Add Extra Items (Kitchen KOT)' : 'Select Menu Items'}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Tap items to add them directly to the table order.
            </p>
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

        {/* Search & Filter Bar */}
        <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by dish name, category, or code..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                autoFocus
              />
              <svg className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Diet Filter Toggle */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <button
                onClick={() => setDietFilter('all')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  dietFilter === 'all'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setDietFilter('veg')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  dietFilter === 'veg'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-emerald-700 hover:text-emerald-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-emerald-300 ring-1 ring-white" />
                Veg Only
              </button>
              <button
                onClick={() => setDietFilter('non-veg')}
                className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                  dietFilter === 'non-veg'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-rose-700 hover:text-rose-800'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-300 ring-1 ring-white" />
                Non-Veg
              </button>
            </div>
          </div>

          {/* Categories Pill Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Menu Items Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50">
          {filteredMenu.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <div className="font-bold text-sm text-slate-700">No matching menu items</div>
              <p className="text-xs text-slate-400 mt-0.5">Try searching for a different dish name or category.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {filteredMenu.map((item) => {
                const isNonVeg = normalizeMenuItemType(item.item_type) === 'Non Veg';
                const isAvailable = item.available !== false && (item.stock_quantity ?? 10) > 0;
                const cartItem = cart.find((c) => c.menu_id === item.id);
                const quantityInCart = cartItem?.quantity || 0;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all ${
                      quantityInCart > 0
                        ? 'border-blue-500 shadow-md ring-1 ring-blue-500/20 bg-blue-50/20'
                        : isAvailable
                          ? 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
                          : 'border-slate-200 opacity-60 bg-slate-50'
                    }`}
                  >
                    <div>
                      <div className="flex gap-2.5">
                        {/* Dish Photo Thumbnail */}
                        <img
                          src={item.image_url || getMenuImage(item)}
                          alt={item.name}
                          className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-100 shadow-2xs"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = getFallbackMenuArt(item);
                          }}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5">
                            {/* Veg/Non-Veg Badge + Title */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                title={isNonVeg ? 'Non-Vegetarian' : 'Vegetarian'}
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                  isNonVeg ? 'border-rose-500' : 'border-emerald-600'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isNonVeg ? 'bg-rose-500' : 'bg-emerald-600'}`} />
                              </span>
                              <span className="text-xs font-bold text-slate-900 leading-tight truncate">
                                {item.name}
                              </span>
                            </div>

                            {/* Availability Tag */}
                            {!isAvailable && (
                              <span className="px-1.5 py-0.5 bg-slate-200 text-slate-600 text-[9px] font-bold rounded shrink-0">
                                Sold Out
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                            <span className="text-[11px] text-slate-400 font-medium truncate">
                              {item.category || 'Kitchen'}
                            </span>
                            <span className="text-xs font-black text-slate-900">
                              ₹{parseFloat(item.price || 0).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action button or Stepper */}
                    <div className="mt-3 pt-2 border-t border-slate-100/80 flex items-center justify-between">
                      {/* Kitchen Note toggle */}
                      <button
                        onClick={() => setActiveNoteItemId(activeNoteItemId === item.id ? null : item.id)}
                        className={`text-[11px] font-semibold flex items-center gap-1 transition-colors ${
                          itemNotes[item.id] ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600'
                        }`}
                        title="Special cooking instructions (e.g., Less spicy, no butter)"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        {itemNotes[item.id] ? 'Note added' : 'Note'}
                      </button>

                      {/* Stepper or Add button */}
                      {quantityInCart > 0 ? (
                        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg p-0.5">
                          <button
                            onClick={() => onUpdateCartQuantity(item.id, -1)}
                            className="w-6 h-6 rounded bg-white text-blue-700 hover:bg-blue-100 font-bold text-xs flex items-center justify-center shadow-2xs"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-black text-blue-950">
                            {quantityInCart}
                          </span>
                          <button
                            onClick={() => onUpdateCartQuantity(item.id, 1)}
                            disabled={!isAvailable}
                            className="w-6 h-6 rounded bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs flex items-center justify-center shadow-2xs disabled:opacity-50"
                          >
                            +
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => onAddToCart(item, itemNotes[item.id])}
                          disabled={!isAvailable}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-blue-600 disabled:bg-slate-200 text-white disabled:text-slate-400 rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1"
                        >
                          <span>+ ADD</span>
                        </button>
                      )}
                    </div>

                    {/* Note Input Box when toggled */}
                    {activeNoteItemId === item.id && (
                      <div className="mt-2 pt-2 border-t border-slate-100 animate-in fade-in">
                        <input
                          type="text"
                          value={itemNotes[item.id] || ''}
                          onChange={(e) => setItemNotes({ ...itemNotes, [item.id]: e.target.value })}
                          placeholder="e.g. Less spicy, well done..."
                          className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer with Cart Summary & Done Button */}
        <div className="p-4 sm:px-6 sm:py-3.5 border-t border-slate-200 bg-white flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">
              Selected in Cart: <span className="font-bold text-slate-900">{cartCount} items</span>
            </div>
            <div className="text-sm font-black text-slate-900 mt-0.5">
              Draft Total: ₹{cartTotal.toLocaleString()}
            </div>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            Done • Review Order →
          </button>
        </div>

      </div>
    </div>
  );
};

export default AddItemModal;
