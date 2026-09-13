import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../lib/appConfig';
import { socket } from '../lib/socket';

const PaymentsPage = () => {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('unpaid');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(true);

  const tabs = [
    { id: 'unpaid', label: 'Unpaid' },
    { id: 'partial', label: 'Partially Paid' },
    { id: 'paid', label: 'Paid' },
    { id: 'all', label: 'All' },
  ];

  const paymentMethods = [
    { id: 'cash', label: 'Cash', icon: '💵' },
    { id: 'upi', label: 'UPI', icon: '📱' },
    { id: 'card', label: 'Card', icon: '💳' },
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

  const getOrderTotal = (order) => {
    return order.items?.reduce((sum, item) => 
      sum + ((item.menu_item?.price || item.price || 0) * item.quantity), 0
    ) || 0;
  };

  const getPaymentStatus = (order) => {
    const total = getOrderTotal(order);
    const paid = order.paid_amount || 0;
    
    if (paid >= total) return 'paid';
    if (paid > 0) return 'partial';
    return 'unpaid';
  };

  const filteredOrders = useMemo(() => {
    let filtered = orders.filter(order => Number(order.table_number) > 0); // Only dine-in orders

    if (activeTab !== 'all') {
      filtered = filtered.filter(order => getPaymentStatus(order) === activeTab);
    }

    // Sort by created date (newest first)
    return filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [orders, activeTab]);

  const getStatusBadge = (status) => {
    switch (status) {
      case 'paid': return 'status-badge status-badge-success';
      case 'partial': return 'status-badge status-badge-warning';
      case 'unpaid': return 'status-badge status-badge-error';
      default: return 'status-badge status-badge-info';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const handlePayment = async () => {
    if (!selectedPayment || !paymentAmount) {
      alert('Please select an order and enter payment amount');
      return;
    }

    const amount = parseFloat(paymentAmount);
    const total = getOrderTotal(selectedPayment);
    const currentPaid = selectedPayment.paid_amount || 0;
    const newTotal = currentPaid + amount;

    if (newTotal > total) {
      alert('Payment amount exceeds total bill');
      return;
    }

    try {
      await axios.put(`${API_BASE_URL}/api/orders/${selectedPayment.id}/payment`, {
        payment_method: paymentMethod,
        amount: amount,
        paid_amount: newTotal,
        payment_status: newTotal >= total ? 'paid' : 'partial'
      });
      
      await fetchOrders();
      setSelectedPayment(null);
      setPaymentAmount('');
      setPaymentMethod('cash');
      alert('Payment processed successfully');
    } catch (error) {
      console.error('Payment failed:', error);
      alert('Payment failed. Please try again.');
    }
  };

  const handleGenerateBill = async (order) => {
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${order.id}/status`, { 
        status: 'waiting_bill' 
      });
      await fetchOrders();
      alert('Bill generated and sent to billing counter');
    } catch (error) {
      console.error('Failed to generate bill:', error);
      alert('Failed to generate bill');
    }
  };

  const handleCompletePayment = async (order) => {
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${order.id}/status`, { 
        status: 'completed',
        paid_amount: getOrderTotal(order),
        payment_status: 'paid'
      });
      await fetchOrders();
      alert('Payment completed and order finalized');
    } catch (error) {
      console.error('Failed to complete payment:', error);
      alert('Failed to complete payment');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-500">Loading payments...</div>
      </div>
    );
  }

  const tabCounts = tabs.reduce((acc, tab) => {
    if (tab.id === 'all') {
      acc[tab.id] = orders.filter(order => Number(order.table_number) > 0).length;
    } else {
      acc[tab.id] = orders.filter(order => 
        Number(order.table_number) > 0 && getPaymentStatus(order) === tab.id
      ).length;
    }
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Payments</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage bills and payment processing
          </p>
        </div>
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

      {/* Payment Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="kpi-card">
          <div className="kpi-label">Unpaid Bills</div>
          <div className="kpi-value text-red-600">{tabCounts.unpaid || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Partial Payments</div>
          <div className="kpi-value text-amber-600">{tabCounts.partial || 0}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Paid Today</div>
          <div className="kpi-value text-green-600">
            ₹{orders
              .filter(o => getPaymentStatus(o) === 'paid')
              .reduce((sum, o) => sum + getOrderTotal(o), 0)
              .toLocaleString()}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Pending Collection</div>
          <div className="kpi-value">
            ₹{orders
              .filter(o => getPaymentStatus(o) === 'unpaid')
              .reduce((sum, o) => sum + getOrderTotal(o), 0)
              .toLocaleString()}
          </div>
        </div>
      </div>

      {/* Payments List */}
      <div className="bg-white rounded-lg border border-[var(--color-border)] shadow-sm">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-[var(--color-text-secondary)]">
            <svg className="w-12 h-12 mx-auto mb-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p>No payments found</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {filteredOrders.map((order) => {
              const total = getOrderTotal(order);
              const paid = order.paid_amount || 0;
              const remaining = total - paid;
              const status = getPaymentStatus(order);

              return (
                <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-semibold text-[var(--color-text)]">Order #{order.id}</span>
                        <span className="text-sm text-[var(--color-text-secondary)]">
                          Table {order.table_number}
                        </span>
                        <span className={getStatusBadge(status)}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </div>
                      
                      <div className="text-sm text-[var(--color-text-secondary)] mb-2">
                        {order.customer_name || 'Walk-in Customer'}
                        {order.customer_phone && ` • ${order.customer_phone}`}
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div>
                          <span className="text-[var(--color-text-secondary)]">Total:</span>
                          <span className="font-semibold ml-1">₹{total.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-[var(--color-text-secondary)]">Paid:</span>
                          <span className="font-semibold ml-1 text-green-600">₹{paid.toLocaleString()}</span>
                        </div>
                        {remaining > 0 && (
                          <div>
                            <span className="text-[var(--color-text-secondary)]">Remaining:</span>
                            <span className="font-semibold ml-1 text-red-600">₹{remaining.toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-secondary)] mt-2">
                        <span>{formatDate(order.created_at)}</span>
                        <span>{formatTime(order.created_at)}</span>
                        {order.payment_method && (
                          <span className="capitalize">Method: {order.payment_method}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {status === 'unpaid' && (
                        <>
                          <button
                            onClick={() => handleGenerateBill(order)}
                            className="btn btn-warning text-xs"
                          >
                            Generate Bill
                          </button>
                          <button
                            onClick={() => {
                              setSelectedPayment(order);
                              setPaymentAmount(remaining.toString());
                            }}
                            className="btn btn-primary text-xs"
                          >
                            Process Payment
                          </button>
                        </>
                      )}
                      {status === 'partial' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedPayment(order);
                              setPaymentAmount(remaining.toString());
                            }}
                            className="btn btn-primary text-xs"
                          >
                            Complete Payment
                          </button>
                        </>
                      )}
                      {status === 'paid' && (
                        <button
                          onClick={() => window.print()}
                          className="btn btn-secondary text-xs"
                        >
                          Print Receipt
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {selectedPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Process Payment</h3>
                <button
                  onClick={() => {
                    setSelectedPayment(null);
                    setPaymentAmount('');
                    setPaymentMethod('cash');
                  }}
                  className="p-2 rounded hover:bg-slate-100 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="bg-slate-50 p-4 rounded-lg mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[var(--color-text-secondary)]">Order #{selectedPayment.id}</span>
                  <span className="font-semibold">Table {selectedPayment.table_number}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[var(--color-text-secondary)]">Total Bill</span>
                  <span className="font-semibold">₹{getOrderTotal(selectedPayment).toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm text-[var(--color-text-secondary)]">Already Paid</span>
                  <span className="font-semibold text-green-600">₹{(selectedPayment.paid_amount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200">
                  <span className="text-sm font-medium">Remaining</span>
                  <span className="font-bold text-red-600">
                    ₹{(getOrderTotal(selectedPayment) - (selectedPayment.paid_amount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map(method => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id)}
                      className={`p-3 rounded-lg border-2 text-center transition-colors ${
                        paymentMethod === method.id
                          ? 'border-[var(--color-accent)] bg-blue-50'
                          : 'border-[var(--color-border)] hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{method.icon}</div>
                      <div className="text-xs font-medium">{method.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Payment Amount</label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="input-field text-lg font-semibold"
                  placeholder="Enter amount"
                />
              </div>
            </div>

            <div className="p-6 border-t border-[var(--color-border)] flex gap-3">
              <button
                onClick={handlePayment}
                className="btn btn-primary flex-1"
              >
                Process Payment
              </button>
              <button
                onClick={() => {
                  setSelectedPayment(null);
                  setPaymentAmount('');
                  setPaymentMethod('cash');
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsPage;