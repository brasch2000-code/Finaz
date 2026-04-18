// src/actions/ocr.ts
"use server";

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { dbMock } from "@/lib/db-mock";
import { TransactionStatus, TransactionFrequency } from "@prisma/client";

export const TransactionExtractedSchema = z.object({
  amount: z.number().describe("Monto original de la transacción. Formato CLP_ Ejemplo: 15500."),
  merchant: z.string().describe("Comercio o destinatario. Si es ambiguo, referir al texto más grande."),
  date: z.string().describe("Fecha en formato YYYY-MM-DD. Estima el año actual si no está explícito."),
  group: z.string().optional().describe("Clasificación sugerida (ej. Supermercado, Transporte, Salud, Comida)."),
  type: z.enum(["INGRESO", "GASTO"]).describe("Dirección del flujo de caja."),
});

export type ExtractedTransaction = z.infer<typeof TransactionExtractedSchema>;

export async function processReceiptImage(base64Image: string): Promise<{ success: boolean; data?: ExtractedTransaction; error?: string }> {
  try {
    const { object } = await generateObject({
      model: openai("gpt-4o"),
      schema: TransactionExtractedSchema,
      messages: [
        {
          role: "system",
          content: "Misión: Extraer datos JSON de comprobantes bancarios, Junaeb y vouchers de Chile. El formato de moneda chilena no usa decimales y separa por puntos."
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza el voucher e identifica monto, comercio, fecha, grupo sugerido y tipo. Ignora distracciones. Si un campo no es identificable, omítelo." },
            { type: "image", image: base64Image }
          ]
        }
      ],
      abortSignal: AbortSignal.timeout(12000)
    });

    // Guardar en base de datos temporal con estado pendientes_review
    await dbMock.createTransaction({
      amount: object.amount,
      currency: "CLP",
      merchant: object.merchant,
      date: new Date(object.date),
      group: object.group || null,
      type: object.type,
      status: TransactionStatus.PENDING_REVIEW,
      frequency: TransactionFrequency.ONE_TIME,
      imageUrl: null
    });

    return { success: true, data: object };
  } catch (error) {
    console.error("[OCR_PROCESS_ERROR]", error);
    return {
      success: false,
      error: "Error temporal de Vercel AI SDK o formato irreconocible. Ingrese el registro manualmente."
    };
  }
}
