// src/app/page.tsx
import { dbMock } from "@/lib/db-mock";
import { ReviewQueue } from "@/components/ReviewQueue";

const formatCLP = (val: number) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(val);

export default async function DashboardPage() {
  const approvedBalance = await dbMock.getApprovedBalance();
  const pendingTransactions = await dbMock.getPendingTransactions();

  // Serializamos las fechas para pasar al Client Component
  const serializablePending = pendingTransactions.map(t => ({
    ...t,
    date: t.date.toISOString().split("T")[0]
  }));

  return (
    <main className="container mx-auto p-4 md:p-8 space-y-10">
      <header>
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">Consolidado Financiero</h1>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <section className="bg-gray-50 border border-gray-200 p-8 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-2 text-gray-600">Balance Activo</h2>
          <div className={`text-5xl font-mono tracking-tighter ${approvedBalance >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
            {formatCLP(approvedBalance)}
          </div>
          <p className="text-sm text-gray-500 mt-4">Transacciones consolidadas y aprobadas.</p>
        </section>

        <section className="flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-amber-700">Cola de Revisión OCR</h2>
            <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-3 py-1 rounded-full">
              {pendingTransactions.length} Pendientes
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            <ReviewQueue initialData={serializablePending as any} />
          </div>
        </section>
      </div>
    </main>
  );
}
