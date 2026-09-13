import React from 'react';

const QuickActions = ({ onAction, activeFilter = 'all' }) => {
  const actions = [
    { id: 'new_order', label: '+ New Order', primary: true },
    { id: 'qr_order', label: 'QR Order', icon: 'qr' },
    { id: 'view_kitchen', label: 'View Kitchen', icon: 'kitchen' },
    { id: 'pending_orders', label: 'Pending Orders', icon: 'pending' },
    { id: 'generate_bill', label: 'Generate Bill', icon: 'bill' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.map((act) => {
        const isSelected = activeFilter === act.id;
        if (act.primary) {
          return (
            <button
              key={act.id}
              type="button"
              onClick={() => onAction?.(act.id)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
            >
              <span>{act.label}</span>
            </button>
          );
        }

        return (
          <button
            key={act.id}
            type="button"
            onClick={() => onAction?.(act.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              isSelected
                ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 shadow-2xs'
            }`}
          >
            {act.icon === 'qr' && (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            )}
            {act.icon === 'kitchen' && (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
            )}
            {act.icon === 'pending' && (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {act.icon === 'bill' && (
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            <span>{act.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default QuickActions;