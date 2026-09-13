import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL, formatOrderSerial } from '../../lib/appConfig';

const TOTAL_TABLES = 30;

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const ManagerTablesView = ({
  orders = [],
  staff = [],
  onOpenNewOrder,
  onOrderUpdated,
  onNavigateToBilling
}) => {
  const [filter, setFilter] = useState('all'); // 'all' | 'free' | 'occupied' | 'billing' | 'ready'
  const [selectedTableNum, setSelectedTableNum] = useState(null);
  const [transferWaiterId, setTransferWaiterId] = useState('');
  const [transferring, setTransferring] = useState(false);

  const activeOrders = useMemo(() => {
    return orders.filter((o) => !['completed', 'cancelled'].includes(o.status) && !(o.status === 'waiting_bill' && o.table_cleared));
  }, [orders]);

  // Map of tableNumber -> activeOrder
  const tableOrderMap = useMemo(() => {
    const map = new Map();
    activeOrders.forEach((o) => {
      const num = Number(o.table_number);
      if (Number.isInteger(num) && num > 0 && num <= TOTAL_TABLES) {
        map.set(num, o);
      }
    });
    return map;
  }, [activeOrders]);

  const tableList = useMemo(() => {
    return Array.from({ length: TOTAL_TABLES }, (_, index) => {
      const tableNumber = index + 1;
      const order = tableOrderMap.get(tableNumber) || null;

      let status = 'free';
      if (order) {
        if (order.status === 'waiting_bill') status = 'billing';
        else if (order.status === 'ready') status = 'ready';
        else status = 'occupied';
      }

      return {
        tableNumber,
        order,
        status,
      };
    });
  }, [tableOrderMap]);

  const filteredTables = useMemo(() => {
    if (filter === 'all') return tableList;
    return tableList.filter((t) => t.status === filter);
  }, [tableList, filter]);

  const counts = {
    all: TOTAL_TABLES,
    free: tableList.filter((t) => t.status === 'free').length,
    occupied: tableList.filter((t) => t.status === 'occupied').length,
    billing: tableList.filter((t) => t.status === 'billing').length,
    ready: tableList.filter((t) => t.status === 'ready').length,
  };

  const selectedTableData = selectedTableNum ? tableList.find((t) => t.tableNumber === selectedTableNum) : null;

  const handleClearTable = async (orderId) => {
    if (!window.confirm('Clear this table and mark it available?')) return;
    try {
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/table-clear`, { table_cleared: true });
      onOrderUpdated?.();
      setSelectedTableNum(null);
    } catch (err) {
      console.error('Failed to clear table:', err);
      alert('Failed to clear table.');
    }
  };

  const handleTransferWaiter = async (orderId) => {
    if (!transferWaiterId) return;
    try {
      setTransferring(true);
      await axios.put(`${API_BASE_URL}/api/orders/${orderId}/owner-controls`, {
        waiter_id: transferWaiterId
      });
      onOrderUpdated?.();
      alert('Waiter assigned/transferred successfully.');
      setTransferWaiterId('');
    } catch (err) {
      console.error('Failed to transfer waiter:', err);
      alert('Failed to reassign waiter.');
    } finally {
      setTransferring(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'all', label: 'All Tables', count: counts.all, color: 'bg-slate-900 text-white' },
            { id: 'free', label: 'Available / Free', count: counts.free, color: 'bg-emerald-600 text-white' },
            { id: 'occupied', label: 'Occupied', count: counts.occupied, color: 'bg-blue-600 text-white' },
            { id: 'billing', label: 'Waiting Bill', count: counts.billing, color: 'bg-purple-600 text-white' },
            { id: 'ready', label: 'Food Ready', count: counts.ready, color: 'bg-amber-600 text-white' },
          ].map((f) => {
            const isActive = filter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? `${f.color} shadow-xs`
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
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

        <button
          onClick={() => onOpenNewOrder?.()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs whitespace-nowrap"
        >
          <span>+</span> Open New Table Order
        </button>
      </div>

      {/* 30-Table Visual Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {filteredTables.map((t) => {
          const isSelected = selectedTableNum === t.tableNumber;
          const order = t.order;
          const total = order ? getOrderTotal(order) : 0;

          let badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          let borderTone = 'border-slate-200 hover:border-emerald-400 bg-white';

          if (t.status === 'billing') {
            badgeColor = 'bg-purple-100 text-purple-800 border-purple-300';
            borderTone = 'border-purple-300 bg-purple-50/20';
          } else if (t.status === 'ready') {
            badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
            borderTone = 'border-amber-300 bg-amber-50/20';
          } else if (t.status === 'occupied') {
            badgeColor = 'bg-blue-100 text-blue-800 border-blue-300';
            borderTone = 'border-blue-300 bg-blue-50/20';
          }

          return (
            <div
              key={t.tableNumber}
              onClick={() => setSelectedTableNum(t.tableNumber)}
              className={`rounded-2xl border-2 p-4 cursor-pointer transition-all shadow-2xs hover:shadow-md flex flex-col justify-between min-h-[140px] ${borderTone} ${
                isSelected ? 'ring-2 ring-blue-500 scale-102' : ''
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-black text-slate-900">
                    T{String(t.tableNumber).padStart(2, '0')}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${badgeColor}`}>
                    {t.status}
                  </span>
                </div>

                {order ? (
                  <div className="mt-2 text-xs space-y-0.5">
                    <div className="font-bold text-slate-800 truncate">
                      #{formatOrderSerial(order)} • {order.customer_name || 'Walk-in'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      W: {order.waiter?.name || 'Unassigned'}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 text-xs text-slate-400 font-medium">
                    Ready for guests
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between mt-3 text-xs">
                {order ? (
                  <>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">Total</span>
                    <span className="font-black text-slate-900">₹{total.toFixed(0)}</span>
                  </>
                ) : (
                  <span className="text-[10px] text-emerald-600 font-bold uppercase">Free Table</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Table Inspector Drawer / Panel */}
      {selectedTableData && (
        <div className="bg-white rounded-2xl border border-blue-200 p-5 shadow-sm space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-slate-900 text-white font-black text-base flex items-center justify-center">
                T{String(selectedTableData.tableNumber).padStart(2, '0')}
              </span>
              <div>
                <h4 className="font-bold text-slate-900 text-base">
                  Table {String(selectedTableData.tableNumber).padStart(2, '0')} Inspector
                </h4>
                <span className="text-xs text-slate-400">
                  Status: <strong className="uppercase text-slate-700">{selectedTableData.status}</strong>
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedTableNum(null)}
              className="px-3 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-100 rounded-lg"
            >
              Close Inspector
            </button>
          </div>

          {selectedTableData.order ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Order Info */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Order Information</span>
                <div className="text-sm font-black text-slate-900">
                  Order #{formatOrderSerial(selectedTableData.order)}
                </div>
                <div className="text-slate-600">Customer: {selectedTableData.order.customer_name || 'Walk-in'}</div>
                <div className="text-slate-600">Assigned Waiter: {selectedTableData.order.waiter?.name || 'Unassigned'}</div>
                <div className="text-slate-400 text-[11px]">
                  Placed at: {new Date(selectedTableData.order.created_at).toLocaleTimeString()}
                </div>
              </div>

              {/* Items */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Dishes in Order</span>
                <div className="space-y-1 max-h-24 overflow-y-auto">
                  {(selectedTableData.order.items || []).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between">
                      <span className="font-semibold text-slate-800">{item.menu_item?.name || item.name}</span>
                      <span className="font-bold">×{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions & Transfer Waiter */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <span className="text-[10px] font-bold uppercase text-slate-400 block">Manager Actions</span>
                <div className="flex items-center gap-1.5">
                  <select
                    value={transferWaiterId}
                    onChange={(e) => setTransferWaiterId(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg p-1.5 text-xs font-semibold"
                  >
                    <option value="">Transfer Waiter...</option>
                    {staff
                      .filter((s) => s.role === 'waiter' || s.role === 'staff')
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={() => handleTransferWaiter(selectedTableData.order.id)}
                    disabled={!transferWaiterId || transferring}
                    className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    {transferring ? '...' : 'Assign'}
                  </button>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => handleClearTable(selectedTableData.order.id)}
                    className="px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
                  >
                    Clear Table
                  </button>
                  <button
                    onClick={() => onNavigateToBilling?.(selectedTableData.order.id)}
                    className={`px-3 py-1.5 text-xs font-bold text-white rounded-lg ${
                      selectedTableData.status === 'billing' ? 'bg-purple-700 hover:bg-purple-800 font-black shadow-2xs' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {selectedTableData.status === 'billing' ? 'Review & Settle Bill' : 'Billing Desk →'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl border border-emerald-200">
              <span className="text-xs font-bold text-emerald-900">
                Table {selectedTableData.tableNumber} is empty and clean.
              </span>
              <button
                onClick={() => onOpenNewOrder?.(selectedTableData.tableNumber)}
                className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-slate-800"
              >
                + Place Order on Table {selectedTableData.tableNumber}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ManagerTablesView;
