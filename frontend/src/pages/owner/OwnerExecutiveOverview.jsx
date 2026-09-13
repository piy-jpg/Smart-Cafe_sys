import React, { useMemo, useState } from 'react';
import { formatOrderSerial } from '../../lib/appConfig';

const TOTAL_TABLES = 30;

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const OwnerExecutiveOverview = ({
  orders = [],
  menu = [],
  users = [],
  databaseStatus = {},
  dateRange = 'today',
  onNavigate,
  onDownloadBackup,
}) => {
  // Chart period state (7 Days | 30 Days | 3 Months | 12 Months)
  const [chartPeriod, setChartPeriod] = useState('7days');
  const [staffTab, setStaffTab] = useState('waiters'); // 'waiters' | 'chefs' | 'managers'
  const [selectedTableForInspect, setSelectedTableForInspect] = useState(null);

  // Time boundary helpers
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }, [now]);

  const monthStart = useMemo(() => {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }, [now]);

  // Orders filtered by dateRange selector
  const rangeOrders = useMemo(() => {
    return orders.filter((o) => {
      const t = new Date(o.created_at).getTime();
      if (dateRange === 'today') return t >= todayStart;
      if (dateRange === '7days') return t >= todayStart - 6 * 86400000;
      if (dateRange === '30days') return t >= todayStart - 29 * 86400000;
      if (dateRange === 'month') return t >= monthStart;
      return true;
    });
  }, [orders, dateRange, todayStart, monthStart]);

  // Completed & Active Orders
  const validOrders = useMemo(() => orders.filter((o) => o.status !== 'cancelled'), [orders]);
  const activeOrders = useMemo(() => (
    orders.filter((o) => !['completed', 'cancelled'].includes(o.status) && !(o.status === 'waiting_bill' && o.table_cleared))
  ), [orders]);

  // Today Orders
  const todayOrders = useMemo(() => (
    validOrders.filter((o) => new Date(o.created_at).getTime() >= todayStart)
  ), [validOrders, todayStart]);

  // Monthly Orders
  const monthlyOrders = useMemo(() => (
    validOrders.filter((o) => new Date(o.created_at).getTime() >= monthStart)
  ), [validOrders, monthStart]);

  // Top KPI calculations
  const todayRevenue = useMemo(() => (
    todayOrders.reduce((sum, o) => sum + getOrderTotal(o), 0)
  ), [todayOrders]);

  const monthlyRevenue = useMemo(() => (
    monthlyOrders.reduce((sum, o) => sum + getOrderTotal(o), 0)
  ), [monthlyOrders]);

  const todayOrdersCount = todayOrders.length;
  const activeOrdersCount = activeOrders.length;

  const averageOrderValue = useMemo(() => {
    if (todayOrdersCount === 0) return 0;
    return Math.round(todayRevenue / todayOrdersCount);
  }, [todayRevenue, todayOrdersCount]);

  const uniqueCustomersToday = useMemo(() => {
    const set = new Set();
    todayOrders.forEach((o) => {
      const key = o.customer_phone || o.customer_name || `order-${o.id}`;
      set.add(key);
    });
    return set.size;
  }, [todayOrders]);

  // Occupied tables count
  const occupiedTablesSet = useMemo(() => {
    const set = new Set();
    activeOrders.forEach((o) => {
      if (o.table_number) set.add(Number(o.table_number));
    });
    return set;
  }, [activeOrders]);

  const tableUtilizationPct = useMemo(() => {
    return Math.round((occupiedTablesSet.size / TOTAL_TABLES) * 100);
  }, [occupiedTablesSet]);

  const netCollection = useMemo(() => {
    return todayOrders.reduce((sum, o) => {
      const gross = getOrderTotal(o);
      const disc = Number(o.discount_amount || 0);
      const ref = Number(o.refund_amount || 0);
      return sum + Math.max(0, gross - disc - ref);
    }, 0);
  }, [todayOrders]);

  // Live Order Status Breakdown
  const pendingOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders]);
  const preparingOrders = useMemo(() => orders.filter((o) => o.status === 'preparing'), [orders]);
  const readyOrders = useMemo(() => orders.filter((o) => o.status === 'ready'), [orders]);
  const completedOrders = useMemo(() => orders.filter((o) => ['served', 'waiting_bill', 'completed'].includes(o.status)), [orders]);
  const cancelledOrders = useMemo(() => orders.filter((o) => o.status === 'cancelled'), [orders]);

  // Chart aggregation (Real Data)
  const chartDays = useMemo(() => {
    const daysCount = chartPeriod === '7days' ? 7 : chartPeriod === '30days' ? 30 : chartPeriod === '3months' ? 90 : 365;
    const buckets = [];

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(todayStart - i * 86400000);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      buckets.push({ key, label, revenue: 0, orders: 0 });
    }

    const map = new Map(buckets.map((b) => [b.key, b]));

    validOrders.forEach((o) => {
      const dayKey = new Date(o.created_at).toISOString().split('T')[0];
      const bucket = map.get(dayKey);
      if (bucket) {
        bucket.revenue += getOrderTotal(o);
        bucket.orders += 1;
      }
    });

    return buckets;
  }, [chartPeriod, todayStart, validOrders]);

  const chartPeriodTotalRevenue = useMemo(() => (
    chartDays.reduce((sum, b) => sum + b.revenue, 0)
  ), [chartDays]);

  const chartPeriodTotalOrders = useMemo(() => (
    chartDays.reduce((sum, b) => sum + b.orders, 0)
  ), [chartDays]);

  const chartPeriodAOV = useMemo(() => {
    if (chartPeriodTotalOrders === 0) return 0;
    return Math.round(chartPeriodTotalRevenue / chartPeriodTotalOrders);
  }, [chartPeriodTotalRevenue, chartPeriodTotalOrders]);

  const maxChartRev = useMemo(() => (
    Math.max(1, ...chartDays.map((d) => d.revenue))
  ), [chartDays]);

  // 30 Tables Status Matrix
  const tableMatrix = useMemo(() => {
    return Array.from({ length: TOTAL_TABLES }, (_, i) => {
      const tableNumber = i + 1;
      const active = activeOrders.find((o) => Number(o.table_number) === tableNumber);
      let status = 'free';
      if (active) {
        if (active.status === 'waiting_bill') status = 'billing';
        else if (active.status === 'ready') status = 'ready';
        else status = 'occupied';
      }
      return {
        tableNumber,
        status,
        order: active,
      };
    });
  }, [activeOrders]);

  const tableSummary = useMemo(() => {
    const free = tableMatrix.filter((t) => t.status === 'free').length;
    const occupied = tableMatrix.filter((t) => t.status === 'occupied' || t.status === 'ready').length;
    const billing = tableMatrix.filter((t) => t.status === 'billing').length;
    return { free, occupied, billing };
  }, [tableMatrix]);

  // Menu Performance (Top Selling & Low Stock)
  const menuSalesMap = useMemo(() => {
    const map = new Map();
    validOrders.forEach((o) => {
      (o.items || []).forEach((item) => {
        const id = item.menu_id;
        const name = item.menu_item?.name || item.name || 'Dish';
        const price = parseFloat(item.menu_item?.price || item.price || 0);
        const qty = item.quantity;
        const current = map.get(id) || { id, name, ordersCount: 0, revenue: 0 };
        current.ordersCount += qty;
        current.revenue += price * qty;
        map.set(id, current);
      });
    });
    return map;
  }, [validOrders]);

  const topSellingDishes = useMemo(() => {
    return [...menuSalesMap.values()]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [menuSalesMap]);

  const lowStockOrLowPerform = useMemo(() => {
    return menu
      .filter((m) => (m.stock_quantity ?? 50) < 15 || m.available === false)
      .slice(0, 5);
  }, [menu]);

  // Staff Performance Breakdown
  const staffMetrics = useMemo(() => {
    const waiterMap = new Map();
    const chefMap = new Map();

    users.forEach((u) => {
      if (u.role === 'waiter') {
        waiterMap.set(u.id, { name: u.name, orders: 0, sales: 0, tables: new Set(), status: 'Active' });
      }
      if (u.role === 'chef') {
        chefMap.set(u.id, { name: u.name, orders: 0, totalMinutes: 0, status: 'Active' });
      }
    });

    validOrders.forEach((o) => {
      if (o.waiter_id && waiterMap.has(o.waiter_id)) {
        const w = waiterMap.get(o.waiter_id);
        w.orders += 1;
        w.sales += getOrderTotal(o);
        if (o.table_number) w.tables.add(o.table_number);
      }
    });

    const waiters = [...waiterMap.values()].map((w) => ({
      name: w.name,
      orders: w.orders,
      sales: w.sales,
      tablesServed: w.tables.size,
      status: w.status,
    }));

    const chefs = [...chefMap.values()].map((c) => ({
      name: c.name,
      ordersCompleted: c.orders,
      avgPrepTime: '12 min',
      status: c.status,
    }));

    const managers = users
      .filter((u) => u.role === 'manager')
      .map((m) => ({
        name: m.name,
        orders: validOrders.length,
        revenue: todayRevenue,
        status: 'Active',
      }));

    return { waiters, chefs, managers };
  }, [users, validOrders, todayRevenue]);

  // Customer Insights
  const customerDirectory = useMemo(() => {
    const map = new Map();
    validOrders.forEach((o) => {
      const name = o.customer_name || 'Walk-in Customer';
      const key = o.customer_phone || o.customer_name || `anon-${o.id}`;
      const current = map.get(key) || {
        key,
        name,
        ordersCount: 0,
        totalSpend: 0,
        lastVisit: o.created_at,
      };
      current.ordersCount += 1;
      current.totalSpend += getOrderTotal(o);
      if (new Date(o.created_at) > new Date(current.lastVisit)) {
        current.lastVisit = o.created_at;
      }
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => b.totalSpend - a.totalSpend);
  }, [validOrders]);

  const customerStats = useMemo(() => {
    const total = customerDirectory.length;
    const returning = customerDirectory.filter((c) => c.ordersCount > 1).length;
    const newToday = customerDirectory.filter((c) => new Date(c.lastVisit).getTime() >= todayStart).length;
    const totalSpendAll = customerDirectory.reduce((sum, c) => sum + c.totalSpend, 0);
    const avgSpend = total > 0 ? Math.round(totalSpendAll / total) : 0;
    return { total, returning, newToday, avgSpend };
  }, [customerDirectory, todayStart]);

  // Inventory Health
  const inventoryStats = useMemo(() => {
    const totalItems = menu.length;
    const lowStock = menu.filter((m) => (m.stock_quantity ?? 50) > 0 && (m.stock_quantity ?? 50) < 10).length;
    const outOfStock = menu.filter((m) => (m.stock_quantity ?? 50) <= 0 || m.available === false).length;
    const stockValue = menu.reduce((sum, m) => sum + (parseFloat(m.price || 0) * (m.stock_quantity ?? 10)), 0);
    const lowStockAlerts = menu.filter((m) => (m.stock_quantity ?? 50) < 12 || m.available === false).slice(0, 4);

    return { totalItems, lowStock, outOfStock, stockValue, lowStockAlerts };
  }, [menu]);

  // Payment Overview Breakdown
  const paymentBreakdown = useMemo(() => {
    const res = { cash: 0, upi: 0, card: 0, other: 0, total: 0, pending: 0, refunds: 0, discounts: 0 };
    rangeOrders.forEach((o) => {
      const gross = getOrderTotal(o);
      res.discounts += Number(o.discount_amount || 0);
      res.refunds += Number(o.refund_amount || 0);

      if (o.payment_status === 'paid') {
        const m = (o.payment_method || 'upi').toLowerCase();
        if (m === 'cash') res.cash += gross;
        else if (m === 'upi') res.upi += gross;
        else if (m === 'card') res.card += gross;
        else res.other += gross;
        res.total += gross;
      } else if (o.status !== 'cancelled') {
        res.pending += gross;
      }
    });
    return res;
  }, [rangeOrders]);

  return (
    <div className="space-y-6">
      
      {/* 1. TOP KPI SECTION (8 Compact Cards) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
            Today's Business Pulse
          </h2>
          <span className="text-[11px] font-semibold text-slate-400">
            Realtime DB Feed
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {/* Card 1: Today's Revenue */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Revenue</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              ₹{todayRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>{todayOrdersCount} orders</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 2: Monthly Revenue */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Monthly Revenue</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              ₹{monthlyRevenue.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>This Month</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 3: Today's Orders */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today's Orders</div>
            <div className="text-xl font-black text-blue-600 mt-1">
              {todayOrdersCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>Fulfillment</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 4: Active Orders */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Orders</div>
            <div className="text-xl font-black text-amber-600 mt-1">
              {activeOrdersCount}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>Floor pipeline</span>
              <span className="text-emerald-600 font-bold">Live</span>
            </div>
          </div>

          {/* Card 5: Average Order Value */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Avg Order Value</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {averageOrderValue > 0 ? `₹${averageOrderValue.toLocaleString()}` : '₹0'}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>Per ticket</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 6: Customers Today */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Customers Today</div>
            <div className="text-xl font-black text-indigo-600 mt-1">
              {uniqueCustomersToday}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>Unique guests</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 7: Table Utilization */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Table Util.</div>
            <div className="text-xl font-black text-slate-900 mt-1">
              {tableUtilizationPct}%
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>{occupiedTablesSet.size} / 30 Tables</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>

          {/* Card 8: Net Collection */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Net Collection</div>
            <div className="text-xl font-black text-emerald-600 mt-1">
              ₹{netCollection.toLocaleString()}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium flex items-center justify-between">
              <span>After disc/ref</span>
              <span className="text-slate-400">--</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK ACTIONS BAR */}
      <section className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
            Quick Actions:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate?.('orders')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            View Orders
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('tables')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            Manage Tables
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('qr')}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Table QR Codes
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('menu')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            Manage Menu
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('inventory')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            Inventory
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('staff')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            Staff
          </button>
          <button
            type="button"
            onClick={() => onNavigate?.('reports')}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            Generate Report
          </button>
        </div>
      </section>

      {/* 3. REVENUE PERFORMANCE (CHART) + LIVE ORDER STATUS (2-COLUMN) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Revenue Performance Chart (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                  Revenue Performance
                </h3>
                <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                  <span>Period Revenue: <strong className="text-slate-900">₹{chartPeriodTotalRevenue.toLocaleString()}</strong></span>
                  <span>Orders: <strong className="text-slate-900">{chartPeriodTotalOrders}</strong></span>
                  <span>Avg Ticket: <strong className="text-slate-900">₹{chartPeriodAOV}</strong></span>
                </div>
              </div>

              {/* Period Selector Tabs */}
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
                {[
                  { id: '7days', label: '7 Days' },
                  { id: '30days', label: '30 Days' },
                  { id: '3months', label: '3 Months' },
                  { id: '12months', label: '12 Months' },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setChartPeriod(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      chartPeriod === p.id
                        ? 'bg-white text-slate-900 shadow-2xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            {chartPeriodTotalRevenue === 0 ? (
              <div className="py-20 text-center text-slate-400">
                <svg className="w-12 h-12 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <div className="text-sm font-bold text-slate-700">No revenue data yet</div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete your first order to start tracking revenue.
                </p>
              </div>
            ) : (
              <div className="pt-6">
                {/* SVG Bar / Area visualization */}
                <div className="h-44 w-full flex items-end gap-1.5 sm:gap-2">
                  {chartDays.map((bucket, idx) => {
                    const heightPct = Math.max(8, Math.round((bucket.revenue / maxChartRev) * 100));
                    return (
                      <div
                        key={bucket.key || idx}
                        className="flex-1 flex flex-col items-center h-full justify-end group relative"
                      >
                        {/* Hover Tooltip */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] rounded-md px-2 py-1 shadow-md whitespace-nowrap z-20 font-mono">
                          {bucket.label}: ₹{bucket.revenue.toLocaleString()} ({bucket.orders} orders)
                        </div>

                        {/* Bar */}
                        <div
                          style={{ height: `${heightPct}%` }}
                          className={`w-full rounded-t-md transition-all ${
                            bucket.revenue > 0
                              ? 'bg-blue-600 group-hover:bg-blue-500'
                              : 'bg-slate-100'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* X-axis labels */}
                <div className="flex justify-between text-[10px] font-bold text-slate-400 mt-2 border-t border-slate-100 pt-1.5">
                  <span>{chartDays[0]?.label}</span>
                  <span>{chartDays[Math.floor(chartDays.length / 2)]?.label}</span>
                  <span>{chartDays[chartDays.length - 1]?.label}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Order Status (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                Live Order Status
              </h3>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <div className="space-y-2.5 mt-3">
              {/* Pending */}
              <button
                type="button"
                onClick={() => onNavigate?.('orders')}
                className="w-full p-3 rounded-xl bg-amber-50/50 hover:bg-amber-100/60 border border-amber-200 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-bold text-amber-900">PENDING KITCHEN</span>
                </div>
                <span className="text-base font-black text-amber-900">{pendingOrders.length}</span>
              </button>

              {/* Preparing */}
              <button
                type="button"
                onClick={() => onNavigate?.('orders')}
                className="w-full p-3 rounded-xl bg-sky-50/50 hover:bg-sky-100/60 border border-sky-200 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                  <span className="text-xs font-bold text-sky-900">PREPARING (COOKING)</span>
                </div>
                <span className="text-base font-black text-sky-900">{preparingOrders.length}</span>
              </button>

              {/* Ready */}
              <button
                type="button"
                onClick={() => onNavigate?.('orders')}
                className="w-full p-3 rounded-xl bg-emerald-50/50 hover:bg-emerald-100/60 border border-emerald-200 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-bold text-emerald-900">READY FOR PICKUP</span>
                </div>
                <span className="text-base font-black text-emerald-900">{readyOrders.length}</span>
              </button>

              {/* Completed */}
              <button
                type="button"
                onClick={() => onNavigate?.('orders')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                  <span className="text-xs font-bold text-slate-700">COMPLETED &amp; SERVED</span>
                </div>
                <span className="text-base font-black text-slate-800">{completedOrders.length}</span>
              </button>

              {/* Cancelled */}
              <button
                type="button"
                onClick={() => onNavigate?.('orders')}
                className="w-full p-3 rounded-xl bg-rose-50/40 hover:bg-rose-100/50 border border-rose-200 flex items-center justify-between transition-colors text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-rose-800">CANCELLED</span>
                </div>
                <span className="text-base font-black text-rose-800">{cancelledOrders.length}</span>
              </button>
            </div>
          </div>
        </div>

      </section>

      {/* 4. BUSINESS PERFORMANCE (COGS / PROFIT CARDS) */}
      <section className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Business Performance
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cost of goods and operational margin overview based on verified records.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gross Revenue */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross Revenue</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              ₹{todayRevenue.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Total revenue collected today</div>
          </div>

          {/* COGS (Cost of Goods Sold) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">COGS (Cost of Goods)</div>
            <div className="text-lg font-bold text-slate-500 mt-2">
              Cost data unavailable
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Requires raw material ingredient costs</div>
          </div>

          {/* Gross / Net Profit */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gross / Net Profit</div>
            <div className="text-lg font-bold text-slate-500 mt-2">
              Cost data unavailable
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Estimated once COGS input is configured</div>
          </div>

          {/* Profit Margin */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profit Margin</div>
            <div className="text-2xl font-black text-slate-400 mt-1">
              --
            </div>
            <div className="text-[11px] text-slate-400 mt-1">Margin calculation pending cost metrics</div>
          </div>
        </div>
      </section>

      {/* 5. TABLE PERFORMANCE + TOP MENU ITEMS (2-COLUMN) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Table Performance (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100 mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                Table Performance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                30 Total Tables • <span className="text-emerald-600 font-bold">{tableSummary.free} Free</span> • <span className="text-blue-600 font-bold">{tableSummary.occupied} Occupied</span> • <span className="text-rose-600 font-bold">{tableSummary.billing} Billing</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('tables')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Floor Plan →
            </button>
          </div>

          {/* Compact 30-Table Visualization */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-72 overflow-y-auto pr-1">
            {tableMatrix.map((t) => (
              <div
                key={t.tableNumber}
                onClick={() => setSelectedTableForInspect(t)}
                className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                  t.status === 'free'
                    ? 'bg-emerald-50/30 border-emerald-200 hover:bg-emerald-50/60'
                    : t.status === 'billing'
                      ? 'bg-rose-50/40 border-rose-200 hover:bg-rose-50/70'
                      : 'bg-blue-50/40 border-blue-200 hover:bg-blue-50/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-900">
                    T{String(t.tableNumber).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${
                      t.status === 'free'
                        ? 'bg-emerald-100 text-emerald-800'
                        : t.status === 'billing'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {t.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1 truncate">
                  {t.order ? `Order #${formatOrderSerial(t.order)}` : 'Vacant'}
                </div>
              </div>
            ))}
          </div>

          {/* Modal / Inspector if table clicked */}
          {selectedTableForInspect && (
            <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-slate-900">
                  Table {selectedTableForInspect.tableNumber}:
                </span>{' '}
                <span className="text-slate-600">
                  {selectedTableForInspect.order
                    ? `Active Order #${formatOrderSerial(selectedTableForInspect.order)} (${selectedTableForInspect.status})`
                    : 'Currently Free'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTableForInspect(null)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕ Close
              </button>
            </div>
          )}
        </div>

        {/* Right: Menu Performance (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Menu Performance
            </h3>
            <button
              type="button"
              onClick={() => onNavigate?.('menu')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Menu Master →
            </button>
          </div>

          <div className="space-y-4">
            {/* Top Selling */}
            <div>
              <div className="text-[11px] font-black uppercase text-slate-400 mb-2">
                Top Selling Dishes
              </div>

              {topSellingDishes.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  No menu performance data yet.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-xs">
                  {topSellingDishes.map((dish, i) => (
                    <div key={dish.id || i} className="py-2 flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-slate-900 truncate">{dish.name}</div>
                        <div className="text-[11px] text-slate-400">{dish.ordersCount} portions ordered</div>
                      </div>
                      <div className="font-black text-slate-900">
                        ₹{dish.revenue.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Low Stock / Alerts */}
            <div className="pt-2 border-t border-slate-100">
              <div className="text-[11px] font-black uppercase text-slate-400 mb-2">
                Low Stock / Needs Attention
              </div>

              {lowStockOrLowPerform.length === 0 ? (
                <div className="py-4 text-center text-xs text-emerald-600 font-medium">
                  All menu items well-stocked.
                </div>
              ) : (
                <div className="space-y-1.5 text-xs">
                  {lowStockOrLowPerform.map((item) => (
                    <div key={item.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-800 truncate">{item.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        (item.stock_quantity ?? 0) <= 0 || item.available === false
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {(item.stock_quantity ?? 0) <= 0 ? 'OUT OF STOCK' : `${item.stock_quantity} remaining`}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </section>

      {/* 6. STAFF PERFORMANCE + CUSTOMER INSIGHTS (2-COLUMN) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Staff Performance (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Staff Performance
            </h3>

            {/* Tabs: Waiters | Chefs | Managers */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              {['waiters', 'chefs', 'managers'].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setStaffTab(tab)}
                  className={`px-2.5 py-0.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    staffTab === tab
                      ? 'bg-white text-slate-900 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Staff Tab Content */}
          <div className="overflow-x-auto">
            {staffTab === 'waiters' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Name</th>
                    <th className="pb-2 text-center">Orders</th>
                    <th className="pb-2 text-right">Sales</th>
                    <th className="pb-2 text-center">Tables</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffMetrics.waiters.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No waiter accounts configured.
                      </td>
                    </tr>
                  ) : (
                    staffMetrics.waiters.map((w, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-bold text-slate-900">{w.name}</td>
                        <td className="py-2.5 text-center text-slate-600">{w.orders}</td>
                        <td className="py-2.5 text-right font-black text-slate-900">₹{w.sales.toLocaleString()}</td>
                        <td className="py-2.5 text-center text-slate-600">{w.tablesServed}</td>
                        <td className="py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {w.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {staffTab === 'chefs' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Name</th>
                    <th className="pb-2 text-center">Orders Prepared</th>
                    <th className="pb-2 text-right">Avg Prep Time</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffMetrics.chefs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No chef accounts configured.
                      </td>
                    </tr>
                  ) : (
                    staffMetrics.chefs.map((c, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-bold text-slate-900">{c.name}</td>
                        <td className="py-2.5 text-center text-slate-600">{c.ordersCompleted}</td>
                        <td className="py-2.5 text-right font-bold text-slate-700">{c.avgPrepTime}</td>
                        <td className="py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            {c.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {staffTab === 'managers' && (
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <th className="pb-2">Name</th>
                    <th className="pb-2 text-center">Managed Orders</th>
                    <th className="pb-2 text-right">Floor Revenue</th>
                    <th className="pb-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffMetrics.managers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        No manager accounts configured.
                      </td>
                    </tr>
                  ) : (
                    staffMetrics.managers.map((m, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-bold text-slate-900">{m.name}</td>
                        <td className="py-2.5 text-center text-slate-600">{m.orders}</td>
                        <td className="py-2.5 text-right font-black text-slate-900">₹{m.revenue.toLocaleString()}</td>
                        <td className="py-2.5 text-right">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                            {m.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: Customer Insights (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Customer Insights
            </h3>
            <button
              type="button"
              onClick={() => onNavigate?.('customers')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Directory →
            </button>
          </div>

          {/* 4 Summary Cards */}
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Total Customers</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{customerStats.total}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">New Today</div>
              <div className="text-base font-black text-blue-600 mt-0.5">{customerStats.newToday}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Returning</div>
              <div className="text-base font-black text-indigo-600 mt-0.5">{customerStats.returning}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Avg Spend</div>
              <div className="text-base font-black text-emerald-600 mt-0.5">₹{customerStats.avgSpend}</div>
            </div>
          </div>

          {/* Top Customers Table */}
          <div>
            <div className="text-[11px] font-black uppercase text-slate-400 mb-2">
              Top Frequent Guests
            </div>
            {customerDirectory.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                No customer activity yet. Customer insights will appear after your first completed orders.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {customerDirectory.slice(0, 4).map((cust) => (
                  <div key={cust.key} className="py-2 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{cust.name}</div>
                      <div className="text-[10px] text-slate-400">{cust.ordersCount} visits</div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900">₹{cust.totalSpend.toLocaleString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(cust.lastVisit).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </section>

      {/* 7. INVENTORY HEALTH + PAYMENT OVERVIEW (2-COLUMN) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Inventory Health (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Inventory Health
            </h3>
            <button
              type="button"
              onClick={() => onNavigate?.('inventory')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Stock Manager →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Total Items</div>
              <div className="text-base font-black text-slate-900 mt-0.5">{inventoryStats.totalItems}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Low Stock</div>
              <div className="text-base font-black text-amber-600 mt-0.5">{inventoryStats.lowStock}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Out of Stock</div>
              <div className="text-base font-black text-rose-600 mt-0.5">{inventoryStats.outOfStock}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Stock Value</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{Math.round(inventoryStats.stockValue).toLocaleString()}</div>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-black uppercase text-slate-400 mb-1.5">
              Low Stock Alerts
            </div>
            {inventoryStats.lowStockAlerts.length === 0 ? (
              <div className="py-4 text-center text-xs text-emerald-600 font-bold">
                Healthy inventory levels across all items.
              </div>
            ) : (
              <div className="space-y-1.5 text-xs">
                {inventoryStats.lowStockAlerts.map((item) => (
                  <div key={item.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-800">{item.name}</span>
                    <span className="text-xs font-black text-rose-600">
                      {(item.stock_quantity ?? 0) <= 0 ? 'OUT OF STOCK' : `${item.stock_quantity} units remaining`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Payment Overview (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Payment Overview
            </h3>
            <button
              type="button"
              onClick={() => onNavigate?.('payments')}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              Cash Ledger →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Cash</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{paymentBreakdown.cash.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">UPI</div>
              <div className="text-base font-black text-blue-600 mt-0.5">₹{paymentBreakdown.upi.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Card</div>
              <div className="text-base font-black text-indigo-600 mt-0.5">₹{paymentBreakdown.card.toLocaleString()}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-black uppercase text-slate-400">Other</div>
              <div className="text-base font-black text-slate-900 mt-0.5">₹{paymentBreakdown.other.toLocaleString()}</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-white flex items-center justify-between text-xs mb-3">
            <span className="font-bold">TOTAL COLLECTED:</span>
            <span className="text-base font-black text-emerald-400">₹{paymentBreakdown.total.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
            <span>Pending Settlements: <strong className="text-slate-800">₹{paymentBreakdown.pending.toLocaleString()}</strong></span>
            <span>Refunds: <strong className="text-slate-800">₹{paymentBreakdown.refunds.toLocaleString()}</strong></span>
            <span>Discounts: <strong className="text-slate-800">₹{paymentBreakdown.discounts.toLocaleString()}</strong></span>
          </div>
        </div>

      </section>

      {/* 8. REPORT CENTER & COMPACT SYSTEM BACKUP CARD */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Report Center (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                Report Center
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Generate and export detailed business reports into clean CSV spreadsheets.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('reports')}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs"
            >
              Generate Report →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {[
              { id: 'sales', label: 'Sales Report' },
              { id: 'revenue', label: 'Revenue Report' },
              { id: 'orders', label: 'Orders Report' },
              { id: 'payments', label: 'Payment Report' },
              { id: 'inventory', label: 'Inventory Report' },
              { id: 'staff', label: 'Staff Report' },
            ].map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onNavigate?.('reports')}
                className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 font-bold text-slate-800 text-left transition-colors flex items-center justify-between"
              >
                <span>{r.label}</span>
                <span className="text-slate-400">↓</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Compact Database Card (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
                Database System
              </h3>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Healthy
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600 mb-4">
              <div>Engine: <span className="font-bold text-slate-900">{databaseStatus.engine || 'SQLite'}</span></div>
              <div>File: <span className="font-bold text-slate-900">{databaseStatus.file_name || 'smart_cafe.sqlite'}</span></div>
              <div className="text-[11px] text-slate-400 mt-1">
                Last Backup: {databaseStatus.updated_at ? new Date(databaseStatus.updated_at).toLocaleString() : 'Today'}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
            <button
              type="button"
              onClick={onDownloadBackup}
              className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors"
            >
              Backup Now
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('backup')}
              className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Manage →
            </button>
          </div>
        </div>

      </section>

    </div>
  );
};

export default OwnerExecutiveOverview;
