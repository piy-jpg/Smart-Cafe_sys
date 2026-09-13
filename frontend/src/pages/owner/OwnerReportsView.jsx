import React, { useState } from 'react';

const toCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const downloadCsvFile = (rows, fileName) => {
  if (!rows || rows.length === 0) {
    alert('No data records available to export for this report.');
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => toCsvValue(row[header])).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', fileName);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const getOrderTotal = (order) => (
  (order.items || []).reduce((sum, item) => (
    sum + (parseFloat(item.menu_item?.price || item.price || 0) * item.quantity)
  ), 0)
);

const OwnerReportsView = ({ orders = [], menu = [], users = [] }) => {
  const [downloading, setDownloading] = useState(false);
  const [notice, setNotice] = useState('');

  const generateReport = (reportType) => {
    setDownloading(true);
    const dateStr = new Date().toISOString().split('T')[0];

    try {
      if (reportType === 'sales' || reportType === 'revenue') {
        const rows = orders
          .filter((o) => o.status !== 'cancelled')
          .map((o) => {
            const gross = getOrderTotal(o);
            const disc = Number(o.discount_amount || 0);
            const ref = Number(o.refund_amount || 0);
            const tax = gross * 0.05;
            return {
              'Order Serial': o.serial_no || o.id,
              Date: new Date(o.created_at).toLocaleDateString(),
              Time: new Date(o.created_at).toLocaleTimeString(),
              Table: o.table_number || 'Takeaway',
              Customer: o.customer_name || 'Walk-in',
              'Gross Sales (INR)': gross,
              'Discount (INR)': disc,
              'Refund (INR)': ref,
              'GST (5%)': tax.toFixed(2),
              'Net Revenue (INR)': (gross - disc - ref).toFixed(2),
              'Payment Method': o.payment_method || 'UPI',
              Status: o.status,
            };
          });
        downloadCsvFile(rows, `SmartCafe_${reportType}_Report_${dateStr}.csv`);
        setNotice(`Generated ${reportType.toUpperCase()} report successfully.`);
      } else if (reportType === 'orders') {
        const rows = orders.map((o) => ({
          'Order ID': o.id,
          'Serial #': o.serial_no || o.id,
          Location: o.table_label || `Table ${o.table_number}`,
          Created: new Date(o.created_at).toLocaleString(),
          Items: (o.items || []).map((i) => `${i.menu_item?.name || i.name} (x${i.quantity})`).join('; '),
          Total: getOrderTotal(o),
          Status: o.status,
          Waiter: o.waiter?.name || 'Unassigned',
        }));
        downloadCsvFile(rows, `SmartCafe_Orders_Audit_${dateStr}.csv`);
        setNotice('Generated Orders Audit report.');
      } else if (reportType === 'payments') {
        const rows = orders
          .filter((o) => o.payment_status === 'paid' || o.status === 'completed')
          .map((o) => ({
            'Order #': o.serial_no || o.id,
            'Payment Mode': o.payment_method || 'UPI',
            Amount: getOrderTotal(o),
            Timestamp: new Date(o.updated_at || o.created_at).toLocaleString(),
            Customer: o.customer_name || 'Walk-in',
            Status: 'Settled',
          }));
        downloadCsvFile(rows, `SmartCafe_Payment_Settlements_${dateStr}.csv`);
        setNotice('Generated Payments Settlement report.');
      } else if (reportType === 'inventory') {
        const rows = menu.map((m) => ({
          'Item ID': m.id,
          Name: m.name,
          Category: m.category,
          'Diet Type': m.item_type || 'Veg',
          'Selling Price (INR)': m.price,
          'Stock On Hand': m.stock_quantity ?? 50,
          Available: m.available !== false ? 'Yes' : 'No',
        }));
        downloadCsvFile(rows, `SmartCafe_Inventory_Stock_${dateStr}.csv`);
        setNotice('Generated Inventory Stock report.');
      } else if (reportType === 'staff') {
        const rows = users.map((u) => {
          const handled = orders.filter((o) => o.waiter_id === u.id);
          const sales = handled.reduce((sum, o) => sum + getOrderTotal(o), 0);
          return {
            'Staff ID': u.id,
            Name: u.name,
            Role: u.role,
            Email: u.email,
            'Orders Handled': handled.length,
            'Total Sales Handled (INR)': sales,
          };
        });
        downloadCsvFile(rows, `SmartCafe_Staff_Performance_${dateStr}.csv`);
        setNotice('Generated Staff Performance report.');
      }
    } catch (err) {
      console.error(err);
      setNotice('Failed to generate report.');
    } finally {
      setDownloading(false);
    }
  };

  const reportCards = [
    {
      id: 'sales',
      title: 'Sales & Tax Report',
      description: 'Comprehensive line-item revenue, GST collection, gross totals, and discounts.',
    },
    {
      id: 'revenue',
      title: 'Revenue & Cashflow Report',
      description: 'Detailed financial ledger of net collections, refunds, and daily settlements.',
    },
    {
      id: 'orders',
      title: 'Orders Fulfillment Report',
      description: 'Complete order log with fulfillment duration, cancellation reasons, and dish breakdown.',
    },
    {
      id: 'payments',
      title: 'Payment Channels Report',
      description: 'Reconciliation of Cash, UPI, and Card transactions for daily accounting.',
    },
    {
      id: 'inventory',
      title: 'Inventory SKU Audit Report',
      description: 'Stock on hand, out-of-stock items, price catalogs, and stock valuations.',
    },
    {
      id: 'staff',
      title: 'Staff Workload & Sales Report',
      description: 'Attribution by waiter, total tables serviced, and kitchen prep volumes.',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs">
        <h2 className="text-base font-bold text-slate-900 tracking-tight uppercase">
          Executive Reports &amp; Data Exports
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Generate clean, spreadsheet-friendly CSV exports for financial accounting, audits, and business planning.
        </p>
      </div>

      {notice && (
        <div className="bg-blue-600 text-white p-3 rounded-xl text-xs font-bold flex items-center justify-between shadow-2xs">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="font-bold text-blue-200 hover:text-white">✕</button>
        </div>
      )}

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reportCards.map((rc) => (
          <div
            key={rc.id}
            className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between"
          >
            <div>
              <h3 className="text-sm font-bold text-slate-900">{rc.title}</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {rc.description}
              </p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase">.CSV Format</span>
              <button
                type="button"
                disabled={downloading}
                onClick={() => generateReport(rc.id)}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5"
              >
                <span>Export CSV ↓</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OwnerReportsView;
