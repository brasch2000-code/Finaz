"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import {
  Check,
  X,
  Sparkles,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  CheckCheck,
  Loader2,
  Tag,
  ShieldCheck,
  Pencil,
  Keyboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  verifyTransactionAction,
  rejectTransactionAction,
  batchVerifyTransactionsAction,
  getAvailableCategoriesAction,
} from "@/actions/review-actions";
import { FlowType, FrequencyType } from "@prisma/client";

export interface PendingTransactionItem {
  id: string;
  date: string;
  description: string;
  rawDescription?: string;
  amount: number;
  flowType: FlowType;
  frequency: FrequencyType;
  confidenceScore: number;
  categoryId?: string | null;
  categoryName: string;
  color?: string;
}

interface CategoryOption {
  id: string;
  name: string;
  flowType: FlowType;
  defaultFrequency: FrequencyType | null;
  colorHex: string | null;
}

interface ReviewQueueProps {
  initialPending: PendingTransactionItem[];
}

export function ReviewQueue({ initialPending }: ReviewQueueProps) {
  const [items, setItems] = useState<PendingTransactionItem[]>(initialPending);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [filterMode, setFilterMode] = useState<"ALL" | "HIGH" | "REVIEW">("ALL");
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Edit modal state
  const [editingItem, setEditingItem] = useState<PendingTransactionItem | null>(null);
  const [editForm, setEditForm] = useState<{
    description: string;
    amount: number;
    flowType: FlowType;
    frequency: FrequencyType;
    categoryId: string;
    newCategoryName: string;
  }>({
    description: "",
    amount: 0,
    flowType: FlowType.EXPENSE,
    frequency: FrequencyType.RECURRENTE,
    categoryId: "",
    newCategoryName: "",
  });

  const [availableCategories, setAvailableCategories] = useState<CategoryOption[]>([]);

  // Load categories on mount
  useEffect(() => {
    async function loadCategories() {
      const res = await getAvailableCategoriesAction();
      if (res.success && res.categories) {
        setAvailableCategories(res.categories as CategoryOption[]);
      }
    }
    loadCategories();
  }, []);

  const formatCLP = (val: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(val);

  // Filtered items
  const filteredItems = items.filter((item) => {
    if (filterMode === "HIGH") return item.confidenceScore >= 0.85;
    if (filterMode === "REVIEW") return item.confidenceScore < 0.85;
    return true;
  });

  const highConfidenceCount = items.filter((i) => i.confidenceScore >= 0.85).length;
  const reviewNeededCount = items.filter((i) => i.confidenceScore < 0.85).length;

  const handleApprove = useCallback(
    (item: PendingTransactionItem) => {
      setProcessingId(item.id);
      startTransition(async () => {
        const res = await verifyTransactionAction({
          id: item.id,
          description: item.description,
          amount: item.amount,
          flowType: item.flowType,
          frequency: item.frequency,
          categoryId: item.categoryId,
          newCategoryName: !item.categoryId ? item.categoryName : undefined,
        });

        if (res.success) {
          setItems((prev) => prev.filter((i) => i.id !== item.id));
        }
        setProcessingId(null);
      });
    },
    []
  );

  const handleReject = useCallback(
    (id: string) => {
      setProcessingId(id);
      startTransition(async () => {
        const res = await rejectTransactionAction(id);
        if (res.success) {
          setItems((prev) => prev.filter((i) => i.id !== id));
        }
        setProcessingId(null);
      });
    },
    []
  );

  const handleBatchApprove = () => {
    if (filteredItems.length === 0) return;
    startTransition(async () => {
      const ids = filteredItems.map((i) => i.id);
      const res = await batchVerifyTransactionsAction(ids);
      if (res.success) {
        setItems((prev) => prev.filter((item) => !ids.includes(item.id)));
      }
    });
  };

  const openEditModal = useCallback((item: PendingTransactionItem) => {
    setEditingItem(item);
    setEditForm({
      description: item.description,
      amount: item.amount,
      flowType: item.flowType,
      frequency: item.frequency,
      categoryId: item.categoryId || "",
      newCategoryName: "",
    });
  }, []);

  const handleSaveEditAndApprove = async () => {
    if (!editingItem) return;
    setProcessingId(editingItem.id);
    startTransition(async () => {
      const res = await verifyTransactionAction({
        id: editingItem.id,
        description: editForm.description,
        amount: Number(editForm.amount),
        flowType: editForm.flowType,
        frequency: editForm.frequency,
        categoryId: editForm.categoryId || undefined,
        newCategoryName:
          !editForm.categoryId && editForm.newCategoryName
            ? editForm.newCategoryName
            : undefined,
      });

      if (res.success) {
        setItems((prev) => prev.filter((i) => i.id !== editingItem.id));
        setEditingItem(null);
      }
      setProcessingId(null);
    });
  };

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when an input/textarea/select is focused or modal is open
      const target = e.target as HTMLElement;
      if (
        editingItem ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }

      if (filteredItems.length === 0) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
      } else if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
      } else if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        const activeItem = filteredItems[selectedIndex];
        if (activeItem) handleApprove(activeItem);
      } else if (e.key === "r" || e.key === "R" || e.key === "d" || e.key === "D") {
        e.preventDefault();
        const activeItem = filteredItems[selectedIndex];
        if (activeItem) handleReject(activeItem.id);
      } else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        const activeItem = filteredItems[selectedIndex];
        if (activeItem) openEditModal(activeItem);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [filteredItems, selectedIndex, editingItem, handleApprove, handleReject, openEditModal]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-white/60 p-10 text-center backdrop-blur-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-3">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800">Cola de Revisión Vacía</h4>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Todas las transacciones han sido auditadas y verificadas. Los dashboards reflejan la totalidad de registros.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header & Batch Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
            {items.length}
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">Pendientes de Validación Humana</h3>
            <p className="text-[11px] text-slate-400">
              Revisa y confirma la clasificación sugerida por el motor de IA
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-0.5 rounded-xl text-xs font-semibold">
            <button
              onClick={() => { setFilterMode("ALL"); setSelectedIndex(0); }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterMode === "ALL"
                  ? "bg-white text-slate-800 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Todos ({items.length})
            </button>
            <button
              onClick={() => { setFilterMode("HIGH"); setSelectedIndex(0); }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterMode === "HIGH"
                  ? "bg-white text-emerald-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Alta Conf. ({highConfidenceCount})
            </button>
            <button
              onClick={() => { setFilterMode("REVIEW"); setSelectedIndex(0); }}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterMode === "REVIEW"
                  ? "bg-white text-amber-700 shadow-xs font-bold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Revisar ({reviewNeededCount})
            </button>
          </div>

          <Button
            onClick={handleBatchApprove}
            disabled={isPending || filteredItems.length === 0}
            variant="outline"
            className="flex items-center gap-1.5 text-xs font-semibold h-8 rounded-lg border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Aprobar Visibles ({filteredItems.length})
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts Hint */}
      <div className="hidden md:flex items-center justify-between px-3 py-1.5 bg-slate-50 border border-slate-200/60 rounded-xl text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <Keyboard className="h-3.5 w-3.5 text-slate-400" />
          <span>Atajos de teclado:</span>
        </div>
        <div className="flex items-center gap-3">
          <span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">↑ / ↓</kbd> Navegar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">A</kbd> Aprobar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">R</kbd> Rechazar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white rounded border border-slate-200 font-mono text-[10px] font-bold">E</kbd> Editar</span>
        </div>
      </div>

      {/* Transaction List */}
      <div className="grid gap-2.5">
        {filteredItems.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          const isCurrentProcessing = processingId === item.id;
          const isHighConfidence = item.confidenceScore >= 0.85;

          return (
            <div
              key={item.id}
              onClick={() => setSelectedIndex(idx)}
              className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl bg-white border transition-all gap-3 cursor-pointer ${
                isSelected
                  ? "border-indigo-500 ring-2 ring-indigo-500/10 shadow-sm"
                  : "border-slate-100 hover:border-slate-200 shadow-xs"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                {/* Flow Icon */}
                <div
                  className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${
                    item.flowType === "INCOME"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-rose-50 text-rose-600"
                  }`}
                >
                  {item.flowType === "INCOME" ? (
                    <ArrowUpRight className="h-4 w-4" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4" />
                  )}
                </div>

                {/* Info */}
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-sm">{item.description}</span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isHighConfidence
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : "bg-amber-50 text-amber-700 border border-amber-200/60"
                      }`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      {(item.confidenceScore * 100).toFixed(0)}% confianza
                    </span>
                    {isSelected && (
                      <span className="hidden md:inline-block px-1.5 py-0.2 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded">
                        Seleccionado
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-slate-500 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.date}
                    </span>
                    <span className="flex items-center gap-1 font-medium text-indigo-600 bg-indigo-50/80 px-2 py-0.5 rounded-md text-[11px]">
                      <Tag className="h-3 w-3" />
                      {item.categoryName}
                    </span>
                    <span className="font-medium text-slate-400 text-[11px]">· {item.frequency}</span>
                    {item.rawDescription && item.rawDescription !== item.description && (
                      <span className="text-[10px] text-slate-400 italic">
                        (Orig: {item.rawDescription})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Amount and Action Buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                <div
                  className={`text-base font-black tracking-tight ${
                    item.flowType === "INCOME" ? "text-emerald-600" : "text-slate-900"
                  }`}
                >
                  {item.flowType === "INCOME" ? "+" : "-"}
                  {formatCLP(item.amount)}
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditModal(item);
                    }}
                    className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-100"
                    title="Editar detalles (E)"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(item);
                    }}
                    disabled={isPending}
                    className="h-8 w-8 p-0 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    title="Aprobar (A)"
                  >
                    {isCurrentProcessing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleReject(item.id);
                    }}
                    disabled={isPending}
                    className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200"
                    title="Descartar (R)"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-base">Editar y Validar Transacción</h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Descripción Normalizada</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Monto (CLP)</label>
                  <input
                    type="number"
                    value={editForm.amount}
                    onChange={(e) => setEditForm({ ...editForm, amount: Number(e.target.value) })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo de Flujo</label>
                  <select
                    value={editForm.flowType}
                    onChange={(e) => setEditForm({ ...editForm, flowType: e.target.value as FlowType })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                  >
                    <option value={FlowType.EXPENSE}>Gasto (EXPENSE)</option>
                    <option value={FlowType.INCOME}>Ingreso (INCOME)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Categoría</label>
                  <select
                    value={editForm.categoryId}
                    onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                  >
                    <option value="">-- Otra / Nueva Categoría --</option>
                    {availableCategories
                      .filter((c) => c.flowType === editForm.flowType)
                      .map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Frecuencia</label>
                  <select
                    value={editForm.frequency}
                    onChange={(e) => setEditForm({ ...editForm, frequency: e.target.value as FrequencyType })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                  >
                    <option value={FrequencyType.FIJO}>FIJO (Estructural)</option>
                    <option value={FrequencyType.RECURRENTE}>RECURRENTE (Habitual)</option>
                    <option value={FrequencyType.ESPORADICO}>ESPORADICO (Ocasional)</option>
                  </select>
                </div>
              </div>

              {!editForm.categoryId && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nombre de Nueva Categoría
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Delivery Comida, Freelance..."
                    value={editForm.newCategoryName}
                    onChange={(e) => setEditForm({ ...editForm, newCategoryName: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                onClick={() => setEditingItem(null)}
                className="rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveEditAndApprove}
                disabled={isPending}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
              >
                {isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1.5" />
                )}
                Guardar y Validar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
