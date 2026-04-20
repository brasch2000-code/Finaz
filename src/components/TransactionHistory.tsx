import { ArrowDownRight, ArrowUpRight, Calendar, Tag } from "lucide-react";

type TransactionItem = {
  id: string;
  amount: number;
  merchant: string;
  date: string;
  type: string | null;
  group: string | null;
};

export function TransactionHistory({ transactions }: { transactions: TransactionItem[] }) {
  const formatCLP = (val: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(val);
  
  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50 text-slate-400">
        <p className="font-medium">No hay transacciones en el historial.</p>
        <p className="text-sm mt-1">Agrega una manualmente o aprueba desde OCR.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
        <div key={tx.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl flex items-center justify-center ${tx.type === 'INGRESO' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
              {tx.type === 'INGRESO' ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{tx.merchant}</h3>
              <div className="flex items-center gap-3 text-xs font-medium text-slate-500 mt-1">
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> {tx.date}</span>
                {tx.group && <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5"/> {tx.group}</span>}
              </div>
            </div>
          </div>
          <div className="sm:text-right">
            <div className={`font-black text-xl tracking-tight ${tx.type === 'INGRESO' ? 'text-emerald-600' : 'text-slate-800'}`}>
              {tx.type === 'INGRESO' ? '+' : '-'}{formatCLP(Math.abs(tx.amount))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
