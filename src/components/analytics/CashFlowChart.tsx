"use client";

import React from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { MonthlyCashFlowSummary } from "@/application/analytics/financial-service";

interface CashFlowChartProps {
  data: MonthlyCashFlowSummary[];
}

export function CashFlowChart({ data }: CashFlowChartProps) {
  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-400">
        No hay suficientes transacciones verificadas para graficar el flujo de caja temporal.
      </div>
    );
  }

  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
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
                income: "Ingresos",
                expense: "Gastos",
                netSavings: "Ahorro Neto",
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
                income: "Ingresos",
                expense: "Gastos",
                netSavings: "Ahorro Neto",
              };
              return <span className="text-xs font-semibold text-slate-600">{names[val] || val}</span>;
            }}
          />
          <Bar dataKey="income" fill="#10b981" radius={[6, 6, 0, 0]} maxBarSize={32} />
          <Bar dataKey="expense" fill="#f43f5e" radius={[6, 6, 0, 0]} maxBarSize={32} />
          <Line
            type="monotone"
            dataKey="netSavings"
            stroke="#6366f1"
            strokeWidth={3}
            dot={{ r: 4, fill: "#6366f1" }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
