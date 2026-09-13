import React, { useMemo, useState } from 'react';
import { formatOrderLocation, formatOrderSerial } from '../../lib/appConfig';

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const ManagerCustomersView = ({ orders = [] }) => {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Aggregate customers from orders
  const customersList = useMemo(() => {
    const map = new Map();

    orders.forEach((o) => {
      const key = (o.customer_phone?.trim()) || (o.customer_name?.trim()) || (o.table_number ? `Walk-in (Table ${o.table_number})` : 'Walk-in');
      const name = o.customer_name?.trim() || 'Walk-in Guest';
      const phone = o.customer_phone?.trim() || 'Not Provided';
      const total = o.status !== 'cancelled' ? getOrderTotal(o) : 0;
      const orderDate = new Date(o.created_at);

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name,
          phone,
          ordersCount: 0,
          totalSpend: 0,
          lastVisit: orderDate,
          orders: [],
        });
      }

      const current = map.get(key);
      current.ordersCount += 1;
      current.totalSpend += total;
      if (orderDate > current.lastVisit) {
        current.lastVisit = orderDate;
      }
      current.orders.push(o);
    });

    return [...map.values()].sort((a, b) => b.totalSpend - a.totalSpend);
  }, [orders]);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customersList;
    const q = search.trim().toLowerCase();
    return customersList.filter((c) =>
      c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q)
    );
  }, [customersList, search]);

  const totalCustomers = customersList.length;
  const totalRevenue = customersList.reduce((s, c) => s + c.totalSpend, 0);
  const avgSpendPerCustomer = totalCustomers > 0 ? Math.round(totalRevenue / totalCustomers) : 0;

  return (
    <div className="space-y-5">
      {/* Top Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Unique Guests</span>
          <div className="text-2xl font-black text-slate-900 mt-2">{totalCustomers}</div>
          <span className="text-[11px] text-slate-400">Recorded restaurant customers</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500">Customer Lifetime Spend</span>
          <div className="text-2xl font-black text-emerald-700 mt-2">₹{totalRevenue.toFixed(0)}</div>
          <span className="text-[11px] text-emerald-600 font-semibold">Total settled across patrons</span>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">Average Spend / Customer</span>
          <div className="text-2xl font-black text-slate-900 mt-2">₹{avgSpendPerCustomer}</div>
          <span className="text-[11px] text-slate-400">Average patron spend</span>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center justify-between">
        <h3 className="font-bold text-sm text-slate-900">Registered Customer Directory</h3>
        <div className="relative w-64">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer name or phone..."
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

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone Number</th>
                <th className="py-3 px-4">Total Orders</th>
                <th className="py-3 px-4">Total Spending</th>
                <th className="py-3 px-4">Avg Per Order</th>
                <th className="py-3 px-4">Last Visit</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customer records found yet.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const initial = customer.name.charAt(0).toUpperCase();
                  const avgSpend = customer.ordersCount > 0 ? Math.round(customer.totalSpend / customer.ordersCount) : 0;

                  return (
                    <tr key={customer.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
                            {initial}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 text-sm block">{customer.name}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono text-slate-600">
                        {customer.phone}
                      </td>

                      <td className="py-3 px-4 font-bold text-slate-900">
                        {customer.ordersCount} visit{customer.ordersCount !== 1 ? 's' : ''}
                      </td>

                      <td className="py-3 px-4 font-black text-emerald-700 text-sm">
                        ₹{customer.totalSpend.toFixed(0)}
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-semibold">
                        ₹{avgSpend}
                      </td>

                      <td className="py-3 px-4 text-slate-500">
                        {customer.lastVisit.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedCustomer(customer)}
                          className="px-3 py-1 text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Order History ({customer.ordersCount})
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Order History Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">{selectedCustomer.name}</h3>
                <p className="text-xs text-slate-500">Phone: {selectedCustomer.phone} • Lifetime Orders</p>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
              {selectedCustomer.orders.map((order) => {
                const total = getOrderTotal(order);
                const serial = `#${formatOrderSerial(order)}`;
                const tableText = formatOrderLocation(order);

                return (
                  <div key={order.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm">{serial}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-200 font-bold text-slate-700">{tableText}</span>
                      </div>
                      <span className="font-black text-slate-900 text-sm">₹{total.toFixed(2)}</span>
                    </div>

                    <div className="text-slate-600">
                      {(order.items || []).map((i) => `${i.menu_item?.name || i.name} ×${i.quantity}`).join(', ')}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Status: <strong className="uppercase text-blue-700">{order.status}</strong></span>
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="font-bold text-xs text-slate-700">Total Spend: ₹{selectedCustomer.totalSpend.toFixed(2)}</span>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-100"
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

export default ManagerCustomersView;
