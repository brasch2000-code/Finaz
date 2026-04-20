"use client";

import { useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { addManualTransaction } from "@/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TransactionForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const formData = new FormData(e.currentTarget);
      await addManualTransaction(formData);
      setIsOpen(false);
    } catch (error) {
      console.error(error);
      alert("Error al agregar la transacción");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="mt-4 md:mt-0 flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full font-semibold shadow-md transition-all active:scale-95"
      >
        <PlusCircle className="w-5 h-5" /> Añadir Manual
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-2 transition-colors flex items-center justify-center h-8 w-8"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-6">Añadir Transacción</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Monto CLP</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <Input required id="amount" name="amount" type="number" className="pl-7 bg-slate-50 border-slate-200 focus:ring-indigo-200" placeholder="15000" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Comercio</Label>
                <Input required id="merchant" name="merchant" className="bg-slate-50 border-slate-200" placeholder="Ej. Lider, Farmacia" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input required id="date" name="date" type="date" className="bg-slate-50 text-slate-600 border-slate-200" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Flujo</Label>
                <select name="type" required className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 h-10 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none">
                  <option value="GASTO">📉 Gasto</option>
                  <option value="INGRESO">📈 Ingreso</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="group">Grupo (Opcional)</Label>
                <Input id="group" name="group" className="bg-slate-50 border-slate-200" placeholder="Ej. Alimentación" />
              </div>

              <div className="pt-4 flex gap-3">
                <Button type="button" className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Transacción"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
