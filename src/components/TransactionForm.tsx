"use client";

import { useState, useEffect, useRef } from "react";
import { PlusCircle, X, ChevronDown, Check } from "lucide-react";
import { addManualTransaction } from "@/actions/transactions";
import { fetchGroups } from "@/actions/groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TransactionForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [type, setType] = useState("GASTO");
  const [groupSearch, setGroupSearch] = useState("");
  const [groups, setGroups] = useState<string[]>([]);
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchGroups(type).then(setGroups);
      // Resetear grupo al cambiar tipo si el usuario no ha escrito nada definitivo
      setGroupSearch("");
    }
  }, [type, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredGroups = groups.filter(g => g.toLowerCase().includes(groupSearch.toLowerCase()));
  const exactMatch = groups.find(g => g.toLowerCase() === groupSearch.trim().toLowerCase());
  const showAddOption = groupSearch.trim() !== "" && !exactMatch;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        amount: Number(formData.get("amount")),
        merchant: formData.get("merchant") as string,
        dateStr: formData.get("date") as string,
        type: formData.get("type") as string,
        group: groupSearch.trim()
      };
      
      const result = await addManualTransaction(data);
      if (result.success) {
        setIsOpen(false);
      } else {
        setErrorMsg(result.error || "Error al registrar.");
      }
    } catch (error) {
      console.error(error);
      setErrorMsg("Ocurrió un fallo en el cliente antes del envío.");
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
              type="button"
            >
              <X className="w-4 h-4" />
            </button>

            <h2 className="text-xl font-bold text-slate-800 mb-6">Añadir Transacción</h2>

            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 text-rose-600 text-sm font-medium border border-rose-100">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Flujo</Label>
                <select 
                  id="type"
                  name="type" 
                  required 
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 h-10 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 appearance-none"
                >
                  <option value="GASTO">📉 Gasto</option>
                  <option value="INGRESO">📈 Ingreso</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Monto CLP</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <Input required id="amount" name="amount" type="number" className="pl-7 bg-slate-50 border-slate-200 focus:ring-indigo-200 text-lg font-semibold" placeholder="15000" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="merchant">Comercio o Emisor</Label>
                <Input required id="merchant" name="merchant" className="bg-slate-50 border-slate-200" placeholder="Ej. Uber, Farmacia, Nómina..." />
              </div>

              <div className="space-y-2 relative" ref={dropdownRef}>
                <Label htmlFor="groupSearch">Grupo Curado (Automático)</Label>
                <div className="relative">
                  <Input 
                    id="groupSearch"
                    className="bg-slate-50 border-slate-200 pr-10" 
                    placeholder="Escribe o selecciona..." 
                    value={groupSearch}
                    onChange={(e) => {
                      setGroupSearch(e.target.value);
                      setIsGroupDropdownOpen(true);
                    }}
                    onFocus={() => setIsGroupDropdownOpen(true)}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>

                {isGroupDropdownOpen && (
                  <div className="absolute top-[calc(100%+4px)] left-0 w-full bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-48 overflow-y-auto p-1 animate-in fade-in slide-in-from-top-2">
                    {filteredGroups.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          setGroupSearch(g);
                          setIsGroupDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded-md transition-colors flex items-center justify-between group"
                      >
                        {g}
                        {g === exactMatch && <Check className="w-4 h-4 text-indigo-600" />}
                      </button>
                    ))}
                    
                    {filteredGroups.length === 0 && !showAddOption && (
                      <div className="px-3 py-2 text-sm text-slate-400 text-center italic">
                        No hay grupos usados de este flujo. Escribe uno nuevo.
                      </div>
                    )}

                    {showAddOption && (
                      <button
                        type="button"
                        onClick={() => setIsGroupDropdownOpen(false)}
                        className="w-full text-left px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors mt-1 border border-indigo-100/50"
                      >
                        <span className="opacity-70 mr-1">Crear grupo:</span> "{groupSearch.trim()}"
                      </button>
                    )}
                  </div>
                )}
              </div>

               <div className="space-y-2">
                <Label htmlFor="date">Fecha de Emisión</Label>
                <Input required id="date" name="date" type="date" className="bg-slate-50 text-slate-600 border-slate-200" defaultValue={new Date().toISOString().split("T")[0]} />
              </div>

              <div className="pt-5 flex gap-3">
                <Button type="button" className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 font-semibold h-11" onClick={() => setIsOpen(false)}>Cancelar</Button>
                <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold h-11 shadow-lg shadow-indigo-600/20" disabled={loading}>
                  {loading ? "Guardando..." : "Guardar Registro"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
