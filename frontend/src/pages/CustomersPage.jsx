import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';

const CustomersPage = () => {
  const [orders, setOrders] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/orders`);
      setOrders(response.data.orders || []);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Extract customers from orders
  const customers = useMemo(() => {
    const customerMap = new Map();

    orders.forEach(order => {
      const customerId = order.customer_phone || order.customer_name || 'walk-in';
      const existing = customerMap.get(customerId);

      if (existing) {
        existing.totalOrders += 1;
        existing.totalSpending += order.items?.reduce((sum, item) => 
          sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
        ) || 0;
        existing.lastVisit = new Date(order.created_at) > new Date(existing.lastVisit) 
          ? order.created_at 
          : existing.lastVisit;
        existing.orders.push(order);
        
        // Update current table if there's an active order
        if (!['completed', 'cancelled'].includes(order.status)) {
          existing.currentTable = order.table_number;
          existing.currentOrderId = order.id;
        }
      } else {
        customerMap.set(customerId, {
          id: customerId,
          name: order.customer_name || 'Walk-in Customer',
          phone: order.customer_phone || null,
          totalOrders: 1,
          totalSpending: order.items?.reduce((sum, item) => 
            sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
          ) || 0,
          lastVisit: order.created_at,
          firstVisit: order.created_at,
          currentTable: !['completed', 'cancelled'].includes(order.status) ? order.table_number : null,
          currentOrderId: !['completed', 'cancelled'].includes(order.status) ? order.id : null,
          orders: [order]
        });
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => 
      new Date(b.lastVisit) - new Date(a.lastVisit)
    );
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm) return customers;
    
    const search = searchTerm.toLowerCase();
    return customers.filter(customer => 
      customer.name?.toLowerCase().includes(search) ||
      customer.phone?.includes(search)
    );
  }, [customers, searchTerm]);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getOrderTotal = (order) => {
    return order.items?.reduce((sum, item) => 
      sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
    ) || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading customers...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Customers</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Customer information and order history
          </p>
        </div>
        <div className="text-sm text-[var(--color-text-secondary)]">
          Total Customers: {customers.length}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search by name or phone number..."
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

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map(customer => (
          <div
            key={customer.id}
            className="bg-white rounded-lg border border-[var(--color-border)] p-4 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setSelectedCustomer(customer)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-semibold text-[var(--color-text)]">{customer.name}</h3>
                {customer.phone && (
                  <p className="text-sm text-[var(--color-text-secondary)]">{customer.phone}</p>
                )}
              </div>
              {customer.currentTable && (
                <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                  Table {customer.currentTable}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">Total Orders</div>
                <div className="font-semibold">{customer.totalOrders}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">Total Spent</div>
                <div className="font-semibold">₹{customer.totalSpending.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">Last Visit</div>
                <div className="font-semibold text-sm">{formatDate(customer.lastVisit)}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-secondary)]">Avg. Order</div>
                <div className="font-semibold">
                  ₹{Math.round(customer.totalSpending / customer.totalOrders).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="text-xs text-[var(--color-text-secondary)]">
              First visit: {formatDate(customer.firstVisit)}
            </div>
          </div>
        ))}
      </div>

      {filteredCustomers.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>No customers found</p>
        </div>
      )}

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{selectedCustomer.name}</h3>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="p-2 rounded hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Phone</div>
                  <div className="font-semibold">{selectedCustomer.phone || 'N/A'}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Total Orders</div>
                  <div className="font-semibold">{selectedCustomer.totalOrders}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Total Spent</div>
                  <div className="font-semibold">₹{selectedCustomer.totalSpending.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Avg. Order Value</div>
                  <div className="font-semibold">
                    ₹{Math.round(selectedCustomer.totalSpending / selectedCustomer.totalOrders).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">First Visit</div>
                  <div className="font-semibold">{formatDate(selectedCustomer.firstVisit)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Last Visit</div>
                  <div className="font-semibold">{formatDate(selectedCustomer.lastVisit)}</div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Current Table</div>
                  <div className="font-semibold">
                    {selectedCustomer.currentTable ? `Table ${selectedCustomer.currentTable}` : 'None'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-[var(--color-text-secondary)]">Status</div>
                  <div className="font-semibold">
                    {selectedCustomer.currentTable ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-slate-500">Inactive</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Order History */}
              <h4 className="font-semibold mb-3">Order History</h4>
              <div className="space-y-3">
                {selectedCustomer.orders
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((order) => (
                  <div key={order.id} className="p-4 bg-slate-50 rounded-lg">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">Order #{order.id}</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          Table {order.table_number} • {order.items?.length || 0} items
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">₹{getOrderTotal(order).toLocaleString()}</div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' :
                          order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'ready' ? 'bg-emerald-100 text-emerald-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">
                      {formatDate(order.created_at)} at {formatTime(order.created_at)}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {order.items?.slice(0, 3).map((item, index) => (
                        <span key={index} className="text-xs bg-white px-2 py-1 rounded">
                          {item.menu_item?.name || item.name} ×{item.quantity}
                        </span>
                      ))}
                      {order.items?.length > 3 && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          +{order.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
              {selectedCustomer.currentTable && (
                <button
                  onClick={() => {
                    window.location.href = `/waiter?table=${selectedCustomer.currentTable}`;
                  }}
                  className="btn btn-primary flex-1"
                >
                  View Current Order
                </button>
              )}
              <button
                onClick={() => setSelectedCustomer(null)}
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

export default CustomersPage;