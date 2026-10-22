import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  subtext?: string;
  accentColor?: string;
}

export function StatCard({
  title,
  value,
  icon,
  change,
  trend = 'neutral',
  subtext,
  accentColor = 'from-emerald-500/20 to-transparent',
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel p-6 transition-all duration-300 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5">
      {/* Background radial highlight */}
      <div
        className={`absolute -right-6 -top-6 h-28 w-28 rounded-full bg-gradient-to-br ${accentColor} blur-2xl`}
      />

      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-3xl font-bold tracking-tight text-white">{value}</p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800/80 text-emerald-400 border border-gray-700/60 shadow-inner">
          {icon}
        </div>
      </div>

      {(change || subtext) && (
        <div className="mt-4 flex items-center gap-2 text-xs">
          {change && (
            <span
              className={`font-semibold ${
                trend === 'up'
                  ? 'text-emerald-400'
                  : trend === 'down'
                  ? 'text-rose-400'
                  : 'text-gray-400'
              }`}
            >
              {change}
            </span>
          )}
          {subtext && <span className="text-gray-400">{subtext}</span>}
        </div>
      )}
    </div>
  );
}
