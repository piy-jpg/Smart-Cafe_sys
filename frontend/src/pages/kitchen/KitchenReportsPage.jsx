import React, { useMemo } from 'react';
import { formatOrderSerial } from '../../lib/appConfig';

const KitchenReportsPage = ({ orders = [] }) => {
  // Compute analytics from orders
  const reportData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Filter today's orders
    const todayOrders = orders.filter((o) => new Date(o.created_at).getTime() >= todayStart);
    const completedToday = todayOrders.filter((o) => ['served', 'waiting_bill', 'completed'].includes(o.status));
    const cancelledToday = todayOrders.filter((o) => o.status === 'cancelled');

    // Calculate prep durations
    const prepDurations = completedToday
      .map((order) => {
        const start = order.preparing_at ? new Date(order.preparing_at).getTime() : new Date(order.created_at).getTime();
        const end = order.ready_at ? new Date(order.ready_at).getTime() : order.served_at ? new Date(order.served_at).getTime() : null;
        if (!end || Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
        return {
          order,
          durationMinutes: Math.max(1, Math.round((end - start) / 60000)),
        };
      })
      .filter(Boolean);

    const avgPrepTime = prepDurations.length > 0
      ? Math.round(prepDurations.reduce((sum, d) => sum + d.durationMinutes, 0) / prepDurations.length)
      : 12;

    const sortedDurations = [...prepDurations].sort((a, b) => a.durationMinutes - b.durationMinutes);
    const fastestOrder = sortedDurations[0] || null;
    const slowestOrder = sortedDurations[sortedDurations.length - 1] || null;

    // Peak kitchen hours distribution (grouped by 2-hour slots: 10AM-12PM, 12PM-2PM, 2PM-4PM, 4PM-6PM, 6PM-8PM, 8PM-10PM, 10PM-12AM)
    const hourSlots = [
      { label: '10am - 12pm', count: 0 },
      { label: '12pm - 2pm', count: 0 },
      { label: '2pm - 4pm', count: 0 },
      { label: '4pm - 6pm', count: 0 },
      { label: '6pm - 8pm', count: 0 },
      { label: '8pm - 10pm', count: 0 },
      { label: '10pm - 12am', count: 0 },
    ];

    todayOrders.forEach((order) => {
      const hour = new Date(order.created_at).getHours();
      if (hour >= 10 && hour < 12) hourSlots[0].count += 1;
      else if (hour >= 12 && hour < 14) hourSlots[1].count += 1;
      else if (hour >= 14 && hour < 16) hourSlots[2].count += 1;
      else if (hour >= 16 && hour < 18) hourSlots[3].count += 1;
      else if (hour >= 18 && hour < 20) hourSlots[4].count += 1;
      else if (hour >= 20 && hour < 22) hourSlots[5].count += 1;
      else if (hour >= 22) hourSlots[6].count += 1;
    });

    const maxHourCount = Math.max(...hourSlots.map((s) => s.count), 1);

    // Orders by Category
    const categoryMap = {};
    todayOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const cat = item.menu_item?.category || 'Main Course';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(item.quantity || 1);
      });
    });

    const categoriesList = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const totalPortions = categoriesList.reduce((sum, c) => sum + c.count, 0);

    const successRate = todayOrders.length > 0
      ? Math.round((completedToday.length / todayOrders.length) * 100)
      : 100;

    return {
      completedCount: completedToday.length,
      cancelledCount: cancelledToday.length,
      totalOrdersToday: todayOrders.length,
      avgPrepTime,
      fastestOrder,
      slowestOrder,
      hourSlots,
      maxHourCount,
      categoriesList,
      totalPortions,
      successRate,
    };
  }, [orders]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kitchen Performance & Throughput</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational metrics, ticket completion times, peak rush hours, and station workload.
          </p>
        </div>
        <div className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold">
          Report Period: Today ({new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})
        </div>
      </div>

      {/* Top 4 Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Completed Today */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Completed Today</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900">{reportData.completedCount}</div>
          <div className="mt-1 text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <span>{reportData.successRate}% completion rate</span>
          </div>
        </div>

        {/* Avg Preparation Time */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Avg Prep Time</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-900">{reportData.avgPrepTime}m</div>
          <div className="mt-1 text-xs text-slate-500 font-medium">Target: &lt; 15 mins</div>
        </div>

        {/* Fastest Order */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fastest Ticket</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-emerald-600">
            {reportData.fastestOrder ? `${reportData.fastestOrder.durationMinutes}m` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium truncate">
            {reportData.fastestOrder ? `#${formatOrderSerial(reportData.fastestOrder.order)}` : 'No orders yet'}
          </div>
        </div>

        {/* Slowest Order */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Slowest Ticket</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-3 text-3xl font-black text-slate-800">
            {reportData.slowestOrder ? `${reportData.slowestOrder.durationMinutes}m` : '—'}
          </div>
          <div className="mt-1 text-xs text-slate-500 font-medium truncate">
            {reportData.slowestOrder ? `#${formatOrderSerial(reportData.slowestOrder.order)}` : 'No orders yet'}
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Peak Kitchen Hours */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Peak Kitchen Rush Hours</h3>
                <p className="text-xs text-slate-400 mt-0.5">Order volume by time of day</p>
              </div>
              <span className="text-xs font-semibold px-2 py-1 bg-slate-100 rounded-lg text-slate-600">
                Hourly Distribution
              </span>
            </div>

            {/* Bar Chart */}
            <div className="space-y-3 pt-2">
              {reportData.hourSlots.map((slot, idx) => {
                const percent = Math.round((slot.count / reportData.maxHourCount) * 100);
                const isRush = slot.count >= 3;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">{slot.label}</span>
                      <span className="text-slate-900 font-bold">{slot.count} orders</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          isRush ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : 'bg-blue-400'
                        }`}
                        style={{ width: `${Math.max(percent, slot.count > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Primary rush hours: 12pm - 2pm (Lunch) &amp; 8pm - 10pm (Dinner)</span>
          </div>
        </div>

        {/* Chart 2: Orders by Category */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Portions Cooked by Category</h3>
                <p className="text-xs text-slate-400 mt-0.5">Kitchen portion distribution</p>
              </div>
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                {reportData.totalPortions} Portions
              </span>
            </div>

            <div className="space-y-3.5 pt-2">
              {reportData.categoriesList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No orders recorded today yet.
                </div>
              ) : (
                reportData.categoriesList.map((cat, idx) => {
                  const percent = reportData.totalPortions > 0
                    ? Math.round((cat.count / reportData.totalPortions) * 100)
                    : 0;

                  return (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-700">{cat.name}</span>
                        <span className="text-slate-900 font-bold">
                          {cat.count} portions ({percent}%)
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
            Helps plan station prep (tandoor vs fry station vs curry prep) ahead of rush hours.
          </div>
        </div>
      </div>

      {/* Row 3: Completed vs Cancelled & Kitchen Workload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Completed vs Cancelled */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Completed vs Cancelled Orders</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
              <div className="text-3xl font-black text-emerald-700">{reportData.completedCount}</div>
              <div className="text-xs font-bold text-emerald-800 mt-1 uppercase tracking-wider">Completed</div>
              <div className="text-[11px] text-emerald-600 mt-0.5">{reportData.successRate}% Success</div>
            </div>
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-center">
              <div className="text-3xl font-black text-rose-700">{reportData.cancelledCount}</div>
              <div className="text-xs font-bold text-rose-800 mt-1 uppercase tracking-wider">Cancelled</div>
              <div className="text-[11px] text-rose-600 mt-0.5">
                {100 - reportData.successRate}% Cancellation
              </div>
            </div>
          </div>
        </div>

        {/* Station Workload */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Station Cooking Workload</h3>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">Station 1: Grill &amp; Tandoor</span>
              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Optimal (Normal)</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">Station 2: Curries &amp; Gravies</span>
              <span className="font-mono font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Active</span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800">Station 3: Fryers &amp; Appetizers</span>
              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Optimal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenReportsPage;
