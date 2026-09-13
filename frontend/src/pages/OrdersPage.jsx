import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

const OrdersPage = () => {
  const currentUser = getStoredUser();
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'ready', label: 'Ready' },
    { id: 'served', label: 'Served' },
    { id: 'completed', label: 'Completed' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await fetchOrders();
      setLoading(false);
    };

    fetchData();

    // Realtime updates
    const handleOrderUpdate = (updatedOrder) => {
      setOrders(prev => {
        const exists = prev.some(order => order.id === updatedOrder.id);
        if (exists) {
          return prev.map(order => order.id === updatedOrder.id ? updatedOrder : order);
        }
        return [updatedOrder, ...prev];
      });
    };

    socket.on('newOrder', handleOrderUpdate);
    socket.on('orderStatusUpdated', handleOrderUpdate);
    socket.on('orderUpdated', handleOrderUpdate);

    return () => {
      socket.off('newOrder', handleOrderUpdate);
      socket.off('orderStatusUpdated', handleOrderUpdate);
      socket.off('orderUpdated', handleOrderUpdate);
    };
  }, []);

  const filteredOrders = useMemo(() => {
    let filtered = orders;

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(order => order.status === activeTab);
    }

    // Filter by search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(order => 
        order.id?.toString().includes(search) ||
        order.table_number?.toString().includes(search) ||
        order.customer_name?.toLowerCase().includes(search) ||
        order.items?.some(item => item.menu_item?.name?.toLowerCase().includes(search))
      );
    }

    // Sort by created date (newest first)
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, activeTab, searchTerm]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': return 'status-badge status-badge-warning';
      case 'preparing': return 'status-badge status-badge-info';
      case 'ready': return 'status-badge status-badge-success';
      case 'served': return 'status-badge status-badge-info';
      case 'completed': return 'status-badge status-badge-success';
      case 'cancelled': return 'status-badge status-badge-error';
      case 'waiting_bill': return 'status-badge status-badge-warning';
      default: return 'status-badge status-badge-info';
    }
  };

  const getOrderTotal = (order) => {
    return order.items?.reduce((sum, item) => 
      sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
    ) || 0;
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/status`, { status: newStatus });
      await fetchOrders();
    } catch (error) {
      console.error('Failed to update order status:', error);
      alert('Failed to update order status');
    }
  };

  const handleViewOrder = (order) => {
    setSelectedOrder(order);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading orders...</div>
      </div>
    );
  }

  const tabCounts = tabs.reduce((acc, tab) => {
    acc[tab.id] = orders.filter(order => tab.id === 'all' || order.status === tab.id).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Orders</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage and track all orders
          </p>
        </div>
        <button 
          onClick={() => window.location.href = '/waiter'}
          className="btn btn-primary"
        >
          + New Order
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)]">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === tab.id 
                  ? 'text-[var(--color-accent)]' 
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }`}
            >
              {tab.label}
              {tabCounts[tab.id] > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-slate-100">
                  {tabCounts[tab.id]}
                </span>
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-accent)]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by order ID, table, customer, or item..."
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

      {/* Orders List */}
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-sm">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p>No orders found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filteredOrders.map((order) => (
              <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-[var(--color-text)]">#{order.id}</span>
                      <span className="text-sm text-[var(--color-text-secondary)]">
                        Table {order.table_number}
                      </span>
                      <span className={getStatusBadge(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-[var(--color-text-secondary)] mb-2">
                      {order.customer_name || 'Walk-in Customer'}
                      {order.customer_phone && ` • ${order.customer_phone}`}
                    </div>

                    <div className="flex flex-wrap gap-2 mb-2">
                      {order.items?.slice(0, 3).map((item, index) => (
                        <span key={index} className="text-xs bg-slate-100 px-2 py-1 rounded">
                          {item.menu_item?.name || item.name} ×{item.quantity}
                        </span>
                      ))}
                      {order.items?.length > 3 && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          +{order.items.length - 3} more
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                      <span>{formatDate(order.created_at)}</span>
                      <span>{formatTime(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="text-right ml-4">
                    <div className="font-semibold text-lg">₹{getOrderTotal(order).toLocaleString()}</div>
                    <div className="text-sm text-[var(--color-text-secondary)]">
                      {order.items?.length || 0} items
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleViewOrder(order)}
                    className="btn btn-secondary text-xs"
                  >
                    View Details
                  </button>
                  {order.status === 'pending' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'preparing')}
                      className="btn btn-primary text-xs"
                    >
                      Start Preparing
                    </button>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'ready')}
                      className="btn btn-success text-xs"
                    >
                      Mark Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'served')}
                      className="btn btn-primary text-xs"
                    >
                      Mark Served
                    </button>
                  )}
                  {order.status === 'served' && (
                    <button
                      onClick={() => handleStatusChange(order.id, 'waiting_bill')}
                      className="btn btn-warning text-xs"
                    >
                      Request Bill
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Order #{selectedOrder.id}</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 rounded hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Table</div>
                  <div className="font-semibold">{selectedOrder.table_number}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Status</div>
                  <div className="font-semibold">
                    <span className={getStatusBadge(selectedOrder.status)}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Customer</div>
                  <div className="font-semibold">{selectedOrder.customer_name || 'Walk-in'}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Phone</div>
                  <div className="font-semibold">{selectedOrder.customer_phone || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Created</div>
                  <div className="font-semibold">{formatDate(selectedOrder.created_at)} {formatTime(selectedOrder.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Total</div>
                  <div className="font-semibold">₹{getOrderTotal(selectedOrder).toLocaleString()}</div>
                </div>
              </div>

              <h4 className="font-semibold mb-3">Order Items</h4>
              <div className="space-y-2 mb-6">
                {selectedOrder.items?.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">{item.menu_item?.name || item.name}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        ₹{item.menu_item?.price || item.price} × {item.quantity}
                      </div>
                    </div>
                    <div className="font-semibold">
                      ₹{((item.menu_item?.price || item.price) * item.quantity).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>

              {selectedOrder.special_instructions && (
                <div className="mb-6">
                  <h4 className="font-semibold mb-2">Special Instructions</h4>
                  <p className="text-sm text-[var(--color-text-secondary)] bg-amber-50 p-3 rounded-lg">
                    {selectedOrder.special_instructions}
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
              <button
                onClick={() => window.location.href = `/waiter?table=${selectedOrder.table_number}`}
                className="btn btn-primary flex-1"
              >
                Add Items
              </button>
              <button
                onClick={() => setSelectedOrder(null)}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;