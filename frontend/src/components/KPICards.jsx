import React from 'react';

const KPICards = ({ metrics }) => {
  const defaultMetrics = [
    { label: 'Open Tables', value: '0', icon: 'table', color: 'blue' },
    { label: 'Pending Orders', value: '0', icon: 'clock', color: 'amber' },
    { label: 'Preparing', value: '0', icon: 'fire', color: 'purple' },
    { label: 'Ready', value: '0', icon: 'check', color: 'green' },
    { label: "Today's Sales", value: '₹0', icon: 'currency', color: 'emerald' },
  ];

  const displayMetrics = metrics || defaultMetrics;

  const getIcon = (iconType) => {
    switch (iconType) {
      case 'table':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case 'clock':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'fire':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
          </svg>
        );
      case 'check':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'currency':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        );
    }
  };

  const getColorClass = (color) => {
    switch (color) {
      case 'blue': return 'bg-blue-100 text-blue-600';
      case 'amber': return 'bg-amber-100 text-amber-600';
      case 'purple': return 'bg-purple-100 text-purple-600';
      case 'green': return 'bg-green-100 text-green-600';
      case 'emerald': return 'bg-emerald-100 text-emerald-600';
      default: return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {displayMetrics.map((metric, index) => (
        <div key={index} className="kpi-card hover-lift group">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="kpi-label">{metric.label}</div>
              <div className="kpi-value group-hover:scale-105 transition-transform">{metric.value}</div>
            </div>
            <div className={`kpi-icon ${getColorClass(metric.color)}`}>
              {getIcon(metric.icon)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default KPICards;