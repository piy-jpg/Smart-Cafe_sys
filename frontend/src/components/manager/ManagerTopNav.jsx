import React, { useState } from 'react';

const ManagerTopNav = ({
  title = 'Dashboard',
  subtitle = 'Monitor your restaurant performance in real time.',
  searchQuery = '',
  onSearchChange,
  socketConnected = true,
  currentUser,
  notificationCount = 0,
  notifications = [],
  onNotificationClick,
  onLogout
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const managerName = currentUser?.name || 'Manager';
  const managerInitial = managerName.charAt(0).toUpperCase();

  return (
    <header className="top-nav relative z-30">
      {/* Left: Page Title & Contextual Description */}
      <div className="top-nav-left flex items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight">{title}</h1>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
              Operations Center
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 line-clamp-1">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Center/Right: Search, Realtime Status, Notifications, Profile, Role Badge */}
      <div className="top-nav-right flex items-center gap-3">
        {/* Global Search */}
        <div className="relative hidden md:block w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="Search orders, tables, items..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
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

        {/* Realtime Status Indicator */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
            socketConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{socketConnected ? '● Live' : '● Reconnecting'}</span>
        </div>

        {/* Notifications Icon & Drawer */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition-colors"
            title="Restaurant alerts & notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">Live System Feed</span>
                <span className="text-[11px] text-slate-400">{notifications.length} updates</span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    No active alerts. Restaurant running smoothly.
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={n.id || i}
                      onClick={() => {
                        onNotificationClick?.(n);
                        setShowNotifications(false);
                      }}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors cursor-pointer text-xs"
                    >
                      <div className="font-medium text-slate-800">{n.message}</div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        {n.timestamp ? new Date(n.timestamp).toLocaleTimeString() : 'Just now'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Manager Profile */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-slate-900 truncate max-w-[120px]">{managerName}</div>
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Manager</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white font-bold text-xs shadow-xs ring-2 ring-blue-500/20">
            {managerInitial}
          </div>

          {/* Role Badge: MANAGER */}
          <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-slate-900 text-white shadow-xs">
            MANAGER
          </span>

          {/* Quick Sign Out */}
          {onLogout && (
            <button
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

export default ManagerTopNav;
