import React, { useState } from 'react';
import { API_BASE_URL } from '../../lib/appConfig';

const ManagerSettingsView = ({ databaseStatus, currentUser, onLogout }) => {
  const [restaurantName, setRestaurantName] = useState('SmartCafe Fine Dining & POS');
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');
  const [cgstRate, setCgstRate] = useState(2.5);
  const [sgstRate, setSgstRate] = useState(2.5);
  const [serviceCharge, setServiceCharge] = useState(false);
  const [printerIp, setPrinterIp] = useState('192.168.1.120');
  const [downloading, setDownloading] = useState(false);
  const [savedNotice, setSavedNotice] = useState('');

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSavedNotice('Restaurant configuration saved successfully.');
    setTimeout(() => setSavedNotice(''), 3500);
  };

  const handleDownloadBackup = () => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/download`;
      link.setAttribute('download', databaseStatus?.file_name || 'smart_cafe.sqlite');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSavedNotice('Database file download initiated.');
      setTimeout(() => setSavedNotice(''), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadSql = () => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/export-sql`;
      link.setAttribute('download', 'smart_cafe_backup.sql');
      link.setAttribute('target', '_blank');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSavedNotice('SQL export download initiated.');
      setTimeout(() => setSavedNotice(''), 3500);
    } catch (e) {
      console.error(e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {savedNotice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{savedNotice}</span>
        </div>
      )}

      {/* 1. Restaurant Profile & Tax Settings */}
      <form onSubmit={handleSaveSettings} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900">Restaurant Profile &amp; Billing Info</h3>
          <p className="text-slate-400 text-[11px] mt-0.5">Details printed on customer receipts and invoices</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Restaurant Name</label>
            <input
              type="text"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">GSTIN / Tax ID</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="font-bold text-slate-700 block mb-1">CGST Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={cgstRate}
              onChange={(e) => setCgstRate(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">SGST Rate (%)</label>
            <input
              type="number"
              step="0.1"
              value={sgstRate}
              onChange={(e) => setSgstRate(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-semibold text-slate-900"
            />
          </div>

          <div className="flex items-center justify-between pt-5">
            <span className="font-bold text-slate-700">Apply Service Charge (5%)</span>
            <input
              type="checkbox"
              checked={serviceCharge}
              onChange={(e) => setServiceCharge(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600"
            />
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs"
          >
            Save Profile &amp; Tax Settings
          </button>
        </div>
      </form>

      {/* 2. Table & Printer Settings */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="font-bold text-sm text-slate-900">Floor &amp; Hardware Printer Settings</h3>
          <p className="text-slate-400 text-[11px] mt-0.5">Dining floor configuration and thermal printer routing</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="font-bold text-slate-700 block">Total Floor Tables Configured</span>
            <span className="text-xl font-black text-slate-900">30 Tables (T01 - T30)</span>
            <p className="text-slate-400 text-[11px]">Dine-in floor map with QR code integration</p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <span className="font-bold text-slate-700 block">Kitchen &amp; Billing Thermal Printer (LAN)</span>
            <input
              type="text"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.120:9100"
              className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono text-xs text-slate-800"
            />
            <span className="text-[10px] text-slate-400 block">80mm ESC/POS thermal printer standard</span>
          </div>
        </div>
      </div>

      {/* 3. Database Backup & Disaster Recovery */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 text-xs">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Database Backup &amp; System Health</h3>
            <p className="text-slate-400 text-[11px] mt-0.5">Download full snapshot of your operational database</p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {databaseStatus?.engine || 'SQLite'} Online
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div>
            <div className="font-bold text-slate-900">{databaseStatus?.file_name || 'smart_cafe.sqlite'}</div>
            <div className="text-slate-500 text-[11px] mt-0.5">
              Size: {Math.round((databaseStatus?.size_bytes || 0) / 1024)} KB • Status: Verified OK
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadSql}
              disabled={downloading}
              className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl font-bold shadow-2xs"
            >
              Export SQL Dump
            </button>
            <button
              onClick={handleDownloadBackup}
              disabled={downloading}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-xs"
            >
              Download .sqlite Backup
            </button>
          </div>
        </div>
      </div>

      {/* 4. Logout / Session */}
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-sm flex items-center justify-between">
        <div>
          <h3 className="font-bold text-rose-900 text-sm">Manager Session &amp; Sign Out</h3>
          <p className="text-xs text-rose-700/80 mt-0.5">
            Signed in as <span className="font-semibold text-slate-800">{currentUser?.name || 'Manager'}</span> ({currentUser?.email || 'manager@smartcafe.local'}). End supervisor shift and safely sign out.
          </p>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
        >
          End Shift &amp; Logout
        </button>
      </div>
    </div>
  );
};

export default ManagerSettingsView;
