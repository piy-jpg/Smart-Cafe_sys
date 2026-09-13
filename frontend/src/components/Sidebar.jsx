import React from 'react';
import { Card, CardContent, IconButton, Typography } from '@mui/material';
import { NotificationsActive, NotificationsOff } from '@mui/icons-material';

const Sidebar = ({ metrics, variant = 'default', title, subtitle, actions = [], muted, onToggleMute }) => {
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

  if (variant === 'kitchen') {
    return (
      <aside className="relative w-full xl:sticky xl:top-24 xl:w-[320px] xl:flex-shrink-0 xl:self-start">
        <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,252,0.94))] p-5 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
          {/* Decorative blurs */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-orange-100/60 via-amber-100/40 to-red-100/30" />
          <div className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full bg-orange-200/30 blur-2xl" />
          <div className="pointer-events-none absolute -left-8 bottom-16 h-24 w-24 rounded-full bg-amber-200/25 blur-2xl" />

          <div className="relative z-10">
            {/* Header card */}
            <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
                    {title || 'Kitchen Console'}
                  </div>
                  <Typography className="mt-2 text-xl font-black text-slate-900">
                    Kitchen OS
                  </Typography>
                  <Typography className="mt-2 text-sm leading-6 text-slate-500">
                    {subtitle || 'Track live tickets, queue metrics, and kitchen timing at a glance.'}
                  </Typography>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-400 text-sm font-black text-white shadow-lg">
                  K
                </div>
              </div>
            </div>

            {/* Section label + realtime badge */}
            <div className="mt-5 flex items-center justify-between px-1">
              <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Queue Metrics</div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Realtime
              </div>
            </div>

            {/* Metric cards */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
              {metrics.map((metric, index) => (
                <Card
                  key={index}
                  className="group overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <CardContent className="relative px-5 py-5">
                    <div className="absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-orange-500 via-amber-400 to-red-400 opacity-80" />
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

            {/* Sound toggle */}
            {onToggleMute && (
              <Card className="mt-3 overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm">
                <CardContent className="px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {muted ? (
                        <NotificationsOff className="text-slate-400" />
                      ) : (
                        <NotificationsActive className="text-orange-500 animate-pulse" />
                      )}
                      <div>
                        <Typography className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">
                          Kitchen Alerts
                        </Typography>
                        <Typography className="text-sm text-slate-400">
                          {muted ? 'Sound is muted' : 'Sound is on'}
                        </Typography>
                      </div>
                    </div>
                    <IconButton
                      onClick={onToggleMute}
                      className={`rounded-xl ${muted ? 'bg-slate-100' : 'bg-orange-100'}`}
                      size="small"
                    >
                      {muted ? <NotificationsOff fontSize="small" /> : <NotificationsActive fontSize="small" className="text-orange-600" />}
                    </IconButton>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick actions slot */}
            {actions.length > 0 && (
              <Card className="mt-3 overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm">
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
      </aside>
    );
  }

  return (
    <aside className="relative w-full xl:sticky xl:top-24 xl:w-[320px] xl:flex-shrink-0 xl:self-start">
      <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(246,249,252,0.94))] p-5 shadow-[0_24px_50px_-20px_rgba(15,23,42,0.28)] backdrop-blur-xl xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto">
        {/* Decorative blurs */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-br from-indigo-100/60 via-sky-100/40 to-cyan-100/30" />
        <div className="pointer-events-none absolute -right-10 top-8 h-28 w-28 rounded-full bg-indigo-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 bottom-16 h-24 w-24 rounded-full bg-cyan-200/25 blur-2xl" />

        <div className="relative z-10">
          {/* Header card */}
          <div className="rounded-[24px] border border-white/80 bg-white/88 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-black uppercase tracking-[0.34em] text-slate-400">
                  {title || 'Waiter Console'}
                </div>
                <Typography className="mt-2 text-xl font-black text-slate-900">
                  Service Overview
                </Typography>
                <Typography className="mt-2 text-sm leading-6 text-slate-500">
                  {subtitle || 'Track live orders, kitchen status, and your cart at a glance.'}
                </Typography>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-400 text-sm font-black text-white shadow-lg">
                W
              </div>
            </div>
          </div>

          {/* Section label + realtime badge */}
          <div className="mt-5 flex items-center justify-between px-1">
            <div className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400">Live Metrics</div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Realtime
            </div>
          </div>

          {/* Metric cards */}
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            {metrics.map((metric, index) => (
              <Card
                key={index}
                className="group overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <CardContent className="relative px-5 py-5">
                  <div className="absolute inset-y-4 left-0 w-1 rounded-full bg-gradient-to-b from-indigo-600 via-sky-500 to-cyan-400 opacity-80" />
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

          {/* Quick actions slot */}
          {actions.length > 0 && (
            <Card className="mt-3 overflow-hidden rounded-[24px] border border-white/80 bg-white/92 shadow-sm">
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
    </aside>
  );
};

export default Sidebar;
