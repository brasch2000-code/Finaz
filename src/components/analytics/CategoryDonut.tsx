"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { CategoryBreakdown } from "@/application/analytics/financial-service";

interface CategoryDonutProps {
  data: CategoryBreakdown[];
}

const emptySubscribe = () => () => {};

export function CategoryDonut({ data }: CategoryDonutProps) {
  const isClient = React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  if (!isClient) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl bg-slate-50/40 text-xs text-slate-400">
        Cargando distribución...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 text-sm text-slate-400">
        No hay gastos categorizados para mostrar.
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-6">
      <div className="h-64 w-full md:w-1/2">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="amount"
              nameKey="categoryName"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={4}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || "#6366f1"} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: unknown, name: unknown) => [formatCLP(Number(value ?? 0)), String(name ?? "")]}
              contentStyle={{
                backgroundColor: "rgba(255, 255, 255, 0.95)",
                borderRadius: "12px",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-full md:w-1/2 space-y-2.5 max-h-64 overflow-y-auto pr-2">
        {data.map((cat, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 truncate">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || "#6366f1" }}
              />
              <span className="font-semibold text-slate-700 truncate">{cat.categoryName}</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-slate-500 font-medium">{cat.percentage}%</span>
              <span className="font-bold text-slate-900">{formatCLP(cat.amount)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
