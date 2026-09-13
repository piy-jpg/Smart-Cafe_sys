import React from 'react';

const OwnerTopNav = ({
  currentUser,
  socketConnected = true,
  lastSyncedAt,
  dateRange = 'today',
  onDateRangeChange,
  onLogout,
}) => {
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const ownerName = currentUser?.name || 'Demo Owner';
  const ownerInitial = ownerName.charAt(0).toUpperCase();

  const dateOptions = [
    { id: 'today', label: 'Today' },
    { id: '7days', label: '7 Days' },
    { id: '30days', label: '30 Days' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' },
  ];

  const formatLastSynced = () => {
    if (!lastSyncedAt) return 'Just now';
    const d = new Date(lastSyncedAt);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      
      {/* Left: Title, Greeting, Subtitle */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
            OWNER DASHBOARD
          </h1>
          <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200">
            Executive Control
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-0.5">
          {getGreeting()}, <span className="font-semibold text-slate-700">{ownerName}</span> • Here's your restaurant performance today.
        </p>
      </div>

      {/* Right: Live Connection, Timestamp, Date Range, Profile */}
      <div className="flex items-center gap-3 sm:gap-4">
        
        {/* Realtime Live Pill & Sync Time */}
        <div className="hidden md:flex flex-col items-end">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black border transition-colors ${
              socketConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>{socketConnected ? '● LIVE' : '● RECONNECTING'}</span>
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5">
            Last synced: {formatLastSynced()}
          </span>
        </div>

        {/* Date Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 overflow-x-auto scrollbar-none">
          {dateOptions.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onDateRangeChange?.(opt.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                dateRange === opt.id
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Owner Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xs shadow-2xs ring-2 ring-blue-500/20">
            {ownerInitial}
          </div>
          <div className="hidden xl:block text-left">
            <div className="text-xs font-bold text-slate-900 truncate max-w-[90px]">{ownerName}</div>
            <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">Owner</div>
          </div>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-0.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}
        </div>

      </div>

    </header>
  );
};

export default OwnerTopNav;
