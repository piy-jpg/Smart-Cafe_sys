import React from 'react';
import { Card, CardContent, Typography } from '@mui/material';

const Sidebar = ({ metrics, variant = 'default', title, subtitle, actions = [] }) => {
  if (variant === 'manager') {
    return (
      <aside className="relative w-full xl:sticky xl:top-24 xl:w-[320px] xl:flex-shrink-0 xl:self-start">
        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,252,0.94))] p-5 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-amber-100/70 via-sky-100/50 to-emerald-100/40" />
          <div className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full bg-sky-200/35 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-16 h-24 w-24 rounded-full bg-amber-200/30 blur-2xl" />

          <div className="relative z-10">
            <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
                    {title || 'Manager Console'}
                  </div>
                  <Typography className="mt-2 text-xl font-black text-slate-900">
                    Daily Control Panel
                  </Typography>
                  <Typography className="mt-2 text-sm leading-6 text-slate-500">
                    {subtitle || 'Track revenue, live orders, and table turnover from one arranged sidebar.'}
                  </Typography>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-700 text-sm font-black text-white shadow-lg">
                  M
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between px-1">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Live Metrics</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Realtime
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {metrics.map((metric, index) => (
                <Card
                  key={index}
                  className="group overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <CardContent className="relative px-5 py-5">
                    <div className="absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-slate-900 via-sky-500 to-emerald-500 opacity-80" />
                    <div className="flex items-start justify-between gap-4 pl-3">
                      <div>
                        <Typography className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                          {metric.label}
                        </Typography>
                        <Typography className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                          {metric.value}
                        </Typography>
                        <Typography className="mt-2 text-sm leading-6 text-slate-500">
                          {metric.hint}
                        </Typography>
                      </div>
                      <div className="mt-1 h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 shadow-inner ring-1 ring-slate-100" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  if (variant === 'owner') {
    return (
      <aside className="relative w-full xl:sticky xl:top-24 xl:w-[320px] xl:flex-shrink-0 xl:self-start">
        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.97),rgba(244,247,250,0.95))] shadow-[0_24px_50px_-20px_rgba(15,23,42,0.24)] backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-br from-emerald-100/70 via-cyan-100/45 to-slate-100/40" />
          <div className="relative z-10 p-5">
            <div className="rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
                    {title || 'Owner Console'}
                  </div>
                  <Typography className="mt-2 text-xl font-black text-slate-900">
                    Executive Controls
                  </Typography>
                  <Typography className="mt-2 text-sm leading-6 text-slate-500">
                    {subtitle || 'Keep reports, controls, and menu shortcuts steady while you review the full dashboard.'}
                  </Typography>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-slate-800 text-sm font-black text-white shadow-lg">
                  O
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between px-1">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Owner Metrics</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Stable
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:max-h-[calc(100vh-18rem)] xl:grid-cols-1 xl:overflow-y-auto xl:pr-1">
              {metrics.map((metric, index) => (
                <Card
                  key={index}
                  className="group overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <CardContent className="relative px-5 py-5">
                    <div className="absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-emerald-600 via-cyan-500 to-slate-700 opacity-80" />
                    <div className="pl-3">
                      <Typography className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">
                        {metric.label}
                      </Typography>
                      <Typography variant="h4" className="mt-2 font-black text-slate-900">
                        {metric.value}
                      </Typography>
                      <Typography className="mt-2 text-sm leading-6 text-slate-500">
                        {metric.hint}
                      </Typography>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {actions.length > 0 && (
                <Card className="overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm">
                  <CardContent className="px-5 py-5">
                    <Typography className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                      Quick Access
                    </Typography>
                    <div className="flex flex-col gap-3">
                      {actions.map((action) => (
                        <button
                          key={action.label}
                          type="button"
                          onClick={action.onClick}
                          className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <div className="dashboard-sidebar relative grid w-full grid-cols-1 gap-4 animate-fade-in sm:grid-cols-2 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:w-[320px] xl:flex-shrink-0 xl:grid-cols-1 xl:self-start xl:overflow-y-auto xl:pr-1">
      {metrics.map((metric, index) => (
        <Card
          key={index}
          className="dashboard-panel group cursor-pointer transition-all duration-300 hover:shadow-glow hover:scale-[1.02] animate-slide-up"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="py-6 px-6 relative overflow-hidden">
            {/* Background gradient effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Content */}
            <div className="relative z-10">
              <Typography className="text-xs font-black uppercase tracking-[0.3em] text-slate-500 mb-2 group-hover:text-blue-600 transition-colors duration-300">
                {metric.label}
              </Typography>
              <Typography
                variant="h4"
                className="font-black text-slate-900 mb-1 group-hover:text-gradient transition-all duration-300"
              >
                {metric.value}
              </Typography>
              <Typography className="text-sm text-slate-500 group-hover:text-slate-600 transition-colors duration-300">
                {metric.hint}
              </Typography>
            </div>

            {/* Decorative element */}
            <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
          </CardContent>
        </Card>
      ))}

      {/* Decorative background elements */}
      <div className="absolute -top-4 -right-4 w-24 h-24 rounded-full bg-gradient-to-br from-blue-200/20 to-purple-200/20 blur-xl pointer-events-none" />
      <div className="absolute -bottom-6 -left-6 w-32 h-32 rounded-full bg-gradient-to-tr from-green-200/15 to-blue-200/15 blur-2xl pointer-events-none" />

      {actions.length > 0 && (
        <Card className="dashboard-panel relative overflow-hidden">
          <CardContent className="px-6 py-6">
            <Typography className="mb-3 text-xs font-black uppercase tracking-[0.3em] text-slate-500">
              Quick Access
            </Typography>
            <div className="flex flex-col gap-3">
              {actions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={action.onClick}
                  className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Sidebar;
