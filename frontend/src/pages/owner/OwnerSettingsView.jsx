import React, { useState } from 'react';

const QR_APP_URL_KEY = 'smartCafeQrAppUrl';

const OwnerSettingsView = ({ currentUser, onLogout }) => {
  const [restaurantName, setRestaurantName] = useState('SmartCafe Fine Dining & POS');
  const [gstin, setGstin] = useState('07AAAAA0000A1Z5');
  const [cgstRate, setCgstRate] = useState('2.5');
  const [sgstRate, setSgstRate] = useState('2.5');
  const [publicUrl, setPublicUrl] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(QR_APP_URL_KEY) || window.location.origin;
    }
    return '';
  });
  const [notice, setNotice] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    if (typeof window !== 'undefined') {
      localStorage.setItem(QR_APP_URL_KEY, publicUrl.trim());
    }
    setNotice('Executive settings saved successfully.');
    setTimeout(() => setNotice(''), 3500);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
          Executive Settings &amp; Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Restaurant profile, GSTIN credentials, tax rates, and customer QR ordering domain setup.
        </p>
      </div>

      {notice && (
        <div className="bg-emerald-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-bold text-emerald-200 hover:text-white">✕</button>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Restaurant Profile (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase pb-2 border-b border-slate-100">
            Restaurant Profile &amp; GST
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Restaurant Trading Name</label>
              <input
                type="text"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">GSTIN Registration</label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">CGST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cgstRate}
                  onChange={(e) => setCgstRate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">SGST Rate (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={sgstRate}
                  onChange={(e) => setSgstRate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Customer QR App Domain (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase pb-2 border-b border-slate-100">
            Public QR App URL
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Public QR Domain URL</label>
              <input
                type="url"
                value={publicUrl}
                onChange={(e) => setPublicUrl(e.target.value)}
                placeholder="https://order.smartcafe.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Target base URL encoded into Table QR codes for customer mobile ordering.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 text-slate-600 space-y-1">
              <div className="font-bold text-blue-900">Signed In Account:</div>
              <div>Name: <span className="font-semibold text-slate-900">{currentUser?.name || 'Demo Owner'}</span></div>
              <div>Role: <span className="font-semibold text-slate-900">Restaurant Executive / Owner</span></div>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between">
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              Save Configuration
            </button>

            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold transition-colors"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

      </form>
    </div>
  );
};

export default OwnerSettingsView;
