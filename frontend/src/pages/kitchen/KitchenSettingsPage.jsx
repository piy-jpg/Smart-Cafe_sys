import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { clearSession } from '../../lib/session';

const KitchenSettingsPage = ({
  currentUser,
  muted = false,
  onToggleMute,
  onTestSound,
  socketConnected = true,
  onResync,
}) => {
  const navigate = useNavigate();
  const [station, setStation] = useState('Station 1 - Main Line');
  const [autoPrintKot, setAutoPrintKot] = useState(false);
  const [printerStatus, setPrinterStatus] = useState('Connected (Thermal 80mm - LAN 192.168.1.120)');
  const [testPrintNotice, setTestPrintNotice] = useState('');
  const [ticketDensity, setTicketDensity] = useState('standard'); // 'compact' | 'standard' | 'large'
  const [keepAwake, setKeepAwake] = useState(true);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to end your shift and log out?')) {
      clearSession();
      navigate('/');
    }
  };

  const handleTestPrint = () => {
    setPrinterStatus('Connected (Thermal 80mm - LAN 192.168.1.120) • Verified Just Now');
    setTestPrintNotice('Simulated KOT #104 sent to Kitchen Thermal Printer (80mm). Paper feed OK.');
    setTimeout(() => setTestPrintNotice(''), 4000);
  };

  const chefName = currentUser?.name || 'Chef Rajesh';
  const chefEmail = currentUser?.email || 'demo@chef.com';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Top Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Kitchen System & Station Settings</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure chef station, audio bell chimes, hardware printer connections, and display preferences.
        </p>
      </div>

      {testPrintNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{testPrintNotice}</span>
        </div>
      )}

      {/* 1. Chef Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-md">
            {chefName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-slate-900">{chefName}</h3>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                Head Chef
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{chefEmail}</p>
            <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Active Kitchen Shift • Authorized Role: Kitchen / Chef</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Assigned Kitchen Station</label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500"
            >
              <option value="Station 1 - Main Line">Station 1 - Main Line (All Orders)</option>
              <option value="Station 2 - Tandoor & Grill">Station 2 - Tandoor &amp; Grill</option>
              <option value="Station 3 - Fryer & Starters">Station 3 - Fryer &amp; Starters</option>
              <option value="Station 4 - Desserts & Beverages">Station 4 - Desserts &amp; Beverages</option>
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Kitchen Station Role</label>
            <input
              type="text"
              readOnly
              value="Executive Chef / KDS Master Operator"
              className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-600 cursor-not-allowed"
            />
          </div>
        </div>
      </div>

      {/* 2. Sound Alerts & Audio Bell */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Kitchen Audio & Sound Chimes</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rings an audible chime when new tickets arrive or items are added to existing orders.
            </p>
          </div>
          <button
            onClick={onToggleMute}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
              muted
                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            {muted ? 'Sound Muted' : 'Sound Active (On)'}
          </button>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-800">Test Speaker Output</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Play sample 3-tone kitchen arrival bell chime</p>
          </div>
          <button
            onClick={onTestSound}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 transition-colors shadow-2xs"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
            <span>Play Test Chime</span>
          </button>
        </div>
      </div>

      {/* 3. Realtime Connection & Auto-Refresh */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Realtime Connection & Sync</h3>
            <p className="text-xs text-slate-500 mt-0.5">WebSocket engine with automatic fallback polling (5s).</p>
          </div>
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
              socketConnected
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span>{socketConnected ? 'WebSocket Connected' : 'Reconnecting...'}</span>
          </div>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div>
            <span className="font-bold text-slate-800">Force Instant Resync</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Polls latest orders & menu state immediately from server</p>
          </div>
          <button
            onClick={onResync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <svg className="w-3.5 h-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Resync Now</span>
          </button>
        </div>
      </div>

      {/* 4. Kitchen Printer (KOT) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Kitchen Order Ticket (KOT) Printer</h3>
            <p className="text-xs text-slate-500 mt-0.5">Thermal ticket printer for cooking tickets.</p>
          </div>
          <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
            {printerStatus}
          </span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-800">Auto-Print KOT on New Order</span>
              <p className="text-slate-500 text-[11px]">Automatically print paper ticket when order arrives</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoPrintKot}
                onChange={(e) => setAutoPrintKot(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="font-bold text-slate-800">Printer Diagnostics &amp; Feed</span>
              <p className="text-slate-500 text-[11px]">Verify thermal printer communication</p>
            </div>
            <button
              onClick={handleTestPrint}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors shadow-2xs"
            >
              Print Test KOT
            </button>
          </div>
        </div>
      </div>

      {/* 5. Display Preferences */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="font-bold text-slate-900 text-sm mb-4">Display & Terminal Preferences</h3>
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800">Ticket Card Size Density</span>
              <p className="text-slate-500 text-[11px]">Control typography size on the KDS display</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {['compact', 'standard', 'large'].map((d) => (
                <button
                  key={d}
                  onClick={() => setTicketDensity(d)}
                  className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                    ticketDensity === d ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              <span className="font-bold text-slate-800">Prevent Screen Sleep (Wake Lock)</span>
              <p className="text-slate-500 text-[11px]">Keep kitchen display always awake during shift</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={keepAwake}
                onChange={(e) => setKeepAwake(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* 6. Shift End / Logout */}
      <div className="bg-white rounded-2xl border border-red-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-red-900 text-sm">End Shift &amp; Sign Out</h3>
          <p className="text-xs text-red-700/80 mt-0.5">
            Logs out from this chef terminal and safely clears local session.
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider text-white bg-red-600 hover:bg-red-700 active:scale-98 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span>End Shift &amp; Logout</span>
        </button>
      </div>
    </div>
  );
};

export default KitchenSettingsPage;
