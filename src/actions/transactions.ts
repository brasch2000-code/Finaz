"use server";

import { revalidatePath } from "next/cache";
import { dbMock } from "@/lib/db-mock";

export async function addManualTransaction(formData: FormData) {
  try {
    const amount = Number(formData.get("amount"));
    const merchant = formData.get("merchant") as string;
    const dateStr = formData.get("date") as string;
    const type = formData.get("type") as string;
    const group = formData.get("group") as string;

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
