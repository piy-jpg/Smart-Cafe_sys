import React, { useMemo, useState } from 'react';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const ManagerStaffView = ({ staff = [], orders = [] }) => {
  const [roleFilter, setRoleFilter] = useState('all'); // 'all' | 'waiter' | 'chef' | 'manager'
  const [search, setSearch] = useState('');

  // Calculate real performance metrics per staff member
  const staffWithStats = useMemo(() => {
    return staff.map((member) => {
      // Find orders where waiter_id === member.id OR waiter.name === member.name
      const handledOrders = orders.filter((o) => o.waiter_id === member.id || o.waiter?.name === member.name);
      const totalSales = handledOrders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? getOrderTotal(o) : 0), 0);
      const tablesSet = new Set(handledOrders.map((o) => o.table_number).filter(Boolean));

      let performanceLabel = 'Good';
      if (handledOrders.length >= 10) performanceLabel = 'Top Performer';
      else if (handledOrders.length === 0) performanceLabel = 'Standby';

      return {
        ...member,
        ordersCount: handledOrders.length,
        totalSales,
        tablesCount: tablesSet.size,
        avgTicket: handledOrders.length > 0 ? Math.round(totalSales / handledOrders.length) : 0,
        performance: performanceLabel,
        status: 'Online / Active',
      };
    });
  }, [staff, orders]);

  const filteredStaff = useMemo(() => {
    return staffWithStats
      .filter((member) => {
        if (roleFilter === 'all') return true;
        if (roleFilter === 'waiter') return ['waiter', 'staff', 'master_waiter'].includes(member.role);
        return member.role === roleFilter;
      })
      .filter((member) => {
        if (!search.trim()) return true;
        const q = search.trim().toLowerCase();
        return member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q) || (member.role || '').toLowerCase().includes(q);
      })
      .sort((a, b) => b.totalSales - a.totalSales);
  }, [staffWithStats, roleFilter, search]);

  const counts = {
    total: staff.length,
    waiters: staff.filter((s) => ['waiter', 'staff', 'master_waiter'].includes(s.role)).length,
    chefs: staff.filter((s) => s.role === 'chef').length,
    managers: staff.filter((s) => s.role === 'manager' || s.role === 'owner').length,
  };

  return (
    <div className="space-y-5">
      {/* Top 4 Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Restaurant Staff</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{counts.total}</div>
          <span className="text-[11px] text-slate-400">Registered team members</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">Service Waiters</span>
          <div className="text-2xl font-black text-blue-600 mt-2">{counts.waiters}</div>
          <span className="text-[11px] text-blue-600 font-semibold">Front of house</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Kitchen Chefs</span>
          <div className="text-2xl font-black text-amber-600 mt-2">{counts.chefs}</div>
          <span className="text-[11px] text-amber-700 font-semibold">Back of house / Line</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500">Shift Managers</span>
          <div className="text-2xl font-black text-purple-600 mt-2">{counts.managers}</div>
          <span className="text-[11px] text-purple-700 font-semibold">Supervisors</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Staff', count: counts.total },
            { id: 'waiter', label: 'Waiters', count: counts.waiters },
            { id: 'chef', label: 'Chefs', count: counts.chefs },
            { id: 'manager', label: 'Managers & Owners', count: counts.managers },
          ].map((f) => {
            const isActive = roleFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setRoleFilter(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'}`}>
                  {f.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff name, email..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <svg
            className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Shift Status</th>
                <th className="py-3 px-4">Orders Handled</th>
                <th className="py-3 px-4">Total Sales</th>
                <th className="py-3 px-4">Tables Serviced</th>
                <th className="py-3 px-4">Avg Ticket</th>
                <th className="py-3 px-4 text-right">Performance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No staff records found.
                  </td>
                </tr>
              ) : (
                filteredStaff.map((member) => {
                  const initial = (member.name || 'S').charAt(0).toUpperCase();

                  let roleBadge = 'bg-blue-100 text-blue-800 border-blue-200';
                  if (member.role === 'chef') roleBadge = 'bg-amber-100 text-amber-800 border-amber-200';
                  else if (member.role === 'manager') roleBadge = 'bg-purple-100 text-purple-800 border-purple-200';
                  else if (member.role === 'owner') roleBadge = 'bg-slate-900 text-white border-slate-900';

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold flex items-center justify-center text-xs">
                            {initial}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm">{member.name}</div>
                            <div className="text-[11px] text-slate-400">{member.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${roleBadge}`}>
                          {member.role}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>Active / On Shift</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900 text-sm">
                        {member.ordersCount}
                      </td>

                      <td className="py-3 px-4 font-black text-slate-900 text-sm">
                        ₹{member.totalSales.toFixed(0)}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        {member.tablesCount} tables
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-700">
                        ₹{member.avgTicket}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {member.performance}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ManagerStaffView;
