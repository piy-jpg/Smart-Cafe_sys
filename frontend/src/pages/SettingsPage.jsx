import React, { useState } from 'react';
import { getStoredUser, clearSession } from '../lib/session';
import { useNavigate } from 'react-router-dom';

const SettingsPage = () => {
  const navigate = useNavigate();
  const currentUser = getStoredUser();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Profile state
  const [profileData, setProfileData] = useState({
    name: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
  });

  // Password state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Notification preferences
  const [notifications, setNotifications] = useState({
    orderUpdates: true,
    kitchenAlerts: true,
    paymentReminders: true,
    lowStockAlerts: false,
  });

  // Printer settings
  const [printerSettings, setPrinterSettings] = useState({
    autoPrint: true,
    printKitchen: true,
    printCustomer: false,
    printerName: 'Default Printer',
  });

  // Billing preferences
  const [billingPreferences, setBillingPreferences] = useState({
    autoGenerateBill: false,
    includeTax: true,
    includeServiceCharge: false,
    serviceChargePercent: 10,
  });

  const tabs = [
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' },
    { id: 'printer', label: 'Printer', icon: '🖨️' },
    { id: 'billing', label: 'Billing', icon: '💳' },
    { id: 'security', label: 'Security', icon: '🔒' },
  ];

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      showNotification('Profile updated successfully');
    }, 1000);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showNotification('Passwords do not match', 'error');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showNotification('Password must be at least 6 characters', 'error');
      return;
    }

    setLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showNotification('Password changed successfully');
    }, 1000);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      clearSession();
      navigate('/');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text)]">Settings</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Manage your profile and preferences
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="btn btn-danger"
        >
          Logout
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg shadow-lg ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {notification.message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-2 shadow-sm">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id 
                    ? 'bg-[var(--color-accent)] text-white' 
                    : 'text-[var(--color-text)] hover:bg-slate-50'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-[var(--color-border)] p-6 shadow-sm">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Profile Information</h3>
                <form onSubmit={handleProfileUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Full Name</label>
                    <input
                      type="text"
                      value={profileData.name}
                      onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                      className="input-field"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Email</label>
                    <input
                      type="email"
                      value={profileData.email}
                      onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                      className="input-field"
                      placeholder="Enter your email"
                      disabled
                    />
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Email cannot be changed
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Phone Number</label>
                    <input
                      type="tel"
                      value={profileData.phone}
                      onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                      className="input-field"
                      placeholder="Enter your phone number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Role</label>
                    <input
                      type="text"
                      value={currentUser?.role || 'Waiter'}
                      className="input-field bg-slate-50"
                      disabled
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
                <div className="space-y-4">
                  {Object.entries({
                    orderUpdates: 'Order status updates',
                    kitchenAlerts: 'Kitchen preparation alerts',
                    paymentReminders: 'Payment reminders',
                    lowStockAlerts: 'Low stock alerts',
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-sm text-[var(--color-text-secondary)]">
                          Receive notifications for {label.toLowerCase()}
                        </div>
                      </div>
                      <button
                        onClick={() => setNotifications({...notifications, [key]: !notifications[key]})}
                        className={`relative w-12 h-6 rounded-full transition-colors ${
                          notifications[key] ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          notifications[key] ? 'left-7' : 'left-1'
                        }`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Printer Tab */}
            {activeTab === 'printer' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Printer Settings</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Auto-print orders</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Automatically print orders when sent to kitchen
                      </div>
                    </div>
                    <button
                      onClick={() => setPrinterSettings({...printerSettings, autoPrint: !printerSettings.autoPrint})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        printerSettings.autoPrint ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        printerSettings.autoPrint ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Print to kitchen</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Send kitchen orders to kitchen printer
                      </div>
                    </div>
                    <button
                      onClick={() => setPrinterSettings({...printerSettings, printKitchen: !printerSettings.printKitchen})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        printerSettings.printKitchen ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        printerSettings.printKitchen ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Print customer receipt</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Print receipt for customer after payment
                      </div>
                    </div>
                    <button
                      onClick={() => setPrinterSettings({...printerSettings, printCustomer: !printerSettings.printCustomer})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        printerSettings.printCustomer ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        printerSettings.printCustomer ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Default Printer</label>
                    <select
                      value={printerSettings.printerName}
                      onChange={(e) => setPrinterSettings({...printerSettings, printerName: e.target.value})}
                      className="input-field"
                    >
                      <option value="Default Printer">Default Printer</option>
                      <option value="Kitchen Printer">Kitchen Printer</option>
                      <option value="Bar Printer">Bar Printer</option>
                    </select>
                  </div>
                  <button
                    onClick={() => showNotification('Printer settings saved')}
                    className="btn btn-primary"
                  >
                    Save Printer Settings
                  </button>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Billing Preferences</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Auto-generate bills</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Automatically generate bill when order is served
                      </div>
                    </div>
                    <button
                      onClick={() => setBillingPreferences({...billingPreferences, autoGenerateBill: !billingPreferences.autoGenerateBill})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        billingPreferences.autoGenerateBill ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        billingPreferences.autoGenerateBill ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Include tax in bills</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Show tax breakdown in customer bills
                      </div>
                    </div>
                    <button
                      onClick={() => setBillingPreferences({...billingPreferences, includeTax: !billingPreferences.includeTax})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        billingPreferences.includeTax ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        billingPreferences.includeTax ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium">Include service charge</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        Add service charge to final bill
                      </div>
                    </div>
                    <button
                      onClick={() => setBillingPreferences({...billingPreferences, includeServiceCharge: !billingPreferences.includeServiceCharge})}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        billingPreferences.includeServiceCharge ? 'bg-[var(--color-accent)]' : 'bg-slate-300'
                      }`}
                    >
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                        billingPreferences.includeServiceCharge ? 'left-7' : 'left-1'
                      }`} />
                    </button>
                  </div>
                  {billingPreferences.includeServiceCharge && (
                    <div>
                      <label className="block text-sm font-medium mb-2">Service Charge (%)</label>
                      <input
                        type="number"
                        value={billingPreferences.serviceChargePercent}
                        onChange={(e) => setBillingPreferences({...billingPreferences, serviceChargePercent: parseInt(e.target.value) || 0})}
                        className="input-field"
                        min="0"
                        max="20"
                      />
                    </div>
                  )}
                  <button
                    onClick={() => showNotification('Billing preferences saved')}
                    className="btn btn-primary"
                  >
                    Save Billing Preferences
                  </button>
                </div>
              </div>
            )}

            {/* Security Tab */}
            {activeTab === 'security' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Current Password</label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                      className="input-field"
                      placeholder="Enter current password"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">New Password</label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                      className="input-field"
                      placeholder="Enter new password"
                      required
                    />
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                      Must be at least 6 characters
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                      className="input-field"
                      placeholder="Confirm new password"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary"
                  >
                    {loading ? 'Changing Password...' : 'Change Password'}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-[var(--color-border)]">
                  <h4 className="font-medium mb-3">Danger Zone</h4>
                  <button
                    onClick={handleLogout}
                    className="btn btn-danger w-full"
                  >
                    Logout from All Devices
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;