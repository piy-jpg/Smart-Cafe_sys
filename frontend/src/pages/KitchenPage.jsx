import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { socket } from '../lib/socket';

const KitchenPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const columns = [
    { id: 'pending', label: 'Pending', color: 'amber' },
    { id: 'preparing', label: 'Preparing', color: 'blue' },
    { id: 'ready', label: 'Ready', color: 'green' },
    { id: 'served', label: 'Served', color: 'slate' },
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

  const getColumnColor = (color) => {
    switch (color) {
      case 'amber': return 'bg-amber-50 border-amber-200';
      case 'blue': return 'bg-blue-50 border-blue-200';
      case 'green': return 'bg-green-50 border-green-200';
      case 'slate': return 'bg-slate-50 border-slate-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getPriorityBadge = (order) => {
    // Determine priority based on time elapsed
    const createdTime = new Date(order.created_at);
    const elapsedMinutes = Math.floor((Date.now() - createdTime) / (1000 * 60));
    
    if (elapsedMinutes > 30) return 'bg-red-100 text-red-800';
    if (elapsedMinutes > 20) return 'bg-amber-100 text-amber-800';
    if (elapsedMinutes > 15) return 'bg-yellow-100 text-yellow-800';
    return null;
  };

  const formatTimeElapsed = (dateString) => {
    const createdTime = new Date(dateString);
    const elapsedMinutes = Math.floor((Date.now() - createdTime) / (1000 * 60));
    
    if (elapsedMinutes < 1) return 'Just now';
    if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;
    const hours = Math.floor(elapsedMinutes / 60);
    const minutes = elapsedMinutes % 60;
    return `${hours}h ${minutes}m ago`;
  };

  const getOrderTotal = (order) => {
    return order.items?.reduce((sum, item) => 
      sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
    ) || 0;
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

  const ordersByColumn = useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = orders
        .filter(order => order.status === column.id)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      return acc;
    }, {});
  }, [orders]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading kitchen orders...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Kitchen Display</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Monitor order preparation and ready status
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-100 text-green-800 rounded-full text-sm">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </div>
        </div>
      </div>

      {/* Kitchen Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(column => (
          <div key={column.id} className="flex flex-col h-full">
            {/* Column Header */}
            <div className={`p-3 rounded-t-lg border-t-2 border-x-2 ${getColumnColor(column.color)} border-b-0`}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-[var(--color-text)]">{column.label}</h3>
                <span className="text-sm bg-white px-2 py-0.5 rounded-full">
                  {ordersByColumn[column.id]?.length || 0}
                </span>
              </div>
            </div>

            {/* Column Content */}
            <div className={`flex-1 border-2 border-t-0 ${getColumnColor(column.color)} rounded-b-lg p-3 space-y-3 overflow-auto max-h-[calc(100vh-300px)]`}>
              {ordersByColumn[column.id]?.length === 0 ? (
                <div className="text-center py-8 text-[var(--color-text-secondary)] text-sm">
                  No orders
                </div>
              ) : (
                ordersByColumn[column.id].map(order => (
                  <div
                    key={order.id}
                    className="bg-white rounded-lg p-4 shadow-sm border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    {/* Order Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="font-bold text-lg">#{order.id}</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          Table {order.table_number}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-[var(--color-text-secondary)]">
                          {formatTimeElapsed(order.created_at)}
                        </div>
                        {getPriorityBadge(order) && (
                          <span className={`text-xs px-2 py-0.5 rounded-full mt-1 ${getPriorityBadge(order)}`}>
                            Priority
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Customer Info */}
                    {order.customer_name && (
                      <div className="text-sm text-[var(--color-text-secondary)] mb-2">
                        {order.customer_name}
                      </div>
                    )}

                    {/* Order Items */}
                    <div className="space-y-2 mb-3">
                      {order.items?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex-1">
                            <span className="font-medium">{item.menu_item?.name || item.name}</span>
                            <span className="text-[var(--color-text-secondary)] ml-2">
                              ×{item.quantity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Special Instructions */}
                    {order.special_instructions && (
                      <div className="bg-amber-50 p-2 rounded text-xs text-amber-800 mb-3">
                        <strong>Note:</strong> {order.special_instructions}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {column.id === 'pending' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(order.id, 'preparing');
                          }}
                          className="btn btn-primary text-xs flex-1"
                        >
                          Start Preparing
                        </button>
                      )}
                      {column.id === 'preparing' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(order.id, 'ready');
                          }}
                          className="btn btn-success text-xs flex-1"
                        >
                          Mark Ready
                        </button>
                      )}
                      {column.id === 'ready' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStatusChange(order.id, 'served');
                          }}
                          className="btn btn-primary text-xs flex-1"
                        >
                          Mark Served
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
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
                  <div className="font-semibold capitalize">{selectedOrder.status}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Customer</div>
                  <div className="font-semibold">{selectedOrder.customer_name || 'Walk-in'}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Time Elapsed</div>
                  <div className="font-semibold">{formatTimeElapsed(selectedOrder.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Total</div>
                  <div className="font-semibold">₹{getOrderTotal(selectedOrder).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Items</div>
                  <div className="font-semibold">{selectedOrder.items?.length || 0}</div>
                </div>
              </div>

              <h4 className="font-semibold mb-3">Order Items</h4>
              <div className="space-y-2 mb-6">
                {selectedOrder.items?.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1">
                      <div className="font-medium">{item.menu_item?.name || item.name}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Quantity: {item.quantity}
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
              {selectedOrder.status === 'pending' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedOrder.id, 'preparing');
                    setSelectedOrder(null);
                  }}
                  className="btn btn-primary flex-1"
                >
                  Start Preparing
                </button>
              )}
              {selectedOrder.status === 'preparing' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedOrder.id, 'ready');
                    setSelectedOrder(null);
                  }}
                  className="btn btn-success flex-1"
                >
                  Mark Ready
                </button>
              )}
              {selectedOrder.status === 'ready' && (
                <button
                  onClick={() => {
                    handleStatusChange(selectedOrder.id, 'served');
                    setSelectedOrder(null);
                  }}
                  className="btn btn-primary flex-1"
                >
                  Mark Served
                </button>
              )}
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

export default KitchenPage;