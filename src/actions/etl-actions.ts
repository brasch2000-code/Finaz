"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/infrastructure/db/prisma";
import {
  parseTransactionsCsv,
  NormalizedTransactionPayload,
} from "@/application/etl/csv-parser";
import { parseTransactionsPdf } from "@/application/etl/bank-statement-parser";
import { omniRouter } from "@/infrastructure/llm/omni-router";
import {
  BatchStatus,
  TransactionStatus,
  TransactionSource,
  FlowType,
  FrequencyType,
} from "@prisma/client";

export interface ImportResult {
  success: boolean;
  batchId?: string;
  totalRows: number;
  importedRows: number;
  skippedDuplicates: number;
  failedRows: number;
  detectedBank?: string;
  extractionTier?: string;
  error?: string;
}

/**
 * Persiste payloads normalizados en la base de datos de manera idempotente,
 * resolviendo categorías dinámicas y ejecutando el clasificador OmniRouter cuando sea necesario.
 */
export async function persistNormalizedPayloads(
  filename: string,
  source: TransactionSource,
  parsedPayloads: NormalizedTransactionPayload[],
  extraResult?: { detectedBank?: string; extractionTier?: string }
): Promise<ImportResult> {
  if (parsedPayloads.length === 0) {
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedDuplicates: 0,
      failedRows: 0,
      error: "El archivo no contiene transacciones válidas para importar.",
    };
  }

  // 1. Crear ImportBatch
  const batch = await prisma.importBatch.create({
    data: {
      filename,
      totalRows: parsedPayloads.length,
      status: BatchStatus.PROCESSING,
    },
  });

  // 2. Obtener categorías existentes
  const existingCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, string>(); // "name_flowType" -> id
  existingCategories.forEach((cat) => {
    categoryMap.set(`${cat.name.toLowerCase()}_${cat.flowType}`, cat.id);
  });

  const categoryNamesList = Array.from(
    new Set(existingCategories.map((c) => c.name))
  );

  let importedCount = 0;
  let duplicateCount = 0;
  let failedCount = 0;

  for (const item of parsedPayloads) {
    try {
      // Chequeo de idempotencia por hash SHA-256
      const existingTx = await prisma.transaction.findUnique({
        where: { hash: item.hash },
      });

      if (existingTx) {
        duplicateCount++;
        continue;
      }

      let categoryId: string | null = null;
      let confidence = 0.9;
      let frequency = item.frequency as FrequencyType;
      let finalDescription = item.description;

      // Resolución de categoría
      const targetFlow = item.flowType as FlowType;
      const candidateKey = item.categoryNameCandidate
        ? `${item.categoryNameCandidate.toLowerCase()}_${targetFlow}`
        : "";

      if (candidateKey && categoryMap.has(candidateKey)) {
        categoryId = categoryMap.get(candidateKey)!;
      } else if (item.categoryNameCandidate) {
        // Crear categoría dinámicamente si no existe
        const newCat = await prisma.category.create({
          data: {
            name: item.categoryNameCandidate,
            flowType: targetFlow,
            defaultFrequency: frequency,
            isSystem: false,
          },
        });
        categoryId = newCat.id;
        categoryMap.set(candidateKey, newCat.id);
      } else {
        // Clasificación inteligente vía OmniRouter
        const classification = await omniRouter.classifyTransaction(
          item.description,
          Number(item.amount),
          item.flowType,
          { taxonomyCategories: categoryNamesList }
        );

        confidence = classification.confidence;
        frequency = classification.frequency as FrequencyType;
        finalDescription = classification.cleanMerchantName || item.description;

        const classifiedKey = `${classification.categoryName.toLowerCase()}_${classification.flowType}`;
        if (categoryMap.has(classifiedKey)) {
          categoryId = categoryMap.get(classifiedKey)!;
        } else {
          const newCat = await prisma.category.create({
            data: {
              name: classification.categoryName,
              flowType: classification.flowType as FlowType,
              defaultFrequency: frequency,
              isSystem: false,
            },
          });
          categoryId = newCat.id;
          categoryMap.set(classifiedKey, newCat.id);
        }
      }

      // Insertar transacción con estado PENDING_REVIEW para auditoría HITL
      await prisma.transaction.create({
        data: {
          hash: item.hash,
          date: item.date,
          description: finalDescription,
          rawDescription: item.rawDescription,
          amount: item.amount,
          flowType: item.flowType as FlowType,
          frequency,
          status: TransactionStatus.PENDING_REVIEW,
          source,
          confidenceScore: confidence,
          metadata: JSON.parse(JSON.stringify(item.metadata || {})),
          categoryId,
          batchId: batch.id,
        },
      });

      importedCount++;
    } catch (rowErr) {
      console.error("[ETL_ROW_ERROR]", rowErr);
      failedCount++;
    }
  }

  // 3. Actualizar estado del ImportBatch
  await prisma.importBatch.update({
    where: { id: batch.id },
    data: {
      importedRows: importedCount,
      failedRows: failedCount,
      status:
        failedCount === parsedPayloads.length
          ? BatchStatus.FAILED
          : BatchStatus.COMPLETED,
    },
  });

  revalidatePath("/");
  return {
    success: true,
    batchId: batch.id,
    totalRows: parsedPayloads.length,
    importedRows: importedCount,
    skippedDuplicates: duplicateCount,
    failedRows: failedCount,
    detectedBank: extraResult?.detectedBank,
    extractionTier: extraResult?.extractionTier,
  };
}

/**
 * Server Action para importar transacciones desde archivos CSV dual-flow.
 */
export async function importTransactionsCsvAction(
  formData: FormData
): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedDuplicates: 0,
        failedRows: 0,
        error: "No se proporcionó ningún archivo CSV.",
      };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parsedPayloads = parseTransactionsCsv(fileBuffer);

    return await persistNormalizedPayloads(
      file.name,
      TransactionSource.CSV_IMPORT,
      parsedPayloads
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado durante el procesamiento del CSV.";
    console.error("[CSV_IMPORT_FATAL]", error);
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedDuplicates: 0,
      failedRows: 0,
      error: message,
    };
  }
}

/**
 * Server Action para importar transacciones desde Cartolas y Estados de Cuenta PDF.
 */
export async function importTransactionsPdfAction(
  formData: FormData
): Promise<ImportResult> {
  try {
    const file = formData.get("file") as File | null;
    if (!file) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedDuplicates: 0,
        failedRows: 0,
        error: "No se proporcionó ningún archivo PDF.",
      };
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const parseResult = await parseTransactionsPdf(fileBuffer);

    return await persistNormalizedPayloads(
      file.name,
      TransactionSource.PDF_IMPORT,
      parseResult.transactions,
      {
        detectedBank: parseResult.bankName,
        extractionTier: parseResult.extractionTier,
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : "Error inesperado durante el procesamiento de la cartola PDF.";
    console.error("[PDF_IMPORT_FATAL]", error);
    return {
      success: false,
      totalRows: 0,
      importedRows: 0,
      skippedDuplicates: 0,
      failedRows: 0,
      error: message,
    };
  }
}
