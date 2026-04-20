"use server";

import { revalidatePath } from "next/cache";
import { dbMock } from "@/lib/db-mock";
import { TransactionStatus, TransactionFrequency } from "@prisma/client";

export async function addManualTransaction(formData: FormData) {
  const amount = Number(formData.get("amount"));
  const merchant = formData.get("merchant") as string;
  const dateStr = formData.get("date") as string;
  const type = formData.get("type") as string;
  const group = formData.get("group") as string;

  if (!amount || !merchant || !dateStr || !type) {
    throw new Error("Faltan campos obligatorios");
  }

  await dbMock.createTransaction({
    amount,
    currency: "CLP",
    merchant,
    date: new Date(dateStr),
    status: TransactionStatus.APPROVED,
    frequency: TransactionFrequency.ONE_TIME,
    group: group || null,
    type,
    imageUrl: null,
  });

  revalidatePath("/");
}
