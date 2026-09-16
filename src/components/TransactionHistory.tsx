"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Tag,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type TransactionItem = {
  id: string;
  amount: number;
  description?: string;
  merchant?: string;
  date: string;
  flowType?: string | null;
  type?: string | null;
  categoryName?: string | null;
  group?: string | null;
  frequency?: string | null;
  color?: string | null;
};

export function TransactionHistory({
  transactions,
}: {
  transactions: TransactionItem[];
}) {
  const [search, setSearch] = useState("");
  const [flowFilter, setFlowFilter] = useState<"ALL" | "INCOME" | "EXPENSE">("ALL");
  const [frequencyFilter, setFrequencyFilter] = useState<string>("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  // Filtered transactions
  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const isIncome =
        tx.flowType === "INCOME" ||
        tx.type === "INGRESO" ||
        tx.flowType === "INGRESO";

      if (flowFilter === "INCOME" && !isIncome) return false;
      if (flowFilter === "EXPENSE" && isIncome) return false;

      if (
        frequencyFilter !== "ALL" &&
        tx.frequency?.toUpperCase() !== frequencyFilter.toUpperCase()
      ) {
        return false;
      }

      if (search.trim() !== "") {
        const term = search.toLowerCase();
        const desc = (tx.description || tx.merchant || "").toLowerCase();
        const cat = (tx.categoryName || tx.group || "").toLowerCase();
        return desc.includes(term) || cat.includes(term);
      }

      return true;
    });
  }, [transactions, flowFilter, frequencyFilter, search]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const paginatedItems = filtered.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleExportCsv = () => {
    if (filtered.length === 0) return;

    const headers = ["Fecha", "Descripcion", "Flujo", "Monto", "Frecuencia", "Categoria"];
    const rows = filtered.map((tx) => {
      const isIncome =
        tx.flowType === "INCOME" ||
        tx.type === "INGRESO" ||
        tx.flowType === "INGRESO";
      const desc = `"${(tx.description || tx.merchant || "").replace(/"/g, '""')}"`;
      const flow = isIncome ? "INGRESO" : "GASTO";
      const cat = `"${(tx.categoryName || tx.group || "Sin Categoría").replace(/"/g, '""')}"`;
      const freq = tx.frequency || "ESPORADICO";

      return [tx.date, desc, flow, Math.abs(tx.amount), freq, cat].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Finaz_Export_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-slate-400">
        <p className="font-medium">No hay transacciones auditadas registradas.</p>
        <p className="text-sm mt-1">Importa un CSV o añade transacciones manualmente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-slate-100">
        {/* Search Input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por comercio o categoría..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-9 bg-white border-slate-200 rounded-xl h-9 text-xs"
          />
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Flow Type Filter */}
          <div className="flex bg-white p-0.5 rounded-xl border border-slate-200/80 text-xs font-semibold">
            <button
              onClick={() => {
                setFlowFilter("ALL");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                flowFilter === "ALL"
                  ? "bg-slate-900 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFlowFilter("INCOME");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                flowFilter === "INCOME"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-emerald-700"
              }`}
            >
              Ingresos
            </button>
            <button
              onClick={() => {
                setFlowFilter("EXPENSE");
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                flowFilter === "EXPENSE"
                  ? "bg-rose-600 text-white shadow-xs font-bold"
                  : "text-slate-600 hover:text-rose-700"
              }`}
            >
              Gastos
            </button>
          </div>

          {/* Frequency Dropdown */}
          <select
            value={frequencyFilter}
            onChange={(e) => {
              setFrequencyFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Todas las Frecuencias</option>
            <option value="FIJO">Fijo</option>
            <option value="RECURRENTE">Recurrente</option>
            <option value="ESPORADICO">Esporádico</option>
          </select>

          {/* Export CSV Button */}
          <Button
            onClick={handleExportCsv}
            variant="outline"
            size="sm"
            className="h-9 rounded-xl border-slate-200 text-xs font-semibold text-slate-700 hover:bg-white flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV ({filtered.length})
          </Button>
        </div>
      </div>

      {/* Transaction Rows */}
      {paginatedItems.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-2xl">
          No se encontraron transacciones con los filtros seleccionados.
        </div>
      ) : (
        <div className="space-y-2.5">
          {paginatedItems.map((tx) => {
            const isIncome =
              tx.flowType === "INCOME" ||
              tx.type === "INGRESO" ||
              tx.flowType === "INGRESO";
            const title = tx.description || tx.merchant || "Transacción";
            const category = tx.categoryName || tx.group;

            return (
              <div
                key={tx.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white rounded-2xl border border-slate-100 shadow-xs hover:border-slate-200 transition-all gap-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-xl flex items-center justify-center shrink-0 ${
                      isIncome ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-slate-400">
                        <Calendar className="w-3 h-3" /> {tx.date}
                      </span>
                      {category && (
                        <span className="flex items-center gap-1 bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md text-[11px]">
                          <Tag className="w-3 h-3" /> {category}
                        </span>
                      )}
                      {tx.frequency && (
                        <span className="text-slate-400 text-[11px]">· {tx.frequency}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="sm:text-right">
                  <div
                    className={`font-black text-base tracking-tight ${
                      isIncome ? "text-emerald-600" : "text-slate-900"
                    }`}
                  >
                    {isIncome ? "+" : "-"}
                    {formatCLP(Math.abs(tx.amount))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
          <span>
            Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
            {Math.min(currentPage * itemsPerPage, filtered.length)} de {filtered.length}{" "}
            transacciones
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 font-semibold text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0 rounded-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
