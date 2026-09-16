"use server";

import { prisma } from "@/infrastructure/db/prisma";
import { FlowType } from "@prisma/client";

export async function fetchGroups(type: string): Promise<string[]> {
  try {
    const flowType =
      type.toUpperCase() === "INGRESO" || type.toUpperCase() === "INCOME"
        ? FlowType.INCOME
        : FlowType.EXPENSE;

    const categories = await prisma.category.findMany({
      where: { flowType },
      select: { name: true },
      orderBy: { name: "asc" },
    });

    return categories.map((c) => c.name);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}
