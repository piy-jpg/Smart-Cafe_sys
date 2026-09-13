import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { getStoredUser } from '../lib/session';

const ReportsPage = () => {
  const currentUser = getStoredUser();
  const [orders, setOrders] = useState([]);
  const [timeRange, setTimeRange] = useState('today');
  const [loading, setLoading] = useState(true);

  const timeRanges = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
  ];

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

  const getOrderTotal = (order) => {
    return order.items?.reduce((sum, item) => 
      sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
    ) || 0;
  };

  const filterOrdersByTimeRange = (orders) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      
      switch (timeRange) {
        case 'today':
          return orderDate >= today;
        case 'week':
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return orderDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return orderDate >= monthAgo;
        default:
          return true;
      }
    });
  };

  const filteredOrders = useMemo(() => {
    return filterOrdersByTimeRange(orders.filter(order => 
      order.waiter_id === currentUser?.id || !currentUser?.id // Filter by current waiter if available
    ));
  }, [orders, timeRange, currentUser]);

  const reportData = useMemo(() => {
    const completedOrders = filteredOrders.filter(order => order.status === 'completed');
    const totalSales = completedOrders.reduce((sum, order) => sum + getOrderTotal(order), 0);
    const totalOrders = completedOrders.length;
    const tablesServed = new Set(completedOrders.map(order => order.table_number)).size;
    const avgOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    // Payment breakdown
    const paymentBreakdown = completedOrders.reduce((acc, order) => {
      const method = order.payment_method || 'cash';
      acc[method] = (acc[method] || 0) + getOrderTotal(order);
      return acc;
    }, {});

    // Orders by status
    const ordersByStatus = filteredOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {});

    // Hourly breakdown (for today)
    const hourlyData = timeRange === 'today' ? 
      Array.from({ length: 12 }, (_, i) => { // 12 hours from opening
        const hour = (10 + i) % 24; // Assume restaurant opens at 10 AM
        const hourOrders = completedOrders.filter(order => {
          const orderHour = new Date(order.created_at).getHours();
          return orderHour === hour;
        });
        return {
          hour: `${hour}:00`,
          orders: hourOrders.length,
          sales: hourOrders.reduce((sum, order) => sum + getOrderTotal(order), 0)
        };
      }) : [];

    return {
      totalSales,
      totalOrders,
      tablesServed,
      avgOrderValue,
      paymentBreakdown,
      ordersByStatus,
      hourlyData
    };
  }, [filteredOrders, timeRange]);

  const formatCurrency = (amount) => {
    return `₹${Math.round(amount).toLocaleString()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Reports</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Performance analytics and sales data
          </p>
        </div>
        <div className="flex gap-2">
          {timeRanges.map(range => (
            <button
              key={range.id}
              onClick={() => setTimeRange(range.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                timeRange === range.id 
                  ? 'bg-[var(--color-accent)] text-white' 
                  : 'bg-white border border-[var(--color-border)] text-[var(--color-text)] hover:bg-slate-50'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">Total Sales</div>
          <div className="kpi-value text-green-600">{formatCurrency(reportData.totalSales)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Orders</div>
          <div className="kpi-value">{reportData.totalOrders}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Tables Served</div>
          <div className="kpi-value">{reportData.tablesServed}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Avg Order Value</div>
          <div className="kpi-value">{formatCurrency(reportData.avgOrderValue)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by Status */}
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
          <h3 className="font-semibold text-[var(--color-text)] mb-4">Orders by Status</h3>
          <div className="space-y-3">
            {Object.entries(reportData.ordersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full ${
                    status === 'completed' ? 'bg-green-500' :
                    status === 'pending' ? 'bg-amber-500' :
                    status === 'preparing' ? 'bg-blue-500' :
                    status === 'ready' ? 'bg-emerald-500' :
                    'bg-slate-500'
                  }" />
                  <span className="capitalize text-sm">{status}</span>
                </div>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
            {Object.keys(reportData.ordersByStatus).length === 0 && (
              <div className="text-center py-4 text-[var(--color-text-secondary)] text-sm">
                No orders in this time range
              </div>
            )}
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
          <h3 className="font-semibold text-[var(--color-text)] mb-4">Payment Collection</h3>
          <div className="space-y-3">
            {Object.entries(reportData.paymentBreakdown).map(([method, amount]) => (
              <div key={method} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="capitalize text-sm">{method}</span>
                </div>
                <span className="font-semibold">{formatCurrency(amount)}</span>
              </div>
            ))}
            {Object.keys(reportData.paymentBreakdown).length === 0 && (
              <div className="text-center py-4 text-[var(--color-text-secondary)] text-sm">
                No payments in this time range
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hourly Performance (Today only) */}
      {timeRange === 'today' && reportData.hourlyData.length > 0 && (
        <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
          <h3 className="font-semibold text-[var(--color-text)] mb-4">Hourly Performance</h3>
          <div className="space-y-3">
            {reportData.hourlyData.map((data) => (
              <div key={data.hour} className="flex items-center gap-4">
                <div className="w-16 text-sm text-[var(--color-text-secondary)]">{data.hour}</div>
                <div className="flex-1 h-8 bg-slate-100 rounded-lg overflow-hidden">
                  <div 
                    className="h-full bg-[var(--color-accent)] transition-all"
                    style={{ 
                      width: `${Math.min((data.sales / (reportData.totalSales || 1)) * 100, 100)}%` 
                    }}
                  />
                </div>
                <div className="w-24 text-right">
                  <div className="text-sm font-semibold">{formatCurrency(data.sales)}</div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{data.orders} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Performance Summary */}
      <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">Performance Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Sales Performance</div>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(reportData.totalSales)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              From {reportData.totalOrders} completed orders
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Efficiency</div>
            <div className="text-2xl font-bold text-blue-600">
              {reportData.totalOrders > 0 ? Math.round(reportData.tablesServed / reportData.totalOrders * 100) : 0}%
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              Table turn rate
            </div>
          </div>
          <div>
            <div className="text-sm text-[var(--color-text-secondary)] mb-1">Average Ticket</div>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(reportData.avgOrderValue)}
            </div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-1">
              Per order average
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
        <h3 className="font-semibold text-[var(--color-text)] mb-4">Recent Orders</h3>
        <div className="space-y-3">
          {filteredOrders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
              <div>
                <div className="font-medium">Order #{order.id}</div>
                <div className="text-sm text-[var(--color-text-secondary)]">
                  Table {order.table_number} • {order.customer_name || 'Walk-in'}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatCurrency(getOrderTotal(order))}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  order.status === 'completed' ? 'bg-green-100 text-green-800' :
                  order.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                  'bg-slate-100 text-slate-800'
                }`}>
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && (
            <div className="text-center py-4 text-[var(--color-text-secondary)] text-sm">
              No orders in this time range
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;