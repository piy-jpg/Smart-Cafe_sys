import React, { useState, useMemo } from 'react';
import { formatOrderSerial } from '../../lib/appConfig';

const TOTAL_TABLES = 30;

const OwnerTablesView = ({ orders = [], onNavigateOrder, onNavigateQr }) => {
  const [filter, setFilter] = useState('all');
  const [selectedTable, setSelectedTable] = useState(null);

  const activeOrders = useMemo(() => {
    return orders.filter(
      (o) => !['completed', 'cancelled'].includes(o.status) && !(o.status === 'waiting_bill' && o.table_cleared)
    );
  }, [orders]);

  const tables = useMemo(() => {
    return Array.from({ length: TOTAL_TABLES }, (_, i) => {
      const tableNumber = i + 1;
      const order = activeOrders.find((o) => Number(o.table_number) === tableNumber);
      let status = 'free';
      if (order) {
        if (order.status === 'waiting_bill') status = 'billing';
        else if (order.status === 'ready') status = 'ready';
        else status = 'occupied';
      }
      return { tableNumber, status, order };
    });
  }, [activeOrders]);

  const filteredTables = useMemo(() => {
    if (filter === 'all') return tables;
    if (filter === 'free') return tables.filter((t) => t.status === 'free');
    if (filter === 'occupied') return tables.filter((t) => t.status === 'occupied' || t.status === 'ready');
    if (filter === 'billing') return tables.filter((t) => t.status === 'billing');
    return tables;
  }, [tables, filter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
            Restaurant Floor Plan &amp; Table Occupancy
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Realtime dining room grid of all 30 tables with live guest bills and table turnaround status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onNavigateQr && (
            <button
              type="button"
              onClick={() => onNavigateQr()}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              Generate Table QRs
            </button>
          )}

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['all', 'free', 'occupied', 'billing'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-2xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 30 Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-3">
        {filteredTables.map((t) => {
          const isSelected = selectedTable?.tableNumber === t.tableNumber;
          return (
            <button
              key={t.tableNumber}
              type="button"
              onClick={() => setSelectedTable(t)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                t.status === 'free'
                  ? 'bg-white border-slate-200 hover:border-emerald-300'
                  : t.status === 'billing'
                    ? 'bg-rose-50/40 border-rose-200 hover:border-rose-300'
                    : 'bg-blue-50/40 border-blue-200 hover:border-blue-300'
              } ${isSelected ? 'ring-2 ring-blue-600 shadow-md scale-[1.02]' : 'shadow-2xs'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900">
                  TABLE {String(t.tableNumber).padStart(2, '0')}
                </span>
                <span
                  className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded border ${
                    t.status === 'free'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : t.status === 'billing'
                        ? 'bg-rose-100 text-rose-800 border-rose-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                  }`}
                >
                  {t.status}
                </span>
              </div>

              <div className="mt-3 pt-2 border-t border-slate-100 text-xs">
                {t.order ? (
                  <div>
                    <div className="font-bold text-slate-800 truncate">
                      #{formatOrderSerial(t.order)}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {t.order.customer_name || 'Walk-in'}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-emerald-600 font-medium">
                    Available
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Table Drawer */}
      {selectedTable && (
        <div className="p-4 bg-white rounded-2xl border border-blue-200 shadow-md flex items-center justify-between animate-in fade-in">
          <div>
            <span className="font-black text-sm text-slate-900">
              Table {selectedTable.tableNumber}:
            </span>{' '}
            <span className="text-xs text-slate-600 ml-1">
              {selectedTable.order
                ? `Active Order #${formatOrderSerial(selectedTable.order)} (${selectedTable.status})`
                : 'Currently vacant and ready for dining guests.'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onNavigateQr && (
              <button
                type="button"
                onClick={() => onNavigateQr(selectedTable.tableNumber)}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                </svg>
                Table QR
              </button>
            )}
            {selectedTable.order && onNavigateOrder && (
              <button
                type="button"
                onClick={() => onNavigateOrder(selectedTable.order)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-2xs"
              >
                Inspect Order →
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedTable(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerTablesView;
