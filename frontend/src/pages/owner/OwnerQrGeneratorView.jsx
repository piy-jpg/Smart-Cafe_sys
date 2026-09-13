import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../lib/appConfig';

const QR_APP_URL_KEY = 'smartCafeQrAppUrl';
const DEFAULT_RESTAURANT_CODE = 'smartcafe_main';

const OwnerQrGeneratorView = ({ initialTable = null }) => {
  // Form State
  const [mode, setMode] = useState(initialTable ? 'single' : 'all'); // 'all', 'single', 'range'
  const [tableCount, setTableCount] = useState(30);
  const [singleTable, setSingleTable] = useState(initialTable || 1);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(30);
  const [restaurantCode, setRestaurantCode] = useState(DEFAULT_RESTAURANT_CODE);
  const [resolution, setResolution] = useState(320); // 280, 320, 420
  const [saveAsDefaultUrl, setSaveAsDefaultUrl] = useState(true);

  const [appUrl, setAppUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(QR_APP_URL_KEY) || window.location.origin;
    }
    return '';
  });

  // Data & Execution State
  const [qrList, setQrList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [successNotice, setSuccessNotice] = useState('');

  // Generate QR codes
  const generateQrCodes = useCallback(async () => {
    setLoading(true);
    setError('');
    setSuccessNotice('');

    try {
      const trimmedUrl = appUrl.trim();
      if (saveAsDefaultUrl && typeof window !== 'undefined' && trimmedUrl) {
        localStorage.setItem(QR_APP_URL_KEY, trimmedUrl);
      }

      let params = {
        restaurant: restaurantCode.trim() || DEFAULT_RESTAURANT_CODE,
        appUrl: trimmedUrl,
        size: resolution,
      };

      if (mode === 'single') {
        params.table = Number(singleTable);
      } else if (mode === 'range') {
        const start = Math.max(1, Number(rangeStart));
        const end = Math.max(start, Number(rangeEnd));
        params.start = start;
        params.tables = end - start + 1;
      } else {
        // all tables
        params.start = 1;
        params.tables = Number(tableCount);
      }

      const response = await axios.get(`${API_BASE_URL}/api/public/qr-tables`, { params });
      if (response.data?.success && Array.isArray(response.data.tables)) {
        setQrList(response.data.tables);
        setSuccessNotice(`Successfully generated ${response.data.tables.length} table QR code(s).`);
      } else {
        throw new Error(response.data?.message || 'Failed to generate QR codes.');
      }
    } catch (err) {
      console.error('QR Generation error:', err);
      setError(err.response?.data?.message || err.message || 'Error generating QR codes. Check backend connection.');
    } finally {
      setLoading(false);
    }
  }, [appUrl, mode, rangeEnd, rangeStart, resolution, restaurantCode, saveAsDefaultUrl, singleTable, tableCount]);

  // Initial load
  useEffect(() => {
    generateQrCodes();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Copy single link
  const handleCopyLink = (url, index) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(url);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2500);
    }
  };

  // Copy all links
  const handleCopyAllLinks = () => {
    if (!qrList.length || !navigator?.clipboard) return;
    const text = qrList
      .map((item) => `Table ${String(item.table_number).padStart(2, '0')}: ${item.qr_url}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setSuccessNotice('All Table QR URLs copied to clipboard!');
    setTimeout(() => setSuccessNotice(''), 3000);
  };

  // Download single image
  const handleDownloadSingle = (item) => {
    const link = document.createElement('a');
    link.href = item.qr_image;
    link.download = `SmartCafe_Table_${String(item.table_number).padStart(2, '0')}_QR.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Batch download
  const handleDownloadAll = () => {
    if (!qrList.length) return;
    qrList.forEach((item, idx) => {
      setTimeout(() => {
        handleDownloadSingle(item);
      }, idx * 180);
    });
    setSuccessNotice(`Downloading ${qrList.length} QR image files...`);
    setTimeout(() => setSuccessNotice(''), 3500);
  };

  // Print all standees
  const handlePrintAll = () => {
    window.print();
  };

  // Filtered list for display
  const filteredList = qrList.filter((item) => {
    if (!searchFilter) return true;
    const query = searchFilter.toLowerCase().trim();
    return (
      String(item.table_number).includes(query) ||
      `table ${item.table_number}`.includes(query) ||
      `table ${String(item.table_number).padStart(2, '0')}`.includes(query)
    );
  });

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
            <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
              Table QR Code Generator &amp; Standee Station
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Generate digital ordering QR codes for dine-in tables. Guests scan with their phone camera to browse the menu and order directly to the kitchen.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
            <span className="text-slate-500">Active Tables:</span>{' '}
            <strong className="text-slate-900">{qrList.length}</strong>
          </div>
          <div className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-xl border border-blue-200 font-bold">
            Restaurant: {restaurantCode}
          </div>
        </div>
      </div>

      {/* Alert / Notice */}
      {successNotice && (
        <div className="bg-emerald-600 text-white p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in print:hidden">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{successNotice}</span>
          </div>
          <button type="button" onClick={() => setSuccessNotice('')} className="text-emerald-200 hover:text-white">✕</button>
        </div>
      )}

      {error && (
        <div className="bg-rose-600 text-white p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs animate-in fade-in print:hidden">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
          <button type="button" onClick={() => setError('')} className="text-rose-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Configuration Form Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-5 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            QR Code Generation Parameters
          </h3>

          {/* Mode Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setMode('all')}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                mode === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Tables (1 to 30)
            </button>
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                mode === 'single'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Single Table
            </button>
            <button
              type="button"
              onClick={() => setMode('range')}
              className={`px-3 py-1 rounded-lg font-bold capitalize transition-all ${
                mode === 'range'
                  ? 'bg-white text-slate-900 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Custom Range
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 text-xs">
          {/* Public App Base Domain (6 cols) */}
          <div className="md:col-span-6 space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700">Public Ordering Domain / Base URL</label>
              <button
                type="button"
                onClick={() => setAppUrl(window.location.origin)}
                className="text-[10px] text-blue-600 hover:underline font-semibold"
              >
                Use Current Origin ({typeof window !== 'undefined' ? window.location.origin : ''})
              </button>
            </div>
            <input
              type="url"
              value={appUrl}
              onChange={(e) => setAppUrl(e.target.value)}
              placeholder="http://localhost:6003 or https://order.smartcafe.com"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
            <div className="flex items-center gap-1.5 pt-0.5">
              <input
                type="checkbox"
                id="saveDefaultUrl"
                checked={saveAsDefaultUrl}
                onChange={(e) => setSaveAsDefaultUrl(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
              />
              <label htmlFor="saveDefaultUrl" className="text-[11px] text-slate-500 cursor-pointer select-none">
                Save as default public ordering domain
              </label>
            </div>
          </div>

          {/* Restaurant Code (3 cols) */}
          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-slate-700">Restaurant Code</label>
            <input
              type="text"
              value={restaurantCode}
              onChange={(e) => setRestaurantCode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[10px] text-slate-400">Default branch: smartcafe_main</p>
          </div>

          {/* Resolution / Print Size (3 cols) */}
          <div className="md:col-span-3 space-y-1">
            <label className="font-bold text-slate-700">QR Resolution / Print Quality</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none"
            >
              <option value={280}>Standard (280px - Mobile / Stickers)</option>
              <option value={360}>Medium (360px - Table Tent Cards)</option>
              <option value={450}>High-Res (450px - Large Acrylic Stands)</option>
            </select>
            <p className="text-[10px] text-slate-400">Higher resolution is best for physical printing</p>
          </div>

          {/* Mode-specific Fields */}
          {mode === 'all' && (
            <div className="md:col-span-12 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-600">Total Dine-in Tables:</span>
                <div className="flex items-center gap-1.5">
                  {[10, 15, 20, 25, 30].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setTableCount(count)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${
                        tableCount === count
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {count} Tables
                    </button>
                  ))}
                </div>
              </div>

              <div className="text-[11px] text-slate-400 font-medium">
                Generating Table 01 through Table {String(tableCount).padStart(2, '0')}
              </div>
            </div>
          )}

          {mode === 'single' && (
            <div className="md:col-span-12 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">Select Specific Table:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={singleTable}
                  onChange={(e) => setSingleTable(Math.max(1, Number(e.target.value)))}
                  className="w-24 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 30].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSingleTable(t)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-bold border ${
                      singleTable === t
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'range' && (
            <div className="md:col-span-12 pt-2 border-t border-slate-100 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">From Table:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="font-bold text-slate-700">To Table:</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900"
                />
              </div>

              <span className="text-[11px] text-slate-400">
                (Total {Math.max(0, rangeEnd - rangeStart + 1)} QR cards)
              </span>
            </div>
          )}
        </div>

        {/* Form Action Row */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Encoded URL Preview:{' '}
            <code className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-blue-700 font-mono">
              {appUrl.replace(/\/+$/, '')}/order?res={restaurantCode}&amp;table={mode === 'single' ? singleTable : 1}
            </code>
          </div>

          <button
            type="button"
            onClick={generateQrCodes}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Generating QR Codes...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Generate QR Codes</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Batch Actions & Search Toolbar */}
      {qrList.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase text-slate-800 tracking-wider">
              {qrList.length} QR Code{qrList.length > 1 ? 's' : ''} Ready
            </span>

            {/* Quick Table Search */}
            <div className="relative">
              <input
                type="text"
                placeholder="Find table #..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 w-32 focus:w-44 transition-all focus:bg-white focus:outline-none"
              />
              {searchFilter && (
                <button
                  type="button"
                  onClick={() => setSearchFilter('')}
                  className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintAll}
              className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print All Standees
            </button>

            <button
              type="button"
              onClick={handleDownloadAll}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download All PNGs
            </button>

            <button
              type="button"
              onClick={handleCopyAllLinks}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy All Links
            </button>
          </div>
        </div>
      )}

      {/* QR Code Standees Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 print:grid-cols-2 print:gap-6">
        {filteredList.map((item, index) => {
          const isCopied = copiedIndex === index;
          const tableLabel = `TABLE ${String(item.table_number).padStart(2, '0')}`;

          return (
            <div
              key={item.table_number}
              className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col justify-between hover:shadow-md hover:border-blue-300 transition-all text-center relative overflow-hidden group print:border-2 print:border-slate-800 print:shadow-none print:break-inside-avoid"
            >
              {/* Standee Header Banner */}
              <div className="bg-[#0f172a] -mx-4 -mt-4 p-3 text-white mb-3">
                <div className="text-[10px] uppercase font-black tracking-widest text-blue-400">
                  SmartCafe Dining
                </div>
                <div className="text-sm font-black tracking-tight text-white mt-0.5">
                  {tableLabel}
                </div>
              </div>

              {/* QR Image Frame */}
              <div className="py-2 flex flex-col items-center">
                <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-2xs inline-block">
                  <img
                    src={item.qr_image}
                    alt={`${tableLabel} QR Code`}
                    className="w-36 h-36 object-contain rounded-lg"
                  />
                </div>
                <div className="text-[11px] font-bold text-slate-800 mt-2">
                  Scan to View Menu &amp; Order
                </div>
                <div className="text-[10px] text-slate-400">
                  No app download needed
                </div>
              </div>

              {/* URL Display */}
              <div className="mt-2 py-1.5 px-2 bg-slate-50 rounded-lg border border-slate-100 text-[10px] text-slate-500 font-mono truncate text-left print:hidden">
                {item.qr_url}
              </div>

              {/* Printable Table Note */}
              <div className="hidden print:block text-[9px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                Place camera over QR code • Connect to Guest Wi-Fi
              </div>

              {/* Card Actions (Hidden on Print) */}
              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-1 print:hidden">
                <button
                  type="button"
                  onClick={() => handleDownloadSingle(item)}
                  title="Download High-Res PNG"
                  className="px-2 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyLink(item.qr_url, index)}
                  title="Copy Direct Link"
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 ${
                    isCopied
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCopied ? '✓ Copied' : 'Copy'}
                </button>

                <a
                  href={item.qr_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Test Live Order Flow"
                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Test
                </a>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {!loading && qrList.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 print:hidden">
          <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-slate-800">No QR Codes Generated Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Use the form above to generate digital ordering QR codes for your restaurant tables.
          </p>
          <button
            type="button"
            onClick={generateQrCodes}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-blue-700"
          >
            Generate Now
          </button>
        </div>
      )}

    </div>
  );
};

export default OwnerQrGeneratorView;
