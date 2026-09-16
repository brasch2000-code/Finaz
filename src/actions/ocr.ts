// src/actions/ocr.ts
"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { prisma } from "@/infrastructure/db/prisma";
import {
  TransactionStatus,
  FlowType,
  FrequencyType,
  TransactionSource,
  Currency,
} from "@prisma/client";
import { generateTransactionHash } from "@/application/etl/csv-parser";
import { Decimal } from "@prisma/client/runtime/library";

export const TransactionExtractedSchema = z.object({
  amount: z
    .number()
    .describe("Monto original de la transacción. Formato CLP. Ejemplo: 15500."),
  merchant: z
    .string()
    .describe("Comercio o destinatario. Si es ambiguo, referir al texto más grande."),
  date: z
    .string()
    .describe("Fecha en formato YYYY-MM-DD. Estima el año actual si no está explícito."),
  group: z
    .string()
    .optional()
    .describe("Clasificación sugerida (ej. Supermercado, Transporte, Salud, Comida)."),
  type: z.enum(["INGRESO", "GASTO"]).describe("Dirección del flujo de caja."),
});

export type ExtractedTransaction = z.infer<typeof TransactionExtractedSchema>;

export async function processReceiptImage(
  base64Image: string
): Promise<{ success: boolean; data?: ExtractedTransaction; error?: string }> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: TransactionExtractedSchema,
      messages: [
        {
          role: "system",
          content:
            "Misión: Extraer datos JSON de comprobantes bancarios, Junaeb y vouchers de Chile. El formato de moneda chilena no usa decimales y separa por puntos.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analiza el voucher e identifica monto, comercio, fecha, grupo sugerido y tipo. Ignora distracciones. Si un campo no es identificable, omítelo.",
            },
            { type: "image", image: base64Image },
          ],
        },
      ],
      abortSignal: AbortSignal.timeout(12000),
    });

    const flowType =
      object.type === "INGRESO" ? FlowType.INCOME : FlowType.EXPENSE;
    const txDate = new Date(object.date);
    const date = isNaN(txDate.getTime()) ? new Date() : txDate;

    const hash = generateTransactionHash(
      date,
      object.merchant,
      object.amount,
      flowType
    );

    let categoryId: string | null = null;
    if (object.group && object.group.trim() !== "") {
      const category = await prisma.category.upsert({
        where: {
          name_flowType: {
            name: object.group.trim(),
            flowType,
          },
        },
        create: {
          name: object.group.trim(),
          flowType,
          defaultFrequency: FrequencyType.ESPORADICO,
        },
        update: {},
      });
      categoryId = category.id;
    }

    await prisma.transaction.upsert({
      where: { hash },
      create: {
        hash,
        date,
        description: object.merchant.trim(),
        rawDescription: object.merchant.trim(),
        amount: new Decimal(object.amount),
        currency: Currency.CLP,
        flowType,
        frequency: FrequencyType.ESPORADICO,
        status: TransactionStatus.PENDING_REVIEW,
        source: TransactionSource.OCR_RECEIPT,
        confidenceScore: 0.88,
        categoryId,
      },
      update: {},
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("[OCR_PROCESS_ERROR]", error);
    return {
      success: false,
      error:
        "Error temporal de Vercel AI SDK o formato irreconocible. Ingrese el registro manualmente.",
    };
  }
}
