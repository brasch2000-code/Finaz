import React from "react";
import { FinancialAnalyticsService } from "@/application/analytics/financial-service";
import { MetricCard } from "@/components/analytics/MetricCard";
import { CashFlowChart } from "@/components/analytics/CashFlowChart";
import { FrequencyStackedBar } from "@/components/analytics/FrequencyStackedBar";
import { CategoryDonut } from "@/components/analytics/CategoryDonut";
import { ReviewQueue } from "@/components/ReviewQueue";
import { TransactionHistory } from "@/components/TransactionHistory";
import { TransactionForm } from "@/components/TransactionForm";
import { CsvUploadModal } from "@/components/etl/CsvUploadModal";
import {
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Layers,
  History,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const metrics = await FinancialAnalyticsService.getDashboardMetrics();

  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  return (
    <main className="min-h-screen bg-slate-50/50 pb-16">
      {/* Top Navigation / App Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-md shadow-indigo-200">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">Finaz</h1>
              <p className="text-xs font-medium text-slate-500">
                Financial Intelligence & Human-in-the-Loop Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <TransactionForm />
            <CsvUploadModal />
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-7xl px-4 pt-8 md:px-8 space-y-8">
        {/* KPI Grid */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Balance Neto"
            value={formatCLP(metrics.kpi.netBalance)}
            subtitle={`${metrics.kpi.verifiedCount} transacciones auditadas`}
            icon={Wallet}
            variant={metrics.kpi.netBalance >= 0 ? "emerald" : "rose"}
          />
          <MetricCard
            title="Ingresos Totales"
            value={formatCLP(metrics.kpi.totalIncome)}
            subtitle="Flujo positivo verificado"
            icon={ArrowUpRight}
            variant="emerald"
          />
          <MetricCard
            title="Gastos Totales"
            value={formatCLP(metrics.kpi.totalExpense)}
            subtitle="Flujo de egresos consolidado"
            icon={ArrowDownRight}
            variant="rose"
          />
          <MetricCard
            title="Tasa de Ahorro"
            value={`${metrics.kpi.savingsRate}%`}
            subtitle={`Gasto Fijo: ${metrics.kpi.fixedCostRatio}% del egreso`}
            icon={Percent}
            variant={metrics.kpi.savingsRate >= 20 ? "indigo" : "amber"}
          />
        </section>

        {/* Analytics Section: Charts */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Cash Flow Evolution */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-600" />
                  Evolución del Flujo de Caja
                </h2>
                <p className="text-xs text-slate-500">
                  Comparativa mensual de ingresos, gastos y ahorro neto
                </p>
              </div>
            </div>
            <CashFlowChart data={metrics.cashFlowTrend} />
          </div>

          {/* Categorical Distribution */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" />
                  Gasto por Categoría
                </h2>
                <p className="text-xs text-slate-500">
                  Distribución relativa de egresos verificados
                </p>
              </div>
            </div>
            <CategoryDonut data={metrics.categoryDistribution} />
          </div>
        </section>

        {/* Frequency Breakdown & HITL Review Queue */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Frequency Stacked Bar */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-5">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-indigo-600" />
                Estructura por Frecuencia
              </h2>
              <p className="text-xs text-slate-500">
                Fijo (Estructural) vs Recurrente (Operativo) vs Esporádico (Discrecional)
              </p>
            </div>
            <FrequencyStackedBar data={metrics.frequencyStacked} />
          </div>

          {/* HITL Review Queue */}
          <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Cola de Auditoría (HITL)
                </h2>
                <p className="text-xs text-slate-500">
                  Validación humana de transacciones inferidas por OmniRouter
                </p>
              </div>
            </div>
            <ReviewQueue initialPending={metrics.pendingTransactions} />
          </div>
        </section>

        {/* Verified Transactions History */}
        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-xs">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-600" />
                Historial de Transacciones Auditadas
              </h2>
              <p className="text-xs text-slate-500">
                Últimos registros verificados en el libro mayor
              </p>
            </div>
          </div>
          <TransactionHistory transactions={metrics.recentTransactions} />
        </section>
      </div>
    </main>
  );
}
