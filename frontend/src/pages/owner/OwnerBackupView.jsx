import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';

const OwnerBackupView = ({ databaseStatus = {}, ownerControl = {}, onBackupSaved }) => {
  const [downloading, setDownloading] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [notice, setNotice] = useState('');

  const [scheduleForm, setScheduleForm] = useState({
    enabled: ownerControl.controlState?.backupSchedule?.enabled ?? true,
    frequency: ownerControl.controlState?.backupSchedule?.frequency || 'daily',
    time: ownerControl.controlState?.backupSchedule?.time || '02:00',
  });

  const handleDownloadBackup = async () => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/download`;
      link.setAttribute('download', databaseStatus?.file_name || 'smart_cafe.sqlite');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice('Database .sqlite backup download started.');
    } catch (err) {
      console.error(err);
      setNotice('Failed to download database backup.');
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const handleDownloadSqlDump = async () => {
    try {
      setDownloading(true);
      const link = document.createElement('a');
      link.href = `${API_BASE_URL}/api/system/database/sql`;
      link.setAttribute('download', 'smart_cafe_dump.sql');
      document.body.appendChild(link);
      link.click();
      link.remove();
      setNotice('SQL Dump export started.');
    } catch (err) {
      console.error(err);
      setNotice('Failed to export SQL dump.');
    } finally {
      setTimeout(() => setDownloading(false), 1000);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setSavingSchedule(true);
    try {
      await axios.put(`${API_BASE_URL}/api/system/owner-control`, {
        controlState: {
          ...(ownerControl.controlState || {}),
          backupSchedule: scheduleForm,
        },
      });
      onBackupSaved?.();
      setNotice('Automated backup schedule saved successfully.');
    } catch (err) {
      console.error(err);
      setNotice('Failed to save backup schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
          Database Backup &amp; Data Security
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Download point-in-time database snapshots, export SQL dumps, and configure automated cron backup schedules.
        </p>
      </div>

      {notice && (
        <div className="bg-blue-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-bold text-blue-200 hover:text-white">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left: Live Database Snapshot Card (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Production Database File
            </h3>
            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              Verified SQLite
            </span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Database Engine:</span>
              <span className="font-bold text-slate-900">{databaseStatus.engine || 'SQLite 3'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">File Name:</span>
              <span className="font-bold text-slate-900">{databaseStatus.file_name || 'smart_cafe.sqlite'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Storage Size:</span>
              <span className="font-bold text-slate-900">{Math.round((databaseStatus.size_bytes || 0) / 1024)} KB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Last Modified:</span>
              <span className="font-bold text-slate-900">
                {databaseStatus.updated_at ? new Date(databaseStatus.updated_at).toLocaleString() : 'Recent'}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadBackup}
              className="w-full sm:flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Download .sqlite Backup
            </button>
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadSqlDump}
              className="w-full sm:flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors"
            >
              Export SQL Dump
            </button>
          </div>
        </div>

        {/* Right: Automated Backup Schedule (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase">
              Automated Schedule
            </h3>
            <span className="text-xs text-slate-400 font-medium">Cron Snapshot</span>
          </div>

          <form onSubmit={handleSaveSchedule} className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-900">Enable Automated Backups</div>
                <div className="text-[11px] text-slate-500">Run background snapshot automatically</div>
              </div>
              <input
                type="checkbox"
                checked={scheduleForm.enabled}
                onChange={(e) => setScheduleForm({ ...scheduleForm, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Frequency</label>
              <select
                value={scheduleForm.frequency}
                onChange={(e) => setScheduleForm({ ...scheduleForm, frequency: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="hourly">Hourly (During Business Hours)</option>
                <option value="daily">Daily (Nightly Off-Peak)</option>
                <option value="weekly">Weekly (Sunday Midnight)</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Scheduled Time</label>
              <input
                type="time"
                value={scheduleForm.time}
                onChange={(e) => setScheduleForm({ ...scheduleForm, time: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSchedule}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                {savingSchedule ? 'Saving...' : 'Save Backup Schedule'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

export default OwnerBackupView;
