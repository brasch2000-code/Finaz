import React from "react";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  variant?: "emerald" | "rose" | "indigo" | "amber" | "slate";
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "slate",
}: MetricCardProps) {
  const variantStyles = {
    emerald: {
      bg: "bg-emerald-50/70 border-emerald-100/80 text-emerald-900",
      iconBg: "bg-emerald-500/10 text-emerald-600",
      valueColor: "text-emerald-700",
    },
    rose: {
      bg: "bg-rose-50/70 border-rose-100/80 text-rose-900",
      iconBg: "bg-rose-500/10 text-rose-600",
      valueColor: "text-rose-700",
    },
    indigo: {
      bg: "bg-indigo-50/70 border-indigo-100/80 text-indigo-900",
      iconBg: "bg-indigo-500/10 text-indigo-600",
      valueColor: "text-indigo-700",
    },
    amber: {
      bg: "bg-amber-50/70 border-amber-100/80 text-amber-900",
      iconBg: "bg-amber-500/10 text-amber-600",
      valueColor: "text-amber-700",
    },
    slate: {
      bg: "bg-white/80 border-slate-100 text-slate-900",
      iconBg: "bg-slate-100 text-slate-600",
      valueColor: "text-slate-900",
    },
  }[variant];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-5 shadow-xs backdrop-blur-md transition-all hover:shadow-sm ${variantStyles.bg}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {title}
        </span>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${variantStyles.iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-3">
        <div className={`text-2xl font-black tracking-tight ${variantStyles.valueColor}`}>
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
