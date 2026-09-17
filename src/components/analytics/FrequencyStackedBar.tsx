"use client";

import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { FrequencyExpenseBreakdown } from "@/application/analytics/financial-service";

interface FrequencyStackedBarProps {
  data: FrequencyExpenseBreakdown[];
}

export function FrequencyStackedBar({ data }: FrequencyStackedBarProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  if (!mounted) {
    return (
      <div className="flex h-80 items-center justify-center rounded-2xl bg-slate-50/40 text-xs text-slate-400">
        Cargando visualización...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-400">
        No hay datos de frecuencia para los gastos registrados.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={{ stroke: "#e2e8f0" }}
          />
          <YAxis
            stroke="#94a3b8"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => {
              const labelMap: Record<string, string> = {
                fijo: "Fijo (Estructural)",
                recurrente: "Recurrente (Vida diaria)",
                esporadico: "Esporádico (Discrecional)",
              };
              const nameStr = String(name ?? "");
              return [formatCLP(Number(value ?? 0)), labelMap[nameStr] || nameStr];
            }}
            contentStyle={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              borderRadius: "12px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
              border: "1px solid #e2e8f0",
              fontSize: "12px",
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            formatter={(val) => {
              const names: Record<string, string> = {
                fijo: "Fijo",
                recurrente: "Recurrente",
                esporadico: "Esporádico",
              };
              return <span className="text-xs font-semibold text-slate-600">{names[val] || val}</span>;
            }}
          />
          <Bar dataKey="fijo" stackId="a" fill="#4f46e5" radius={[0, 0, 0, 0]} maxBarSize={36} />
          <Bar dataKey="recurrente" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} maxBarSize={36} />
          <Bar dataKey="esporadico" stackId="a" fill="#f59e0b" radius={[6, 6, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
