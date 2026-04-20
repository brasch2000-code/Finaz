"use server";

import { dbMock } from "@/lib/db-mock";

export async function fetchGroups(type: string): Promise<string[]> {
  try {
    return await dbMock.getUsedGroups(type);
  } catch (error) {
    console.error("Error fetching groups:", error);
    return [];
  }
}
