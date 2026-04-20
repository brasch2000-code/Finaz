"use server";

import { revalidatePath } from "next/cache";
import { dbMock } from "@/lib/db-mock";

export async function addManualTransaction(data: { amount: number; merchant: string; dateStr: string; type: string; group: string }) {
  try {
    const { amount, merchant, dateStr, type, group } = data;

    if (!amount || !merchant || !dateStr || !type) {
      return { success: false, error: "Faltan campos obligatorios (Monto, Comercio, Fecha, Flujo)" };
    }

    await dbMock.createTransaction({
      amount,
      currency: "CLP",
      merchant,
      date: new Date(dateStr),
      status: "APPROVED" as any,
      frequency: "ONE_TIME" as any,
      group: group || null,
      type,
      imageUrl: null,
    });

    revalidatePath("/");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message || "Ha ocurrido un error inesperado al contactar con la base de datos simulada" };
  }
}
