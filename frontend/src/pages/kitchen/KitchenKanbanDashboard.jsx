import React from 'react';
import KitchenOrderTicket from '../../components/KitchenOrderTicket';

const KitchenKanbanDashboard = ({
  orders = [],
  kpis = {
    pendingCount: 0,
    preparingCount: 0,
    readyCount: 0,
    itemsInQueue: 0,
    averageAgeMinutes: 0,
    averagePrepTimeMinutes: 0,
  },
  onStartCooking,
  onMarkReady,
  onHandoff,
  onViewDetails,
  recentlyUpdatedOrderIds = [],
}) => {
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const preparingOrders = orders.filter((o) => o.status === 'preparing');
  const readyOrders = orders.filter((o) => o.status === 'ready');

  const kpiCards = [
    {
      label: 'Pending Orders',
      value: kpis.pendingCount,
      subtext: 'Awaiting cooking start',
      icon: (
        <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-amber-50 border-amber-200 text-amber-900',
      iconBg: 'bg-amber-100',
    },
    {
      label: 'Preparing',
      value: kpis.preparingCount,
      subtext: 'Active on stove / grill',
      icon: (
        <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
        </svg>
      ),
      bg: 'bg-blue-50 border-blue-200 text-blue-900',
      iconBg: 'bg-blue-100',
    },
    {
      label: 'Ready for Pickup',
      value: kpis.readyCount,
      subtext: 'Plated on the pass',
      icon: (
        <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-emerald-50 border-emerald-200 text-emerald-900',
      iconBg: 'bg-emerald-100',
    },
    {
      label: 'Items in Queue',
      value: kpis.itemsInQueue,
      subtext: 'Total portions to cook',
      icon: (
        <svg className="w-5 h-5 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      bg: 'bg-slate-50 border-slate-200 text-slate-800',
      iconBg: 'bg-slate-200',
    },
    {
      label: 'Average Order Age',
      value: `${kpis.averageAgeMinutes}m`,
      subtext: 'Time since ticket placed',
      icon: (
        <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      bg: 'bg-indigo-50 border-indigo-200 text-indigo-900',
      iconBg: 'bg-indigo-100',
    },
    {
      label: 'Average Prep Time',
      value: `${kpis.averagePrepTimeMinutes}m`,
      subtext: 'Kitchen completion speed',
      icon: (
        <svg className="w-5 h-5 text-fuchsia-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-900',
      iconBg: 'bg-fuchsia-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {kpiCards.map((kpi, idx) => (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition-shadow"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {kpi.label}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.iconBg}`}>
                {kpi.icon}
              </div>
            </div>
            <div className="mt-2 text-2xl font-black text-slate-900 tracking-tight">
              {kpi.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-400 truncate">
              {kpi.subtext}
            </div>
          </div>
        ))}
      </div>

      {/* Main Section: Professional Kanban Workflow */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Kitchen Live Flow</span>
              <span className="text-xs font-normal text-slate-500">
                (Realtime Drag & Action Kanban)
              </span>
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              {pendingOrders.length} Pending
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {preparingOrders.length} Cooking
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {readyOrders.length} Ready
            </span>
          </div>
        </div>

        {/* 3-Column Kanban Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-start">
          {/* COLUMN 1: PENDING */}
          <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col min-h-[600px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <h3 className="font-extrabold text-sm text-slate-800 tracking-wider uppercase">
                  PENDING
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                {pendingOrders.length} {pendingOrders.length === 1 ? 'ORDER' : 'ORDERS'}
              </span>
            </div>

            {/* Tickets */}
            <div className="space-y-3.5 flex-1 overflow-y-auto pr-0.5">
              {pendingOrders.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-white/40 text-center px-4">
                  <svg className="w-8 h-8 mb-2 opacity-50 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-500">No pending orders</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">New tickets from waiters or QR will appear instantly here.</p>
                </div>
              ) : (
                pendingOrders.map((order) => (
                  <KitchenOrderTicket
                    key={order.id}
                    order={order}
                    onStartCooking={onStartCooking}
                    onMarkReady={onMarkReady}
                    onHandoff={onHandoff}
                    onViewDetails={onViewDetails}
                    isRecentlyUpdated={recentlyUpdatedOrderIds.includes(order.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: PREPARING */}
          <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-200/70 flex flex-col min-h-[600px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-blue-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></span>
                <h3 className="font-extrabold text-sm text-blue-950 tracking-wider uppercase">
                  PREPARING
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-300">
                {preparingOrders.length} {preparingOrders.length === 1 ? 'ORDER' : 'ORDERS'}
              </span>
            </div>

            {/* Tickets */}
            <div className="space-y-3.5 flex-1 overflow-y-auto pr-0.5">
              {preparingOrders.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-blue-200 rounded-xl bg-white/40 text-center px-4">
                  <svg className="w-8 h-8 mb-2 opacity-50 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-500">No active cooking orders</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click [START PREPARING] on pending tickets to begin cooking.</p>
                </div>
              ) : (
                preparingOrders.map((order) => (
                  <KitchenOrderTicket
                    key={order.id}
                    order={order}
                    onStartCooking={onStartCooking}
                    onMarkReady={onMarkReady}
                    onHandoff={onHandoff}
                    onViewDetails={onViewDetails}
                    isRecentlyUpdated={recentlyUpdatedOrderIds.includes(order.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* COLUMN 3: READY */}
          <div className="bg-emerald-50/50 rounded-2xl p-4 border border-emerald-200/70 flex flex-col min-h-[600px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-emerald-200">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <h3 className="font-extrabold text-sm text-emerald-950 tracking-wider uppercase">
                  READY (PASS)
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                {readyOrders.length} {readyOrders.length === 1 ? 'ORDER' : 'ORDERS'}
              </span>
            </div>

            {/* Tickets */}
            <div className="space-y-3.5 flex-1 overflow-y-auto pr-0.5">
              {readyOrders.length === 0 ? (
                <div className="h-48 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-emerald-200 rounded-xl bg-white/40 text-center px-4">
                  <svg className="w-8 h-8 mb-2 opacity-50 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs font-semibold text-slate-500">Pass is clear</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Completed orders waiting for waiter pickup will appear here.</p>
                </div>
              ) : (
                readyOrders.map((order) => (
                  <KitchenOrderTicket
                    key={order.id}
                    order={order}
                    onStartCooking={onStartCooking}
                    onMarkReady={onMarkReady}
                    onHandoff={onHandoff}
                    onViewDetails={onViewDetails}
                    isRecentlyUpdated={recentlyUpdatedOrderIds.includes(order.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KitchenKanbanDashboard;
