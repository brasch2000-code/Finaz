import { dbMock } from "@/lib/db-mock";
import { ReviewQueue } from "@/components/ReviewQueue";
import { TransactionHistory } from "@/components/TransactionHistory";
import { TransactionForm } from "@/components/TransactionForm";
import { PlusCircle, Wallet, ArrowUpRight, ArrowDownRight } from "lucide-react";

export default async function DashboardPage() {
  const formatCLP = (val: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(val);
  
  const approvedBalance = await dbMock.getApprovedBalance();
  const pendingTransactions = await dbMock.getPendingTransactions();
  const approvedHistory = await dbMock.getApprovedTransactions();

  // Serializamos fechas para Server to Client passing
  const serializablePending = pendingTransactions.map(t => ({
    ...t,
    date: t.date.toISOString().split("T")[0]
  }));
  const serializableHistory = approvedHistory.map(t => ({
    ...t,
    date: t.date.toISOString().split("T")[0]
  }));

  return (
    <main className="container mx-auto max-w-6xl p-4 md:p-8 pt-12 space-y-12">
      <header className="flex flex-col md:flex-row items-baseline justify-between border-b border-slate-200/50 pb-6">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 drop-shadow-sm">Consolidado Finaz</h1>
          <p className="text-slate-500 font-medium mt-2">Visión de control algorítmico y revisión OCR.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-3">
          <TransactionForm />
          <button className="mt-4 md:mt-0 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full font-semibold shadow-md shadow-indigo-200 transition-all active:scale-95">
            <PlusCircle className="w-5 h-5" /> Subir Voucher
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Panel Izquierdo: Balance */}
        <section className="lg:col-span-5 h-min space-y-6">
          <div className="bg-white/60 backdrop-blur-3xl border border-white shadow-xl shadow-slate-200/50 rounded-3xl p-8 relative overflow-hidden group">
            {/* Elemento de diseño de fondo cristalino */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
            
            <div className="relative z-10">
              <div className="flex items-center gap-3 text-slate-500 font-semibold uppercase tracking-wider text-sm mb-4">
                <Wallet className="w-5 h-5 text-indigo-500" /> Balance Activo
              </div>
              <div className={`text-6xl font-black tracking-tighter ${approvedBalance >= 0 ? "text-slate-800" : "text-rose-700"}`}>
                {formatCLP(approvedBalance)}
              </div>
              
              <div className="mt-8 flex items-center gap-6 pt-6 border-t border-slate-100">
                 <div className="flex flex-col">
                   <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                     <ArrowUpRight className="w-4 h-4"/> Ingresos
                   </div>
                   <span className="text-lg font-bold text-slate-700">$0</span>
                 </div>
                 <div className="flex flex-col">
                   <div className="flex items-center gap-1 text-sm font-semibold text-red-500">
                     <ArrowDownRight className="w-4 h-4"/> Gastos
                   </div>
                   <span className="text-lg font-bold text-slate-700">$0</span>
                 </div>
              </div>
            </div>
          </div>
        </section>

        {/* Panel Derecho: Review Queue */}
        <section className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Bandeja de Revisión AI</h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-3 py-1 rounded-full animate-pulse border border-amber-200">
              {pendingTransactions.length} PENDIENTES
            </span>
          </div>
          <div className="flex-1 bg-white/40 backdrop-blur-xl border border-white rounded-3xl p-2 md:p-6 shadow-sm">
            <ReviewQueue initialData={serializablePending as any} />
          </div>
        </section>

      </div>
    </main>
  );
}
