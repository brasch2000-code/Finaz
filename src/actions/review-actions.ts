"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/infrastructure/db/prisma";
import { TransactionStatus, FlowType, FrequencyType } from "@prisma/client";

const UpdateTransactionGuard = z.object({
  id: z.string().min(1),
  description: z.string().min(1).max(255),
  amount: z.number().positive(),
  flowType: z.nativeEnum(FlowType),
  frequency: z.nativeEnum(FrequencyType),
  categoryId: z.string().min(1).optional().nullable(),
  newCategoryName: z.string().min(1).max(100).optional(),
});

export async function getAvailableCategoriesAction() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        flowType: true,
        defaultFrequency: true,
        colorHex: true,
      },
    });
    return { success: true, categories };
  } catch (error: unknown) {
    console.error("[GET_CATEGORIES_ERROR]", error);
    return { success: false, categories: [] };
  }
}

export async function verifyTransactionAction(
  rawInput: z.infer<typeof UpdateTransactionGuard>
) {
  try {
    const validated = UpdateTransactionGuard.parse(rawInput);

    return await prisma.$transaction(async (tx) => {
      const existing = await tx.transaction.findUnique({
        where: { id: validated.id },
      });

      if (!existing) {
        throw new Error("Transacción no encontrada.");
      }

      let finalCategoryId = validated.categoryId;

      if (!finalCategoryId && validated.newCategoryName) {
        const category = await tx.category.upsert({
          where: {
            name_flowType: {
              name: validated.newCategoryName.trim(),
              flowType: validated.flowType,
            },
          },
          create: {
            name: validated.newCategoryName.trim(),
            flowType: validated.flowType,
            defaultFrequency: validated.frequency,
          },
          update: {},
        });
        finalCategoryId = category.id;
      }

      const updated = await tx.transaction.update({
        where: { id: validated.id },
        data: {
          description: validated.description,
          amount: validated.amount,
          flowType: validated.flowType,
          frequency: validated.frequency,
          categoryId: finalCategoryId,
          status: TransactionStatus.VERIFIED,
          verifiedAt: new Date(),
          verifiedBy: "CURRENT_USER",
        },
      });

      // Append-only audit record
      await tx.transactionAudit.create({
        data: {
          transactionId: validated.id,
          previousState: JSON.parse(JSON.stringify(existing)),
          newState: JSON.parse(JSON.stringify(updated)),
          changeReason: "MANUAL_VERIFICATION",
        },
      });

      revalidatePath("/");
      return { success: true, transaction: updated };
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al verificar transacción.";
    console.error("[VERIFY_TRANSACTION_ERROR]", error);
    return { success: false, error: message };
  }
}

export async function rejectTransactionAction(
  id: string,
  reason: string = "USER_DISCARDED"
) {
  try {
    const existing = await prisma.transaction.findUnique({ where: { id } });
    if (!existing) throw new Error("Transacción no encontrada.");

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.REJECTED,
        verifiedAt: new Date(),
      },
    });

    await prisma.transactionAudit.create({
      data: {
        transactionId: id,
        previousState: JSON.parse(JSON.stringify(existing)),
        newState: JSON.parse(JSON.stringify(updated)),
        changeReason: reason,
      },
    });

    revalidatePath("/");
    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al descartar transacción.";
    console.error("[REJECT_TRANSACTION_ERROR]", error);
    return { success: false, error: message };
  }
}

export async function batchVerifyTransactionsAction(ids: string[]) {
  try {
    const result = await prisma.transaction.updateMany({
      where: {
        id: { in: ids },
        status: TransactionStatus.PENDING_REVIEW,
      },
      data: {
        status: TransactionStatus.VERIFIED,
        verifiedAt: new Date(),
        verifiedBy: "BATCH_USER",
      },
    });

    revalidatePath("/");
    return { success: true, count: result.count };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al verificar el lote de transacciones.";
    console.error("[BATCH_VERIFY_ERROR]", error);
    return { success: false, error: message };
  }
}
