import React, { useMemo, useState } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const TOTAL_TABLES = 30;

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return '--';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
};

const ManagerDashboardOverview = ({
  orders = [],
  menu = [],
  staff = [],
  currentUser,
  onNavigate,
  onOpenNewOrder,
  onSelectTable,
  onReviewBill,
}) => {
  const [dateRange, setDateRange] = useState('today'); // 'today' | 'week' | 'month' | 'custom'
  const [salesRange, setSalesRange] = useState('7days'); // 'today' | '7days' | '30days' | 'custom'

  const managerName = currentUser?.name || 'Manager';

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }, []);

  // Filter orders by dateRange
  const dateFilteredOrders = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return orders.filter((o) => {
      const orderTime = new Date(o.created_at).getTime();
      if (dateRange === 'today') return orderTime >= todayStart;
      if (dateRange === 'week') return orderTime >= weekStart;
      if (dateRange === 'month') return orderTime >= monthStart;
      return true;
    });
  }, [orders, dateRange]);

  // Operations breakdown
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'preparing'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);
  const completedOrders = useMemo(() => orders.filter((o) => ['served', 'waiting_bill', 'completed'].includes(o.status)), [orders]);
  const activeOrders = useMemo(() => orders.filter((o) => !['completed', 'cancelled'].includes(o.status) && !(o.status === 'waiting_bill' && o.table_cleared)), [orders]);

  // KPIs
  const totalRevenue = useMemo(() => {
    return dateFilteredOrders
      .filter((o) => o.status !== 'cancelled')
      .reduce((sum, o) => sum + getOrderTotal(o), 0);
  }, [dateFilteredOrders]);

  const totalOrdersCount = dateFilteredOrders.length;
  const activeOrdersCount = activeOrders.length;
  const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Customers Count (Unique phone or name)
  const customersToday = useMemo(() => {
    const set = new Set();
    dateFilteredOrders.forEach((o) => {
      if (o.customer_phone) set.add(o.customer_phone);
      else if (o.customer_name) set.add(o.customer_name);
      else set.add(`order_${o.id}`);
    });
    return set.size;
  }, [dateFilteredOrders]);

  // Tables breakdown
  const occupiedTableNumbers = useMemo(() => {
    return [...new Set(
      activeOrders
        .filter((o) => o.table_label !== 'Packing')
        .map((o) => Number(o.table_number))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= TOTAL_TABLES)
    )];
  }, [activeOrders]);

  const billingTableNumbers = useMemo(() => {
    return [...new Set(
      activeOrders
        .filter((o) => o.status === 'waiting_bill')
        .map((o) => Number(o.table_number))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= TOTAL_TABLES)
    )];
  }, [activeOrders]);

  const readyTableNumbers = useMemo(() => {
    return [...new Set(
      activeOrders
        .filter((o) => o.status === 'ready')
        .map((o) => Number(o.table_number))
        .filter((n) => Number.isInteger(n) && n > 0 && n <= TOTAL_TABLES)
    )];
  }, [activeOrders]);

  const availableTablesCount = TOTAL_TABLES - occupiedTableNumbers.length;

  // Sales Chart Data (Real data aggregation)
  const salesChartData = useMemo(() => {
    const now = new Date();
    const daysCount = salesRange === 'today' ? 1 : salesRange === '7days' ? 7 : 30;
    const days = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const startStamp = d.getTime();
      const endStamp = startStamp + 24 * 60 * 60 * 1000;

      const dayOrders = orders.filter((o) => {
        const time = new Date(o.created_at).getTime();
        return time >= startStamp && time < endStamp && o.status !== 'cancelled';
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + getOrderTotal(o), 0);

      days.push({
        label: daysCount === 1
          ? 'Today'
          : d.toLocaleDateString(undefined, { weekday: daysCount <= 7 ? 'short' : undefined, month: 'numeric', day: 'numeric' }),
        ordersCount: dayOrders.length,
        revenue: dayRevenue,
      });
    }

    const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
    const rangeRevenue = days.reduce((sum, d) => sum + d.revenue, 0);
    const rangeOrders = days.reduce((sum, d) => sum + d.ordersCount, 0);
    const rangeAov = rangeOrders > 0 ? Math.round(rangeRevenue / rangeOrders) : 0;

    return { days, maxRevenue, rangeRevenue, rangeOrders, rangeAov };
  }, [orders, salesRange]);

  // Live Orders List (sorted by newest, top 6)
  const recentLiveOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 6);
  }, [orders]);

  // Staff Performance (calculated from real orders and registered staff)
  const staffPerformance = useMemo(() => {
    const map = new Map();

    (staff || []).forEach((u) => {
      if (u.role === 'waiter' || u.role === 'chef') {
        map.set(u.name || u.email, {
          name: u.name || u.email,
          ordersCount: 0,
          sales: 0,
          tablesSet: new Set(),
        });
      }
    });

    orders.forEach((o) => {
      const waiterName = o.waiter?.name || 'Unassigned Staff';
      const current = map.get(waiterName) || {
        name: waiterName,
        ordersCount: 0,
        sales: 0,
        tablesSet: new Set(),
      };

      current.ordersCount += 1;
      current.sales += getOrderTotal(o);
      if (o.table_number) current.tablesSet.add(o.table_number);
      map.set(waiterName, current);
    });

    return [...map.values()]
      .map((s) => ({
        name: s.name,
        ordersCount: s.ordersCount,
        sales: s.sales,
        tablesServed: s.tablesSet.size,
        avgOrder: s.ordersCount > 0 ? Math.round(s.sales / s.ordersCount) : 0,
        status: 'Active',
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [orders, staff]);

  // Menu Performance (Top Selling & Low Performing from real orders)
  const menuPerformance = useMemo(() => {
    const itemMap = new Map();

    // Seed from catalog so low performing includes zero sales
    menu.forEach((m) => {
      itemMap.set(m.name, {
        name: m.name,
        ordersCount: 0,
        revenue: 0,
        price: m.price,
      });
    });

    orders.forEach((o) => {
      if (o.status === 'cancelled') return;
      (o.items || []).forEach((item) => {
        const name = item.menu_item?.name || item.name;
        if (!name) return;
        const current = itemMap.get(name) || { name, ordersCount: 0, revenue: 0, price: item.price || 0 };
        current.ordersCount += item.quantity;
        current.revenue += parseFloat(item.menu_item?.price || item.price || 0) * item.quantity;
        itemMap.set(name, current);
      });
    });

    const all = [...itemMap.values()];
    const topSelling = [...all].sort((a, b) => b.ordersCount - a.ordersCount).slice(0, 5);
    const lowPerforming = [...all].sort((a, b) => a.ordersCount - b.ordersCount).slice(0, 5);

    return { topSelling, lowPerforming };
  }, [orders, menu]);

  // Inventory Alerts
  const inventoryAlerts = useMemo(() => {
    const lowStock = menu.filter((i) => i.available !== false && (i.stock_quantity || 0) > 0 && (i.stock_quantity || 0) <= 5);
    const outOfStock = menu.filter((i) => i.available === false || (i.stock_quantity || 0) <= 0);
    const available = menu.filter((i) => i.available !== false && (i.stock_quantity || 0) > 5);

    return { lowStock, outOfStock, available };
  }, [menu]);

  // Payments Summary
  const paymentsSummary = useMemo(() => {
    let cash = 0;
    let upi = 0;
    let card = 0;
    let other = 0;

    dateFilteredOrders.forEach((o) => {
      if (o.status === 'cancelled') return;
      const total = getOrderTotal(o);
      const method = String(o.payment_method || '').toLowerCase();

      if (method.includes('cash')) cash += total;
      else if (method.includes('upi')) upi += total;
      else if (method.includes('card')) card += total;
      else if (o.payment_received || o.payment_status === 'paid') other += total;
    });

    const totalCollected = cash + upi + card + other;
    return { cash, upi, card, other, totalCollected };
  }, [dateFilteredOrders]);

  // Billing Requests / Counter Queue (Orders in 'waiting_bill' status awaiting manager final billing)
  const counterBillingQueue = useMemo(() => {
    return orders
      .filter((o) => o.status === 'waiting_bill' && !o.table_cleared && !o.payment_received && o.payment_status !== 'paid')
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* 1. Dashboard Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {greeting}, {managerName}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Here's what's happening across your restaurant today.
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          {[
            { id: 'today', label: 'Today' },
            { id: 'week', label: 'This Week' },
            { id: 'month', label: 'This Month' },
            { id: 'custom', label: 'All Time' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id)}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                dateRange === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Compact Business KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* TOTAL REVENUE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Revenue</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
              ₹
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            ₹{totalRevenue.toFixed(0)}
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            {dateFilteredOrders.length > 0 ? `${dateFilteredOrders.length} orders total` : '--'}
          </div>
        </div>

        {/* TOTAL ORDERS */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Orders</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">{totalOrdersCount}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">
            {totalOrdersCount > 0 ? 'Recorded' : '--'}
          </div>
        </div>

        {/* ACTIVE ORDERS */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Orders</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-600 tracking-tight">{activeOrdersCount}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">Currently processing</div>
        </div>

        {/* AVAILABLE TABLES */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Available Tables</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
            {availableTablesCount} <span className="text-sm font-bold text-slate-400">/ {TOTAL_TABLES}</span>
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold">Current availability</div>
        </div>

        {/* AVERAGE ORDER VALUE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Avg Order Value</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">₹{averageOrderValue}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">Per ticket average</div>
        </div>

        {/* CUSTOMERS TODAY */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Customers</span>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-700 tracking-tight">{customersToday}</div>
          <div className="mt-1 text-[11px] text-slate-400 font-medium">Recorded guests</div>
        </div>
      </div>

      {/* 3. Quick Actions Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-2xs flex items-center justify-between gap-2 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider px-2 whitespace-nowrap">
          Quick Actions:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenNewOrder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-98 transition-all shadow-xs whitespace-nowrap"
          >
            <span className="text-sm">+</span> New Order
          </button>
          <button
            onClick={() => onNavigate?.('tables')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Manage Tables
          </button>
          <button
            onClick={() => onNavigate?.('menu')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Manage Menu
          </button>
          <button
            onClick={() => onNavigate?.('inventory')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Inventory
          </button>
          <button
            onClick={() => onNavigate?.('staff')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Staff
          </button>
          <button
            onClick={() => onNavigate?.('reports')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            View Reports
          </button>
          <button
            onClick={() => onNavigate?.('payments')}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-colors whitespace-nowrap"
          >
            Payments
          </button>
        </div>
      </div>

      {/* 3.5. Dedicated Live Billing Requests / Counter Queue */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-3 h-3 rounded-full ${counterBillingQueue.length > 0 ? 'bg-purple-600 animate-ping' : 'bg-slate-300'}`} />
            <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
              Billing Requests / Counter Queue
            </h3>
            {counterBillingQueue.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-800 border border-purple-200">
                {counterBillingQueue.length} Waiting
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400">
            Realtime Desk Queue
          </span>
        </div>

        {counterBillingQueue.length === 0 ? (
          <div className="py-6 text-center text-slate-400 bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
            <p className="text-xs font-semibold text-slate-500">No tables currently waiting for billing.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                  <th className="py-2.5 px-4">Table</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4 text-center">Items</th>
                  <th className="py-2.5 px-4">Total</th>
                  <th className="py-2.5 px-4">Waiter</th>
                  <th className="py-2.5 px-4">Time</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {counterBillingQueue.map((order) => {
                  const tableText = order.table_number ? `T${String(order.table_number).padStart(2, '0')}` : formatOrderLocation(order);
                  const itemCount = (order.items || []).reduce((sum, i) => sum + i.quantity, 0);
                  const subtotal = getOrderTotal(order);
                  const grandTotal = subtotal * 1.05; // 5% GST
                  const timeText = formatTimeAgo(order.updated_at || order.created_at);

                  return (
                    <tr key={order.id} className="hover:bg-purple-50/40 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{tableText}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">{order.customer_name || 'Walk-in'}</td>
                      <td className="py-3 px-4 text-center font-black text-slate-700">{itemCount}</td>
                      <td className="py-3 px-4 font-black text-slate-900">₹{grandTotal.toFixed(0)}</td>
                      <td className="py-3 px-4 text-slate-600">{order.waiter?.name || 'Staff'}</td>
                      <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{timeText}</td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onReviewBill?.(order)}
                          className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-black shadow-2xs transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span>REVIEW BILL</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Sales Overview & Analytics Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="font-bold text-base text-slate-900">Sales Overview</h3>
            <p className="text-xs text-slate-400 mt-0.5">Real sales and order volume over time</p>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {[
              { id: 'today', label: 'Today' },
              { id: '7days', label: '7 Days' },
              { id: '30days', label: '30 Days' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setSalesRange(p.id)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  salesRange === p.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {salesChartData.rangeRevenue === 0 && salesChartData.rangeOrders === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
            <svg className="w-10 h-10 mx-auto mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-sm font-bold text-slate-700">No sales yet</p>
            <p className="text-xs text-slate-400 mt-1">Sales will appear here once your first order is completed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl text-center border border-slate-100">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Period Revenue</span>
                <span className="text-lg font-black text-slate-900">₹{salesChartData.rangeRevenue.toFixed(0)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Orders Handled</span>
                <span className="text-lg font-black text-slate-900">{salesChartData.rangeOrders}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Period AOV</span>
                <span className="text-lg font-black text-slate-900">₹{salesChartData.rangeAov}</span>
              </div>
            </div>

            {/* Real Data Bar Chart Visualization */}
            <div className="pt-2">
              <div className="flex items-end gap-2 h-44 border-b border-slate-200 pb-2">
                {salesChartData.days.map((d, i) => {
                  const percent = Math.round((d.revenue / salesChartData.maxRevenue) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-10 bg-slate-900 text-white text-[10px] py-1 px-2 rounded font-bold pointer-events-none whitespace-nowrap z-20 shadow-md">
                        ₹{d.revenue.toFixed(0)} ({d.ordersCount} orders)
                      </div>
                      <div
                        className="w-full bg-blue-600 hover:bg-blue-700 transition-all rounded-t-md min-h-[4px]"
                        style={{ height: `${Math.max(percent, d.revenue > 0 ? 8 : 4)}%` }}
                      />
                      <span className="text-[10px] font-bold text-slate-400 truncate w-full text-center">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Restaurant Operations (4 Status Cards) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">Restaurant Operations</h3>
          <span className="text-xs text-slate-400">Click any status to inspect orders</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button
            onClick={() => onNavigate?.('orders', 'pending')}
            className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-left hover:border-amber-300 hover:shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-amber-800">Pending Orders</span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
            </div>
            <div className="text-3xl font-black text-amber-900 mt-2">{pendingOrders.length}</div>
            <p className="text-[11px] text-amber-700 mt-1">Awaiting kitchen start</p>
          </button>

          <button
            onClick={() => onNavigate?.('orders', 'preparing')}
            className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 text-left hover:border-blue-300 hover:shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-blue-800">Preparing</span>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            </div>
            <div className="text-3xl font-black text-blue-900 mt-2">{preparingOrders.length}</div>
            <p className="text-[11px] text-blue-700 mt-1">Active on cooking line</p>
          </button>

          <button
            onClick={() => onNavigate?.('orders', 'ready')}
            className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-left hover:border-emerald-300 hover:shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-800">Ready</span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            </div>
            <div className="text-3xl font-black text-emerald-900 mt-2">{readyOrders.length}</div>
            <p className="text-[11px] text-emerald-700 mt-1">Plated on pass for pickup</p>
          </button>

          <button
            onClick={() => onNavigate?.('orders', 'completed')}
            className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left hover:border-slate-300 hover:shadow-2xs transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700">Completed</span>
              <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">{completedOrders.length}</div>
            <p className="text-[11px] text-slate-500 mt-1">Delivered and settled</p>
          </button>
        </div>
      </div>

      {/* 6. Table Overview Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-bold text-base text-slate-900">Floor Table Management</h3>
            <p className="text-xs text-slate-400 mt-0.5">Live restaurant table availability &amp; occupancy</p>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-slate-700">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Free: {availableTablesCount}
            </span>
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2 h-2 rounded-full bg-blue-600"></span> Occupied: {occupiedTableNumbers.length}
            </span>
            <span className="flex items-center gap-1.5 text-purple-700">
              <span className="w-2 h-2 rounded-full bg-purple-600"></span> Billing: {billingTableNumbers.length}
            </span>
          </div>
        </div>

        {/* 30-Table Compact Grid */}
        <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-10 gap-2">
          {Array.from({ length: TOTAL_TABLES }, (_, index) => {
            const tableNum = index + 1;
            const isOccupied = occupiedTableNumbers.includes(tableNum);
            const isBilling = billingTableNumbers.includes(tableNum);
            const isReady = readyTableNumbers.includes(tableNum);

            let statusLabel = 'FREE';
            let tileTone = 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';

            if (isBilling) {
              statusLabel = 'BILL';
              tileTone = 'bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200';
            } else if (isReady) {
              statusLabel = 'READY';
              tileTone = 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200';
            } else if (isOccupied) {
              statusLabel = 'BUSY';
              tileTone = 'bg-blue-100 text-blue-900 border-blue-300 hover:bg-blue-200';
            }

            return (
              <button
                key={tableNum}
                onClick={() => onSelectTable?.(tableNum)}
                className={`p-2.5 rounded-xl border text-center transition-all hover:scale-102 flex flex-col items-center justify-center ${tileTone}`}
              >
                <div className="font-black text-xs">T{String(tableNum).padStart(2, '0')}</div>
                <div className="text-[9px] font-extrabold uppercase mt-0.5">{statusLabel}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 7. Live Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Live Orders Pipeline</h3>
            <p className="text-xs text-slate-400">Realtime ticket feed across dining floor</p>
          </div>
          <button
            onClick={() => onNavigate?.('orders')}
            className="text-xs font-bold text-blue-600 hover:text-blue-700"
          >
            View All Orders &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Order</th>
                <th className="py-3 px-4">Table</th>
                <th className="py-3 px-4">Waiter</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {recentLiveOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No active orders currently. All operations clear.
                  </td>
                </tr>
              ) : (
                recentLiveOrders.map((order) => {
                  const serialText = `#${formatOrderSerial(order)}`;
                  const tableText = formatOrderLocation(order);
                  const total = getOrderTotal(order);

                  let statusBadge = 'bg-slate-100 text-slate-800 border-slate-200';
                  if (order.status === 'pending') statusBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                  else if (order.status === 'preparing') statusBadge = 'bg-blue-100 text-blue-800 border-blue-200';
                  else if (order.status === 'ready') statusBadge = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                  else if (order.status === 'waiting_bill') statusBadge = 'bg-purple-100 text-purple-800 border-purple-200';

                  return (
                    <tr key={order.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-black text-slate-900">{serialText}</td>
                      <td className="py-3 px-4 font-bold">{tableText}</td>
                      <td className="py-3 px-4 text-slate-600">{order.waiter?.name || 'Unassigned'}</td>
                      <td className="py-3 px-4 text-slate-600">{order.customer_name || 'Walk-in'}</td>
                      <td className="py-3 px-4 font-black text-slate-900">₹{total.toFixed(0)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400 font-medium">
                        {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 8. Staff Performance & Menu Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Staff Performance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Staff Performance</h3>
                <p className="text-xs text-slate-400">Waiter sales, orders, and table coverage</p>
              </div>
              <button
                onClick={() => onNavigate?.('staff')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                View Staff &rarr;
              </button>
            </div>

            {staffPerformance.length === 0 ? (
              <div className="py-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <p className="text-xs font-bold text-slate-600">No staff data</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Staff statistics will track once orders are handled by staff.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="pb-2">Waiter</th>
                      <th className="pb-2">Orders</th>
                      <th className="pb-2">Sales</th>
                      <th className="pb-2">Tables</th>
                      <th className="pb-2 text-right">Avg Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {staffPerformance.slice(0, 4).map((s, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="py-2.5 font-bold text-slate-900">{s.name}</td>
                        <td className="py-2.5">{s.ordersCount}</td>
                        <td className="py-2.5 font-bold text-emerald-700">₹{s.sales.toFixed(0)}</td>
                        <td className="py-2.5">{s.tablesServed}</td>
                        <td className="py-2.5 text-right font-semibold">₹{s.avgOrder}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Menu Performance */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Menu Performance</h3>
                <p className="text-xs text-slate-400">Top selling and low performing dishes</p>
              </div>
              <button
                onClick={() => onNavigate?.('menu')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Menu Master &rarr;
              </button>
            </div>

            <div className="space-y-4">
              {/* Top Selling */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 block mb-1.5">
                  Top Selling Dishes
                </span>
                <div className="space-y-1 text-xs">
                  {menuPerformance.topSelling.filter((i) => i.ordersCount > 0).length === 0 ? (
                    <div className="text-slate-400 text-xs py-2">No items ordered yet.</div>
                  ) : (
                    menuPerformance.topSelling
                      .filter((i) => i.ordersCount > 0)
                      .slice(0, 3)
                      .map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50">
                          <span className="font-bold text-slate-800">{item.name}</span>
                          <span className="text-slate-500 font-semibold">
                            {item.ordersCount} orders • ₹{item.revenue.toFixed(0)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Low Performing */}
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5">
                  Low Demand / Need Promotion
                </span>
                <div className="space-y-1 text-xs">
                  {menuPerformance.lowPerforming.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-50 text-slate-600">
                      <span>{item.name}</span>
                      <span className="text-[11px] text-slate-400 font-medium">{item.ordersCount} ordered</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 9. Inventory Alerts & Payments Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Inventory Alerts */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Inventory &amp; Stock Alerts</h3>
              <p className="text-xs text-slate-400">Critical ingredients and catalog stock</p>
            </div>
            <button
              onClick={() => onNavigate?.('inventory')}
              className="text-xs font-bold text-blue-600 hover:text-blue-700"
            >
              View Inventory &rarr;
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
              <span className="text-lg font-black text-rose-700">{inventoryAlerts.outOfStock.length}</span>
              <span className="text-[10px] uppercase font-bold text-rose-800 block">Out of Stock</span>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
              <span className="text-lg font-black text-amber-700">{inventoryAlerts.lowStock.length}</span>
              <span className="text-[10px] uppercase font-bold text-amber-800 block">Low Stock</span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
              <span className="text-lg font-black text-emerald-700">{inventoryAlerts.available.length}</span>
              <span className="text-[10px] uppercase font-bold text-emerald-800 block">In Stock</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            {inventoryAlerts.outOfStock.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-rose-50/70 border border-rose-200">
                <span className="font-bold text-rose-900">{item.name}</span>
                <span className="text-[10px] font-black uppercase text-rose-700 bg-white px-2 py-0.5 rounded border border-rose-200">
                  OUT OF STOCK
                </span>
              </div>
            ))}
            {inventoryAlerts.lowStock.slice(0, 2).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200">
                <span className="font-bold text-amber-900">{item.name}</span>
                <span className="text-[10px] font-black uppercase text-amber-700 bg-white px-2 py-0.5 rounded border border-amber-200">
                  LOW: {item.stock_quantity} units
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Payments Summary */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-sm text-slate-900">Payments Summary</h3>
                <p className="text-xs text-slate-400">Total collected across payment channels</p>
              </div>
              <button
                onClick={() => onNavigate?.('payments')}
                className="text-xs font-bold text-blue-600 hover:text-blue-700"
              >
                Payments &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center mb-3">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cash</span>
                <span className="text-sm font-black text-slate-900">₹{paymentsSummary.cash.toFixed(0)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">UPI QR</span>
                <span className="text-sm font-black text-slate-900">₹{paymentsSummary.upi.toFixed(0)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Card</span>
                <span className="text-sm font-black text-slate-900">₹{paymentsSummary.card.toFixed(0)}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Other</span>
                <span className="text-sm font-black text-slate-900">₹{paymentsSummary.other.toFixed(0)}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
            <span className="font-bold text-xs text-emerald-900 uppercase tracking-wider">Total Collected Today</span>
            <span className="text-xl font-black text-emerald-700">₹{paymentsSummary.totalCollected.toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerDashboardOverview;
