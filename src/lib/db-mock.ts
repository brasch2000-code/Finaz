// src/lib/db-mock.ts
import {
  TransactionStatus,
  FlowType,
  FrequencyType,
  Currency,
} from "@prisma/client";

export interface MockTransaction {
  id: string;
  amount: number;
  currency: Currency;
  merchant: string;
  date: Date;
  status: TransactionStatus;
  frequency: FrequencyType;
  flowType: FlowType;
  categoryName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Adaptador de memoria de respaldo
class MockDB {
  private transactions: MockTransaction[] = [
    {
      id: "mock-1",
      amount: 15500,
      currency: Currency.CLP,
      merchant: "Supermercado Lider",
      date: new Date("2026-04-22T12:00:00Z"),
      status: TransactionStatus.PENDING_REVIEW,
      frequency: FrequencyType.ESPORADICO,
      flowType: FlowType.EXPENSE,
      categoryName: "Alimentacion",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: "mock-2",
      amount: 450000,
      currency: Currency.CLP,
      merchant: "Ayudantia",
      date: new Date("2026-04-01T08:00:00Z"),
      status: TransactionStatus.VERIFIED,
      frequency: FrequencyType.RECURRENTE,
      flowType: FlowType.INCOME,
      categoryName: "Ayudantia",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  async getPendingTransactions(): Promise<MockTransaction[]> {
    return this.transactions.filter(
      (t) => t.status === TransactionStatus.PENDING_REVIEW
    );
  }

  async getApprovedTransactions(): Promise<MockTransaction[]> {
    return this.transactions
      .filter((t) => t.status === TransactionStatus.VERIFIED)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
}

export const dbMock = new MockDB();
