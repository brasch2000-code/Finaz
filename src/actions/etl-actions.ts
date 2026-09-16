"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/infrastructure/db/prisma";
import { parseTransactionsCsv } from "@/application/etl/csv-parser";
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
  error?: string;
}

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

    if (parsedPayloads.length === 0) {
      return {
        success: false,
        totalRows: 0,
        importedRows: 0,
        skippedDuplicates: 0,
        failedRows: 0,
        error: "El archivo no contiene filas de transacciones válidas.",
      };
    }

    // 1. Create ImportBatch
    const batch = await prisma.importBatch.create({
      data: {
        filename: file.name,
        totalRows: parsedPayloads.length,
        status: BatchStatus.PROCESSING,
      },
    });

    // 2. Fetch existing categories
    const existingCategories = await prisma.category.findMany();
    const categoryMap = new Map<string, string>(); // "Name_FlowType" -> id
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
        // Check for idempotency duplication
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

        // Resolve Category
        const targetFlow = item.flowType as FlowType;
        const candidateKey = item.categoryNameCandidate
          ? `${item.categoryNameCandidate.toLowerCase()}_${targetFlow}`
          : "";

        if (candidateKey && categoryMap.has(candidateKey)) {
          categoryId = categoryMap.get(candidateKey)!;
        } else if (item.categoryNameCandidate) {
          // Create new category dynamically
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
          // Classify via OmniRouter
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

        // Insert Transaction with PENDING_REVIEW status for human-in-the-loop review
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
            source: TransactionSource.CSV_IMPORT,
            confidenceScore: confidence,
            metadata: JSON.parse(JSON.stringify(item.metadata)),
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

    // 3. Update ImportBatch status
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
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error inesperado durante el procesamiento del CSV.";
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
