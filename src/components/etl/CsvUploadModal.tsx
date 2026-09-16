"use client";

import React, { useState, useTransition } from "react";
import { UploadCloud, FileSpreadsheet, CheckCircle2, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importTransactionsCsvAction, ImportResult } from "@/actions/etl-actions";

export function CsvUploadModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    startTransition(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await importTransactionsCsvAction(formData);
      setResult(res);
      if (res.success) {
        setTimeout(() => {
          // Keep open to show result or close
        }, 2000);
      }
    });
  };

  const resetModal = () => {
    setFile(null);
    setResult(null);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold shadow-sm rounded-xl px-4 py-2.5 text-sm"
      >
        <UploadCloud className="h-4 w-4" />
        Importar CSV
      </Button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">Importar Transacciones</h3>
                  <p className="text-xs text-slate-500">Formato CSV dual de finanzas personales</p>
                </div>
              </div>
              <button
                onClick={resetModal}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="my-6">
              {!result ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 p-8 text-center transition-colors hover:border-indigo-400 hover:bg-indigo-50/30">
                  <UploadCloud className="h-10 w-10 text-slate-400 mb-3" />
                  <p className="text-sm font-semibold text-slate-700">
                    {file ? file.name : "Selecciona o arrastra tu archivo CSV"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Soporta: Fecha, Descripcion, Ingreso, Gasto, Frecuencia, Tipo Gasto
                  </p>
                  <label className="mt-4 cursor-pointer rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm">
                    Examinar archivo
                    <input
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileChange}
                      disabled={isPending}
                    />
                  </label>
                </div>
              ) : result.success ? (
                <div className="rounded-2xl bg-emerald-50/80 border border-emerald-100 p-6 text-center text-emerald-900">
                  <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto mb-3" />
                  <h4 className="text-lg font-bold">¡Importación Exitosa!</h4>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100/60">
                      <div className="text-slate-500 font-medium">Total Filas</div>
                      <div className="text-base font-bold text-slate-800">{result.totalRows}</div>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100/60">
                      <div className="text-slate-500 font-medium">Importadas</div>
                      <div className="text-base font-bold text-emerald-600">{result.importedRows}</div>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100/60">
                      <div className="text-slate-500 font-medium">Duplicados</div>
                      <div className="text-base font-bold text-amber-600">{result.skippedDuplicates}</div>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-600">
                    Las transacciones importadas están disponibles en la cola de revisión.
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-rose-50 border border-rose-100 p-6 text-center text-rose-900">
                  <AlertCircle className="h-10 w-10 text-rose-600 mx-auto mb-2" />
                  <h4 className="font-bold">Error al procesar el archivo</h4>
                  <p className="mt-1 text-xs text-rose-700">{result.error}</p>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1 rounded-xl h-11"
                onClick={resetModal}
                disabled={isPending}
              >
                {result ? "Cerrar" : "Cancelar"}
              </Button>
              {!result && (
                <Button
                  type="button"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-11 shadow-sm font-semibold"
                  disabled={!file || isPending}
                  onClick={handleUpload}
                >
                  {isPending ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Procesando...
                    </span>
                  ) : (
                    "Comenzar Ingesta"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
