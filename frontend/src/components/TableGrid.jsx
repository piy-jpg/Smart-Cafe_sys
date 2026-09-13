import React from 'react';

const TableGrid = ({
  tables = [],
  selectedTable,
  onSelectTable,
  activeFilter = 'all',
  onFilterChange,
}) => {
  const filterTabs = [
    { id: 'all', label: 'All' },
    { id: 'free', label: 'Free' },
    { id: 'occupied', label: 'Occupied' },
    { id: 'preparing', label: 'Preparing' },
    { id: 'ready', label: 'Ready' },
    { id: 'billing', label: 'Billing' },
  ];

  const getTableComputed = (table) => {
    const order = table.order;
    const isFree = !order || table.status === 'free';

    if (isFree) {
      return {
        stage: 'free',
        badgeText: 'FREE',
        badgeColor: 'text-emerald-700 bg-emerald-100/80 border-emerald-200',
        dotColor: 'bg-emerald-500',
        cardBg: 'bg-white hover:bg-emerald-50/30 border-slate-200 hover:border-emerald-300',
        guestCount: 0,
        amount: 0,
        subtitle: '0 Guests',
        statusLabel: null,
      };
    }

    const amount = Number(order.total || 0);
    const guestCount = Number(order.guest_count || 1);
    const orderStatus = order.status || '';

    if (table.status === 'waiting_bill' || orderStatus === 'waiting_bill') {
      return {
        stage: 'billing',
        badgeText: 'BILLING',
        badgeColor: 'text-rose-700 bg-rose-100/80 border-rose-200',
        dotColor: 'bg-rose-500',
        cardBg: 'bg-rose-50/30 hover:bg-rose-50/60 border-rose-200 hover:border-rose-300',
        guestCount,
        amount,
        subtitle: `${guestCount} Guests`,
        statusLabel: 'Bill Requested',
      };
    }

    if (orderStatus === 'ready') {
      return {
        stage: 'ready',
        badgeText: 'READY',
        badgeColor: 'text-emerald-700 bg-emerald-100/80 border-emerald-200',
        dotColor: 'bg-emerald-500',
        cardBg: 'bg-emerald-50/40 hover:bg-emerald-50/70 border-emerald-300 hover:border-emerald-400',
        guestCount,
        amount,
        subtitle: `${guestCount} Guests`,
        statusLabel: 'Ready to Serve',
      };
    }

    if (orderStatus === 'preparing') {
      return {
        stage: 'preparing',
        badgeText: 'PREPARING',
        badgeColor: 'text-sky-700 bg-sky-100/80 border-sky-200',
        dotColor: 'bg-sky-500',
        cardBg: 'bg-sky-50/30 hover:bg-sky-50/60 border-sky-200 hover:border-sky-300',
        guestCount,
        amount,
        subtitle: `${guestCount} Guests`,
        statusLabel: 'Preparing',
      };
    }

    // Default Occupied / Served
    return {
      stage: 'occupied',
      badgeText: 'OCCUPIED',
      badgeColor: 'text-blue-700 bg-blue-100/80 border-blue-200',
      dotColor: 'bg-blue-500',
      cardBg: 'bg-blue-50/30 hover:bg-blue-50/60 border-blue-200 hover:border-blue-300',
      guestCount,
      amount,
      subtitle: `${guestCount} Guests`,
      statusLabel: orderStatus === 'pending' ? 'Pending' : orderStatus === 'served' ? 'Dining / Served' : 'Active',
    };
  };

  // 30 Tables guaranteed
  const displayTables = tables.length === 30
    ? tables
    : Array.from({ length: 30 }, (_, i) => {
        const tableNumber = i + 1;
        const existing = tables.find((t) => Number(t.number) === tableNumber);
        return existing || { id: tableNumber, number: tableNumber, status: 'free', order: null };
      });

  // Filter tables
  const filteredTables = displayTables.filter((table) => {
    if (!activeFilter || activeFilter === 'all') return true;
    const computed = getTableComputed(table);
    if (activeFilter === 'free') return computed.stage === 'free';
    if (activeFilter === 'occupied') return computed.stage !== 'free';
    if (activeFilter === 'preparing') return computed.stage === 'preparing';
    if (activeFilter === 'ready') return computed.stage === 'ready';
    if (activeFilter === 'billing') return computed.stage === 'billing';
    return true;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
      
      {/* Table Management Header & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Restaurant Floor
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
              30 Tables
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Tap a table to open or manage its order.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 overflow-x-auto scrollbar-none">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onFilterChange?.(tab.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
        {filteredTables.map((table) => {
          const computed = getTableComputed(table);
          const isSelected = String(selectedTable) === String(table.number);

          return (
            <button
              key={table.id || table.number}
              type="button"
              onClick={() => onSelectTable(String(table.number))}
              className={`text-left rounded-xl border p-3 flex flex-col justify-between min-h-[108px] transition-all relative group cursor-pointer ${
                computed.cardBg
              } ${
                isSelected
                  ? 'ring-2 ring-blue-600 border-blue-600 shadow-md bg-blue-50/50 scale-[1.02]'
                  : 'shadow-2xs hover:shadow-xs'
              }`}
            >
              {/* Top Row: Table Name & Status Badge */}
              <div>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-black tracking-tight text-slate-900">
                    TABLE {String(table.number).padStart(2, '0')}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${computed.badgeColor}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${computed.dotColor}`} />
                    {computed.badgeText}
                  </span>
                </div>

                {/* Subtitle: Guest Count */}
                <div className="text-[11px] font-semibold text-slate-500 mt-1">
                  {computed.subtitle}
                </div>
              </div>

              {/* Bottom Row: Amount & Stage Label (or Free) */}
              <div className="mt-2 pt-1.5 border-t border-slate-200/50 flex items-center justify-between gap-1">
                {computed.stage === 'free' ? (
                  <span className="text-[11px] font-medium text-emerald-600">
                    Ready for guests
                  </span>
                ) : (
                  <>
                    <span className="text-xs font-black text-slate-900">
                      ₹{computed.amount.toLocaleString()}
                    </span>
                    <span
                      className={`text-[10px] font-bold truncate max-w-[85px] ${
                        computed.stage === 'ready'
                          ? 'text-emerald-700 font-black'
                          : computed.stage === 'billing'
                            ? 'text-rose-700 font-black'
                            : 'text-slate-600'
                      }`}
                    >
                      {computed.statusLabel}
                    </span>
                  </>
                )}
              </div>

              {/* Electric Blue Selection Border Highlight */}
              {isSelected && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full ring-2 ring-white shadow-xs" />
              )}
            </button>
          );
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="py-12 text-center text-slate-400">
          <p className="text-xs font-semibold">No tables match the "{activeFilter}" filter.</p>
          <button
            onClick={() => onFilterChange?.('all')}
            className="mt-2 text-xs text-blue-600 font-bold hover:underline"
          >
            Show all tables
          </button>
        </div>
      )}

    </div>
  );
};

export default TableGrid;