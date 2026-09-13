import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';
import { socket } from '../lib/socket';

const TablesPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showActions, setShowActions] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Generate 30 tables with status based on orders
  const tableData = useMemo(() => {
    return Array.from({ length: 30 }, (_, index) => {
      const tableNumber = index + 1;
      const tableOrders = orders.filter(order => Number(order.table_number) === tableNumber);
      
      let status = 'FREE';
      let guestCount = 0;
      let currentAmount = 0;
      let orderStatus = null;

      if (tableOrders.length > 0) {
        const activeOrder = tableOrders.find(order => 
          !['completed', 'cancelled'].includes(order.status)
        );
        
        if (activeOrder) {
          if (activeOrder.status === 'waiting_bill') {
            status = 'BILLING';
          } else if (activeOrder.status === 'pending') {
            status = 'PENDING';
          } else if (activeOrder.status === 'preparing') {
            status = 'PREPARING';
          } else if (activeOrder.status === 'ready') {
            status = 'READY';
          } else {
            status = 'OCCUPIED';
          }
          
          guestCount = activeOrder.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0;
          currentAmount = activeOrder.items?.reduce((sum, item) => 
            sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
          ) || 0;
          orderStatus = activeOrder.status;
        }
      }

      return {
        id: tableNumber,
        number: tableNumber,
        status,
        guestCount,
        currentAmount,
        orderStatus,
        orders: tableOrders
      };
    });
  }, [orders]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'FREE': return 'bg-green-50 border-green-200 text-green-700';
      case 'OCCUPIED': return 'bg-blue-50 border-blue-200 text-blue-700';
      case 'PENDING': return 'bg-amber-50 border-amber-200 text-amber-700';
      case 'PREPARING': return 'bg-purple-50 border-purple-200 text-purple-700';
      case 'READY': return 'bg-emerald-50 border-emerald-200 text-emerald-700';
      case 'BILLING': return 'bg-red-50 border-red-200 text-red-700';
      default: return 'bg-slate-50 border-slate-200 text-slate-700';
    }
  };

  const handleTableAction = async (action, table) => {
    try {
      switch (action) {
        case 'open':
          // Navigate to create new order for this table
          window.location.assign(`/waiter?table=${table.number}`);
          break;
        case 'view':
          setSelectedTable(table);
          break;
        case 'mark_empty':
          if (table.orders.length > 0) {
            const activeOrder = table.orders.find(o => !['completed', 'cancelled'].includes(o.status));
            if (activeOrder) {
              await axios.put(`${API_BASE_URL}/api/orders/${activeOrder.id}/status`, { 
                status: 'completed',
                table_cleared: true 
              });
              await fetchOrders();
            }
          }
          break;
        case 'transfer':
          // TODO: Implement transfer functionality
          alert('Transfer functionality - select target table');
          break;
        case 'merge':
          // TODO: Implement merge functionality
          alert('Merge functionality - select tables to merge');
          break;
        default:
          break;
      }
      setShowActions(null);
    } catch (error) {
      console.error('Action failed:', error);
      alert('Action failed. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading tables...</div>
      </div>
    );
  }

  const statusCounts = {
    FREE: tableData.filter(t => t.status === 'FREE').length,
    OCCUPIED: tableData.filter(t => t.status === 'OCCUPIED').length,
    PENDING: tableData.filter(t => t.status === 'PENDING').length,
    PREPARING: tableData.filter(t => t.status === 'PREPARING').length,
    READY: tableData.filter(t => t.status === 'READY').length,
    BILLING: tableData.filter(t => t.status === 'BILLING').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Table Management</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage restaurant floor and table status
          </p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary">
            + Add Table
          </button>
        </div>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {Object.entries(statusCounts).map(([status, count]) => (
          <div key={status} className={`kpi-card ${getStatusColor(status)}`}>
            <div className="kpi-label">{status}</div>
            <div className="kpi-value">{count}</div>
          </div>
        ))}
      </div>

      {/* Table Grid */}
      <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">Floor Layout</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {tableData.map((table) => (
            <div key={table.id} className="relative">
              <button
                onClick={() => setSelectedTable(table)}
                className={`w-full p-4 rounded-lg border-2 transition-all hover:shadow-md ${
                  selectedTable?.id === table.id 
                    ? 'border-[var(--color-accent)] ring-2 ring-[var(--color-accent)] ring-opacity-20' 
                    : getStatusColor(table.status)
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-lg">TABLE {String(table.number).padStart(2, '0')}</div>
                  {table.status !== 'FREE' && (
                    <div className="w-2 h-2 rounded-full bg-current opacity-60" />
                  )}
                </div>
                
                <div className="text-xs font-semibold uppercase tracking-wider mb-2">
                  {table.status}
                </div>

                {table.status !== 'FREE' && (
                  <>
                    <div className="text-sm opacity-80">
                      {table.guestCount} {table.guestCount === 1 ? 'Guest' : 'Guests'}
                    </div>
                    {table.currentAmount > 0 && (
                      <div className="text-sm font-semibold opacity-90">
                        ₹{table.currentAmount.toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </button>

              {/* Quick Actions */}
              <div className="absolute top-2 right-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowActions(showActions === table.id ? null : table.id);
                  }}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {showActions === table.id && (
                  <div className="absolute right-0 top-8 bg-white border border-[var(--color-border)] rounded-lg shadow-lg py-1 z-10 min-w-[150px]">
                    {table.status === 'FREE' && (
                      <button
                        onClick={() => handleTableAction('open', table)}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                      >
                        Open Table
                      </button>
                    )}
                    {table.status !== 'FREE' && (
                      <>
                        <button
                          onClick={() => handleTableAction('view', table)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                        >
                          View Order
                        </button>
                        <button
                          onClick={() => handleTableAction('transfer', table)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                        >
                          Transfer Table
                        </button>
                        <button
                          onClick={() => handleTableAction('merge', table)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors"
                        >
                          Merge Table
                        </button>
                        <button
                          onClick={() => handleTableAction('mark_empty', table)}
                          className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50 transition-colors text-red-600"
                        >
                          Mark Empty
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Table Details Modal */}
      {selectedTable && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">TABLE {String(selectedTable.number).padStart(2, '0')}</h3>
                <button
                  onClick={() => setSelectedTable(null)}
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
                  <div className="text-sm text-[var(--color-text-secondary)]">Status</div>
                  <div className="font-semibold">{selectedTable.status}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Guests</div>
                  <div className="font-semibold">{selectedTable.guestCount}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Current Bill</div>
                  <div className="font-semibold">₹{selectedTable.currentAmount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Orders</div>
                  <div className="font-semibold">{selectedTable.orders.length}</div>
                </div>
              </div>

              {selectedTable.orders.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Order History</h4>
                  <div className="space-y-3">
                    {selectedTable.orders.map((order) => (
                      <div key={order.id} className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-medium">Order #{order.id}</div>
                          <span className="status-badge status-badge-info">{order.status}</span>
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          {order.customer_name || 'Walk-in'} • {order.items?.length || 0} items
                        </div>
                        <div className="text-sm font-semibold mt-1">
                          ₹{order.items?.reduce((sum, item) => 
                            sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
                          )?.toLocaleString() || '0'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedTable.orders.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-secondary)]">
                  No orders for this table
                </div>
              )}
            </div>

            <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
              {selectedTable.status === 'FREE' ? (
                <button
                  onClick={() => handleTableAction('open', selectedTable)}
                  className="btn btn-primary flex-1"
                >
                  Open Table
                </button>
              ) : (
                <>
                  <button
                    onClick={() => window.location.href = `/waiter?table=${selectedTable.number}`}
                    className="btn btn-primary flex-1"
                  >
                    New Order
                  </button>
                  <button
                    onClick={() => handleTableAction('mark_empty', selectedTable)}
                    className="btn btn-danger"
                  >
                    Mark Empty
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablesPage;