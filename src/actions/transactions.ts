"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/infrastructure/db/prisma";
import { generateTransactionHash } from "@/application/etl/csv-parser";
import { FlowType, FrequencyType, TransactionStatus, TransactionSource } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export async function addManualTransaction(data: {
  amount: number;
  merchant: string;
  dateStr: string;
  type: string;
  group?: string;
  frequency?: string;
}) {
  try {
    const { amount, merchant, dateStr, type, group, frequency } = data;

    if (!amount || !merchant || !dateStr || !type) {
      return {
        success: false,
        error: "Faltan campos obligatorios (Monto, Comercio, Fecha, Flujo)",
      };
    }

    const flowType =
      type.toUpperCase() === "INGRESO" || type.toUpperCase() === "INCOME"
        ? FlowType.INCOME
        : FlowType.EXPENSE;

    const freqType =
      frequency === "FIJO"
        ? FrequencyType.FIJO
        : frequency === "RECURRENTE"
        ? FrequencyType.RECURRENTE
        : FrequencyType.ESPORADICO;

    const date = new Date(dateStr);
    const hash = generateTransactionHash(
      isNaN(date.getTime()) ? new Date() : date,
      merchant,
      amount,
      flowType
    );

    let categoryId: string | null = null;
    if (group && group.trim() !== "") {
      const category = await prisma.category.upsert({
        where: {
          name_flowType: {
            name: group.trim(),
            flowType,
          },
        },
        create: {
          name: group.trim(),
          flowType,
          defaultFrequency: freqType,
        },
        update: {},
      });
      categoryId = category.id;
    }

    await prisma.transaction.create({
      data: {
        hash,
        date: isNaN(date.getTime()) ? new Date() : date,
        description: merchant.trim(),
        rawDescription: merchant.trim(),
        amount: new Decimal(amount),
        flowType,
        frequency: freqType,
        status: TransactionStatus.VERIFIED,
        source: TransactionSource.MANUAL,
        confidenceScore: 1.0,
        categoryId,
        verifiedAt: new Date(),
        verifiedBy: "MANUAL_USER",
      },
    });

    revalidatePath("/");
    return { success: true, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Error al registrar la transacción.";
    console.error("[ADD_MANUAL_TX_ERROR]", err);
    return {
      success: false,
      error: message,
    };
  }
}
