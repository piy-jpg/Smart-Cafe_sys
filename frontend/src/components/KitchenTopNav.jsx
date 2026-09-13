import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../lib/session';

const KitchenTopNav = ({ 
  title = 'Dashboard',
  subtitle,
  socketConnected = true, 
  currentUser,
  muted = false,
  onToggleMute,
  delayedCount = 0,
  onSelectDelayedOrder
}) => {
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your shift and log out?')) {
      clearSession();
      navigate('/');
    }
  };

  const chefName = currentUser?.name || 'Chef';
  const chefInitial = chefName.charAt(0).toUpperCase();

  return (
    <header className="top-nav relative z-30">
      {/* Left: Page Title & Shift Greeting */}
      <div className="top-nav-left">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--color-text)] tracking-tight">{title}</h1>
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Kitchen Display System
            </span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {subtitle || `Station 1 • ${new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`}
          </p>
        </div>
      </div>

      {/* Right: Controls & Profile */}
      <div className="top-nav-right flex items-center gap-3">
        {/* Sound Alert Toggle */}
        <button
          onClick={onToggleMute}
          title={muted ? 'Unmute kitchen alert sound' : 'Mute kitchen alert sound'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            muted
              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
          }`}
        >
          {muted ? (
            <>
              <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
              <span>Sound Muted</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
              <span>Sound On</span>
            </>
          )}
        </button>

        {/* Realtime Connection Status */}
        <div 
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            socketConnected 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{socketConnected ? 'Live Realtime' : 'Reconnecting'}</span>
        </div>

        {/* Shift / Status Pill */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
          <span>Main Shift</span>
        </div>

        {/* Notification Icon */}
        <div className="relative">
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            title="Kitchen alerts & notifications"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {delayedCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {delayedCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-3 px-4 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <span className="font-bold text-sm text-slate-800">Kitchen Alerts</span>
                <span className="text-xs text-slate-500">Realtime</span>
              </div>
              {delayedCount > 0 ? (
                <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-xs text-red-800">
                  <div className="font-bold flex items-center gap-1.5 text-red-700 mb-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                    {delayedCount} Urgent / Overdue Order{delayedCount > 1 ? 's' : ''}
                  </div>
                  <p className="text-slate-600">Orders cooking or pending for more than 15 minutes need immediate attention.</p>
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-slate-400">
                  <svg className="w-8 h-8 text-emerald-500 mx-auto mb-1 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All tickets running on schedule!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kitchen/Chef Profile & Logout */}
        <div className="flex items-center gap-3 pl-3 border-l border-[var(--color-border)]">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-bold text-[var(--color-text)] truncate max-w-[120px]">{chefName}</div>
            <div className="text-xs text-slate-400">Head Chef</div>
          </div>
          <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm ring-2 ring-blue-500/20">
            {chefInitial}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Log out and end shift"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};

export default KitchenTopNav;
