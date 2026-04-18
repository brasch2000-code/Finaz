"use client";

import { useState } from "react";
import { TransactionExtractedSchema } from "@/actions/ocr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";

type QueueItem = { id: string; amount: number; merchant: string; date: string; type: string; group: string; };

export function ReviewQueue({ initialData }: { initialData: QueueItem[] }) {
  const [items, setItems] = useState<QueueItem[]>(initialData);
  const [errorMsg, setErrorMsg] = useState<{id: string, msg: string} | null>(null);
  const [shrinkingItem, setShrinkingItem] = useState<string | null>(null);

  const handleUpdate = (id: string, field: keyof QueueItem, value: string | number) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
    if (errorMsg?.id === id) setErrorMsg(null);
  };

  const removeItemWithAnimation = (id: string) => {
    setShrinkingItem(id);
    setTimeout(() => {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setShrinkingItem(null);
    }, 300);
  };

  const approveItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    const parsed = TransactionExtractedSchema.safeParse({ ...item, amount: Number(item.amount) });
    if (!parsed.success) {
      setErrorMsg({ id, msg: "Falta formato o tipado correcto: " + parsed.error.issues[0].message });
      return;
    }
    
    removeItemWithAnimation(id);
  };

  const rejectItem = (id: string) => removeItemWithAnimation(id);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 border-2 border-dashed border-indigo-100 rounded-2xl bg-indigo-50/30 text-indigo-400">
        <CheckCircle2 className="w-12 h-12 mb-4 text-emerald-400 opacity-50" />
        <p className="font-medium">No hay comprobantes pendientes OCR.</p>
        <p className="text-sm opacity-60 mt-1">Sube vouchers para extraer datos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {items.map((item) => (
        <Card 
          key={item.id} 
          className={\`overflow-hidden bg-white/70 backdrop-blur-sm border border-slate-100 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-100 \${shrinkingItem === item.id ? "scale-95 opacity-0" : "scale-100 opacity-100"}\`}
        >
          <CardContent className="p-0">
            {errorMsg?.id === item.id && (
              <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 px-4 py-3 border-b border-rose-100 font-medium">
                <AlertCircle className="w-4 h-4"/> {errorMsg.msg}
              </div>
            )}
            
            <div className="p-5 md:p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Monto */}
              <div className="space-y-1.5 focus-within:text-indigo-600 transition-colors">
                <Label htmlFor={\`amount-\${item.id}\`} className="text-xs uppercase tracking-wider font-bold text-slate-400 focus-within:text-indigo-600">Monto CLP</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono">$</span>
                  <Input id={\`amount-\${item.id}\`} type="number" value={item.amount} onChange={(e) => handleUpdate(item.id, "amount", e.target.value)} className="font-mono text-lg font-semibold pl-7 bg-slate-50/50 border-slate-200 h-11 focus:ring-indigo-200" />
                </div>
              </div>

              {/* Comercio */}
              <div className="space-y-1.5 focus-within:text-indigo-600 transition-colors">
                <Label htmlFor={\`merchant-\${item.id}\`} className="text-xs uppercase tracking-wider font-bold text-slate-400">Comercio</Label>
                <Input id={\`merchant-\${item.id}\`} value={item.merchant} onChange={(e) => handleUpdate(item.id, "merchant", e.target.value)} className="font-medium text-slate-700 bg-slate-50/50 h-11 focus:ring-indigo-200" />
              </div>

              {/* Fecha */}
              <div className="space-y-1.5 focus-within:text-indigo-600 transition-colors">
                <Label htmlFor={\`date-\${item.id}\`} className="text-xs uppercase tracking-wider font-bold text-slate-400">Fecha</Label>
                <Input id={\`date-\${item.id}\`} type="date" value={item.date} onChange={(e) => handleUpdate(item.id, "date", e.target.value)} className="font-medium text-slate-700 bg-slate-50/50 h-11 focus:ring-indigo-200 text-sm" />
              </div>

              {/* Tipo */}
              <div className="space-y-1.5 focus-within:text-indigo-600 transition-colors">
                <Label htmlFor={\`type-\${item.id}\`} className="text-xs uppercase tracking-wider font-bold text-slate-400">Flujo</Label>
                <select 
                  className="w-full rounded-md border border-slate-200 bg-slate-50/50 px-3 h-11 text-sm font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 transition-shadow appearance-none"
                  value={item.type || ""} onChange={(e) => handleUpdate(item.id, "type", e.target.value)}
                >
                  <option value="" disabled>Seleccione Flujo</option>
                  <option value="GASTO">📉 Gasto</option>
                  <option value="INGRESO">📈 Ingreso</option>
                </select>
              </div>
            </div>

            <div className="px-5 md:px-6 py-4 bg-slate-50/50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                 <Label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Group</Label>
                 <Input className="h-9 w-40 text-sm font-medium border-slate-200 focus:ring-indigo-200 bg-white" value={item.group || ""} placeholder="E.g. Supermarket" onChange={(e) => handleUpdate(item.id, "group", e.target.value)} />
              </div>
              
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <Button className="flex-1 sm:flex-none h-10 px-4 bg-white border border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors font-semibold" onClick={() => rejectItem(item.id)}>
                  <XCircle className="w-4 h-4 mr-2" /> Descartar
                </Button>
                <Button className="flex-1 sm:flex-none h-10 px-6 bg-slate-900 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 transition-all font-semibold" onClick={() => approveItem(item.id)}>
                  Aprobar <CheckCircle2 className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
