// src/components/ReviewQueue.tsx
"use client";

import { useState } from "react";
import { TransactionExtractedSchema } from "@/actions/ocr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type QueueItem = { id: string; amount: number; merchant: string; date: string; type: string; group: string; };

export function ReviewQueue({ initialData }: { initialData: QueueItem[] }) {
  const [items, setItems] = useState<QueueItem[]>(initialData);
  const [errorMsg, setErrorMsg] = useState<{id: string, msg: string} | null>(null);

  const handleUpdate = (id: string, field: keyof QueueItem, value: string | number) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, [field]: value } : item));
    if (errorMsg?.id === id) setErrorMsg(null);
  };

  const approveItem = async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Validación estricta Zod en cliente
    const parsed = TransactionExtractedSchema.safeParse({ 
      ...item, 
      amount: Number(item.amount) 
    });

    if (!parsed.success) {
      setErrorMsg({ id, msg: "Faltan campos o el formato es incorrecto. Revise: " + parsed.error.issues[0].message });
      return;
    }

    // Server Action para actualizar el estado a APPROVED
    // await updateTransactionStatusAction(id, "APPROVED");
    
    // Simulación UI
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const rejectItem = (id: string) => {
    // Server Action para descartar/borrar
    // await updateTransactionStatusAction(id, "REJECTED");
    
    // Simulación UI
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 text-gray-500">
        <p>No hay extracciones OCR pendientes de revisión.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.id} className="overflow-hidden border-orange-200 shadow-sm">
          <CardContent className="p-5">
            {errorMsg?.id === item.id && (
              <div className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                {errorMsg.msg}
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <Label htmlFor={`amount-${item.id}`} className="text-xs text-gray-500 uppercase font-semibold">Monto (CLP)</Label>
                <Input 
                  id={`amount-${item.id}`} 
                  type="number" 
                  value={item.amount} 
                  onChange={(e) => handleUpdate(item.id, "amount", e.target.value)} 
                  className="font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`merchant-${item.id}`} className="text-xs text-gray-500 uppercase font-semibold">Comercio</Label>
                <Input 
                  id={`merchant-${item.id}`} 
                  value={item.merchant} 
                  onChange={(e) => handleUpdate(item.id, "merchant", e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`date-${item.id}`} className="text-xs text-gray-500 uppercase font-semibold">Fecha</Label>
                <Input 
                  id={`date-${item.id}`} 
                  type="date" 
                  value={item.date} 
                  onChange={(e) => handleUpdate(item.id, "date", e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`type-${item.id}`} className="text-xs text-gray-500 uppercase font-semibold">Flujo</Label>
                <select 
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={item.type || ""} 
                  onChange={(e) => handleUpdate(item.id, "type", e.target.value)}
                >
                  <option value="">(Seleccione)</option>
                  <option value="GASTO">Gasto</option>
                  <option value="INGRESO">Ingreso</option>
                </select>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t pt-4">
              <div className="flex items-center gap-2">
                 <Label className="text-xs text-gray-500">Group:</Label>
                 <Input 
                    className="h-8 max-w-[150px] text-xs" 
                    value={item.group || ""} 
                    placeholder="Opcional"
                    onChange={(e) => handleUpdate(item.id, "group", e.target.value)} 
                  />
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" size="sm" onClick={() => rejectItem(item.id)}>Descartar</Button>
                <Button size="sm" onClick={() => approveItem(item.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow">Consolidar ✓</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
