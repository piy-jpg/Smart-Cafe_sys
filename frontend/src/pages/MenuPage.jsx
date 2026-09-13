import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { getMenuImage, getFallbackMenuArt } from '../lib/menuArt';
import { normalizeMenuItemType } from '../lib/menuItemTypes';

const MenuPage = () => {
  const [menu, setMenu] = useState([]);
  const [categories, setCategories] = useState(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [vegFilter, setVegFilter] = useState('all'); // all, veg, non-veg
  const [availabilityFilter, setAvailabilityFilter] = useState('all'); // all, available, unavailable
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMenu = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/menu?includeUnavailable=true`);
      const menuItems = response.data.menu || [];
      setMenu(menuItems);
      
      const uniqueCategories = ['All', ...new Set(menuItems.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to fetch menu:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  const filteredMenu = useMemo(() => {
    let filtered = menu;

    // Category filter
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(search) ||
        item.description?.toLowerCase().includes(search)
      );
    }

    // Veg/Non-veg filter
    if (vegFilter !== 'all') {
      filtered = filtered.filter(item => {
        const itemType = normalizeMenuItemType(item.item_type);
        return vegFilter === 'veg' ? itemType === 'Veg' : itemType === 'Non Veg';
      });
    }

    // Availability filter
    if (availabilityFilter !== 'all') {
      filtered = filtered.filter(item => 
        availabilityFilter === 'available' ? item.available !== false : item.available === false
      );
    }

    return filtered;
  }, [menu, selectedCategory, searchTerm, vegFilter, availabilityFilter]);

  const isVegItem = (item) => {
    return normalizeMenuItemType(item?.item_type) === 'Veg';
  };

  const handleAddToCart = () => {
    if (!selectedItem) return;

    const cartItem = {
      menu_id: selectedItem.id,
      name: selectedItem.name,
      price: selectedItem.price,
      quantity,
      special_instructions,
      category: selectedItem.category
    };

    setCart(prev => {
      const existing = prev.find(item => item.menu_id === selectedItem.id);
      if (existing) {
        return prev.map(item => 
          item.menu_id === selectedItem.id 
            ? { ...item, quantity: item.quantity + quantity, special_instructions }
            : item
        );
      }
      return [...prev, cartItem];
    });

    // Reset selection
    setSelectedItem(null);
    setQuantity(1);
    setSpecialInstructions('');
  };

  const updateCartItemQuantity = (menuId, delta) => {
    setCart(prev => prev
      .map(item => item.menu_id === menuId ? { ...item, quantity: item.quantity + delta } : item)
      .filter(item => item.quantity > 0)
    );
  };

  const removeCartItem = (menuId) => {
    setCart(prev => prev.filter(item => item.menu_id !== menuId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleSendToKitchen = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // This would normally send to the current selected table
    // For now, we'll just show a success message
    alert(`Order with ${cart.length} items sent to kitchen! Total: ₹${cartTotal}`);
    setCart([]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading menu...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Menu</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Browse menu and add items to orders
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Cart: {cart.length} items
          </span>
          <span className="font-semibold">₹{cartTotal.toLocaleString()}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Category Filter */}
        <div className="flex gap-1 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedCategory === category 
                  ? 'bg-[var(--color-accent)] text-white' 
                  : 'bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-slate-50'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search menu items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Veg/Non-Veg Filter */}
        <select
          value={vegFilter}
          onChange={(e) => setVegFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Items</option>
          <option value="veg">Veg Only</option>
          <option value="non-veg">Non-Veg Only</option>
        </select>

        {/* Availability Filter */}
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
          className="input-field"
        >
          <option value="all">All Availability</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Menu Items Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMenu.map(item => (
              <div
                key={item.id}
                className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md ${
                  item.available === false ? 'border-red-200 opacity-60' : 'border-[var(--color-border)]'
                }`}
              >
                {/* Item Image */}
                <div className="relative h-32 bg-slate-100">
                  <img
                    src={getMenuImage(item)}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = getFallbackMenuArt(item);
                    }}
                  />
                  {item.available === false && (
                    <div className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                      Unavailable
                    </div>
                  )}
                  <div className="absolute top-2 left-2">
                    {isVegItem(item) ? (
                      <div className="w-4 h-4 border-2 border-green-600 bg-green-600 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 border-2 border-red-600 bg-red-600 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Item Details */}
                <div className="p-4">
                  <h3 className="font-semibold text-[var(--color-text)] mb-1">{item.name}</h3>
                  <p className="text-sm text-[var(--color-text-secondary)] mb-2 line-clamp-2">
                    {item.description || 'No description available'}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-lg">₹{item.price?.toFixed(0) || '0'}</span>
                    <button
                      onClick={() => {
                        setSelectedItem(item);
                        setQuantity(1);
                        setSpecialInstructions('');
                      }}
                      disabled={item.available === false}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        item.available === false
                          ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                          : 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)]'
                      }`}
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredMenu.length === 0 && (
            <div className="text-center py-12 text-[var(--color-text-secondary)]">
              <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p>No menu items found</p>
            </div>
          )}
        </div>

        {/* Cart Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-sm sticky top-24">
            <div className="p-4 border-b border-[var(--color-border)]">
              <h3 className="font-semibold">Current Order</h3>
            </div>

            <div className="p-4 max-h-[400px] overflow-auto">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">
                  <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <p>Cart is empty</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item, index) => (
                    <div key={index} className="p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{item.name}</div>
                          <div className="text-xs text-[var(--color-text-secondary)]">₹{item.price} each</div>
                          {item.special_instructions && (
                            <div className="text-xs text-amber-600 mt-1">
                              Note: {item.special_instructions}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => removeCartItem(item.menu_id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartItemQuantity(item.menu_id, -1)}
                            className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                          >
                            -
                          </button>
                          <span className="font-medium">{item.quantity}</span>
                          <button
                            onClick={() => updateCartItemQuantity(item.menu_id, 1)}
                            className="w-6 h-6 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                        <div className="font-semibold">₹{(item.price * item.quantity).toFixed(0)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-[var(--color-border)] space-y-3">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>₹{cartTotal.toLocaleString()}</span>
                </div>
                <button
                  onClick={handleSendToKitchen}
                  className="btn btn-primary w-full"
                >
                  Send to Kitchen
                </button>
                <button
                  onClick={() => setCart([])}
                  className="btn btn-secondary w-full"
                >
                  Clear Cart
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Item Selection Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedItem.name}</h3>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-2 rounded hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <img
                  src={getMenuImage(selectedItem)}
                  alt={selectedItem.name}
                  className="w-full h-32 object-cover rounded-lg"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = getFallbackMenuArt(selectedItem);
                  }}
                />
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                {selectedItem.description || 'No description available'}
              </p>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Quantity</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-8 h-8 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                  >
                    -
                  </button>
                  <span className="font-medium w-8 text-center">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-8 h-8 rounded bg-slate-200 hover:bg-slate-300 flex items-center justify-center"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Special Instructions</label>
                <textarea
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests?"
                  className="input-field w-full h-20 resize-none"
                />
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[var(--color-text-secondary)]">Price per item</span>
                <span className="font-semibold">₹{selectedItem.price?.toFixed(0) || '0'}</span>
              </div>

              <div className="flex items-center justify-between text-lg font-bold">
                <span>Total</span>
                <span>₹{(selectedItem.price * quantity).toFixed(0) || '0'}</span>
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)]">
              <button
                onClick={handleAddToCart}
                className="btn btn-primary w-full"
              >
                Add to Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuPage;