import React, { useState } from 'react';

const POSTopNav = ({
  socketConnected = true,
  currentUser,
  notifications = [],
  onNotificationClick,
  onLogout,
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const waiterName = currentUser?.name || 'Waiter';
  const waiterInitial = waiterName.charAt(0).toUpperCase();

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 relative z-40">
      
      {/* Left: Operational Greeting & Context */}
      <div className="flex items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              {getGreeting()}, {waiterName}
            </h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Service Terminal
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
            Manage tables, orders and service.
          </p>
        </div>
      </div>

      {/* Right: Realtime status, Notifications, Shift Badge, Profile, Logout */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        
        {/* Realtime Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
            socketConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          <span className="hidden xs:inline">{socketConnected ? '● Live' : '● Reconnecting'}</span>
        </div>

        {/* Current Shift Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
          <span className="text-[10px] uppercase text-slate-400 font-black">Shift</span>
          <span className="text-emerald-700 font-extrabold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Active
          </span>
        </div>

        {/* Notifications Icon Button */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors relative"
            title="Service notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notifications.length > 0 && (
              <span className="absolute 1 top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white" />
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-3.5 z-50 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">Service Alerts</span>
                <span className="text-[11px] text-slate-400">{notifications.length} alerts</span>
              </div>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    Floor is clear. No active alerts.
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={n.id || i}
                      onClick={() => {
                        onNotificationClick?.(n);
                        setShowNotifications(false);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-bold text-slate-800">{n.title || n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {n.time || 'Just now'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Waiter Profile Avatar & Name */}
        <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center shadow-2xs ring-2 ring-blue-500/20">
            {waiterInitial}
          </div>
          <div className="hidden lg:block text-left">
            <div className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[100px]">
              {waiterName}
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Waiter
            </div>
          </div>
        </div>

        {/* Quick Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors ml-1"
            title="Log Out Shift"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        )}

      </div>
    </header>
  );
};

export default POSTopNav;