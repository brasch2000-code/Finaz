// src/lib/db-mock.ts
import { Transaction, TransactionStatus, TransactionFrequency } from "@prisma/client";

// Adaptador temporal de la base de datos en memoria para el MVP
class MockDB {
  private transactions: Transaction[] = [
    {
      id: "mock-1",
      amount: 15500,
      currency: "CLP",
      merchant: "Supermercado Lider",
      date: new Date("2024-05-10T12:00:00Z"),
      status: TransactionStatus.PENDING_REVIEW,
      frequency: TransactionFrequency.ONE_TIME,
      group: "Supermercado",
      type: "GASTO",
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      id: "mock-2",
      amount: 450000,
      currency: "CLP",
      merchant: "Empleador S.A.",
      date: new Date("2024-05-01T08:00:00Z"),
      status: TransactionStatus.APPROVED,
      frequency: TransactionFrequency.RECURRING,
      group: "Salario",
      type: "INGRESO",
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  async getPendingTransactions(): Promise<Transaction[]> {
    return this.transactions.filter(t => t.status === TransactionStatus.PENDING_REVIEW);
  }

  async getApprovedBalance(): Promise<number> {
    return this.transactions
      .filter(t => t.status === TransactionStatus.APPROVED)
      .reduce((acc, t) => {
        if (t.type === "GASTO") return acc - t.amount;
        if (t.type === "INGRESO") return acc + t.amount;
        return acc;
      }, 0);
  }

  async updateTransactionStatus(id: string, status: TransactionStatus): Promise<Transaction | undefined> {
    const idx = this.transactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.transactions[idx].status = status;
      this.transactions[idx].updatedAt = new Date();
      return this.transactions[idx];
    }
  }

  async createTransaction(data: Omit<Transaction, "id" | "createdAt" | "updatedAt">): Promise<Transaction> {
    const newTx: Transaction = {
      ...data,
      id: `mock-${Date.now()}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.transactions.push(newTx);
    return newTx;
  }
}

export const dbMock = new MockDB();
