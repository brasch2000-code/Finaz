import { prisma } from "@/infrastructure/db/prisma";
import { TransactionStatus, FlowType, FrequencyType } from "@prisma/client";

export interface MonthlyCashFlowSummary {
  month: string; // "YYYY-MM"
  label: string; // "Abr 2026", etc.
  income: number;
  expense: number;
  netSavings: number;
  savingsRate: number;
}

export interface FrequencyExpenseBreakdown {
  month: string;
  label: string;
  fijo: number;
  recurrente: number;
  esporadico: number;
  total: number;
}

export interface CategoryBreakdown {
  categoryName: string;
  color: string;
  amount: number;
  percentage: number;
}

export interface PendingAnalyticsItem {
  id: string;
  date: string;
  description: string;
  rawDescription?: string;
  amount: number;
  flowType: FlowType;
  frequency: FrequencyType;
  confidenceScore: number;
  categoryId?: string | null;
  categoryName: string;
  color: string;
}

export interface RecentTransactionItem {
  id: string;
  date: string;
  description: string;
  amount: number;
  flowType: FlowType;
  frequency: FrequencyType;
  categoryName: string;
  color: string;
}

export interface DashboardMetrics {
  kpi: {
    totalIncome: number;
    totalExpense: number;
    netBalance: number;
    savingsRate: number;
    fixedCostRatio: number;
    pendingReviewCount: number;
    verifiedCount: number;
  };
  cashFlowTrend: MonthlyCashFlowSummary[];
  frequencyStacked: FrequencyExpenseBreakdown[];
  categoryDistribution: CategoryBreakdown[];
  pendingTransactions: PendingAnalyticsItem[];
  recentTransactions: RecentTransactionItem[];
}

export class FinancialAnalyticsService {
  public static async getDashboardMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<DashboardMetrics> {
    try {
      // Query verified transactions
      const verifiedTransactions = await prisma.transaction.findMany({
        where: {
          status: TransactionStatus.VERIFIED,
          ...(startDate && endDate
            ? { date: { gte: startDate, lte: endDate } }
            : {}),
        },
        include: { category: true },
        orderBy: { date: "asc" },
      });

      // Query pending transactions for the HITL review queue
      const pendingTransactions = await prisma.transaction.findMany({
        where: {
          status: TransactionStatus.PENDING_REVIEW,
        },
        include: { category: true },
        orderBy: { date: "desc" },
        take: 30,
      });

      const pendingCount = await prisma.transaction.count({
        where: { status: TransactionStatus.PENDING_REVIEW },
      });

      let totalIncome = 0;
      let totalExpense = 0;
      let totalFixedExpense = 0;

      const monthlyMap = new Map<string, { income: number; expense: number }>();
      const frequencyMap = new Map<
        string,
        { fijo: number; recurrente: number; esporadico: number }
      >();
      const categoryExpenseMap = new Map<string, { amount: number; color: string }>();

      verifiedTransactions.forEach((tx) => {
        const monthKey = tx.date.toISOString().substring(0, 7); // "YYYY-MM"
        const amount = Number(tx.amount);

        if (!monthlyMap.has(monthKey)) {
          monthlyMap.set(monthKey, { income: 0, expense: 0 });
          frequencyMap.set(monthKey, { fijo: 0, recurrente: 0, esporadico: 0 });
        }

        const m = monthlyMap.get(monthKey)!;
        const f = frequencyMap.get(monthKey)!;

        if (tx.flowType === FlowType.INCOME) {
          totalIncome += amount;
          m.income += amount;
        } else {
          totalExpense += amount;
          m.expense += amount;

          if (tx.frequency === "FIJO") {
            f.fijo += amount;
            totalFixedExpense += amount;
          } else if (tx.frequency === "RECURRENTE") {
            f.recurrente += amount;
          } else {
            f.esporadico += amount;
          }

          const catName = tx.category?.name || "Sin Categoría";
          const catColor = tx.category?.colorHex || "#6366f1";
          const existingCat = categoryExpenseMap.get(catName) || {
            amount: 0,
            color: catColor,
          };
          existingCat.amount += amount;
          categoryExpenseMap.set(catName, existingCat);
        }
      });

      const formatMonthLabel = (key: string) => {
        const [year, month] = key.split("-");
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${months[parseInt(month, 10) - 1]} ${year}`;
      };

      const cashFlowTrend: MonthlyCashFlowSummary[] = Array.from(
        monthlyMap.entries()
      ).map(([month, data]) => {
        const net = data.income - data.expense;
        const rate = data.income > 0 ? (net / data.income) * 100 : 0;
        return {
          month,
          label: formatMonthLabel(month),
          income: data.income,
          expense: data.expense,
          netSavings: net,
          savingsRate: Math.round(rate * 10) / 10,
        };
      });

      const frequencyStacked: FrequencyExpenseBreakdown[] = Array.from(
        frequencyMap.entries()
      ).map(([month, data]) => ({
        month,
        label: formatMonthLabel(month),
        fijo: data.fijo,
        recurrente: data.recurrente,
        esporadico: data.esporadico,
        total: data.fijo + data.recurrente + data.esporadico,
      }));

      const categoryDistribution: CategoryBreakdown[] = Array.from(
        categoryExpenseMap.entries()
      )
        .map(([categoryName, data]) => ({
          categoryName,
          color: data.color,
          amount: data.amount,
          percentage:
            totalExpense > 0
              ? Math.round((data.amount / totalExpense) * 1000) / 10
              : 0,
        }))
        .sort((a, b) => b.amount - a.amount);

      const netBalance = totalIncome - totalExpense;
      const savingsRate =
        totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;
      const fixedCostRatio =
        totalExpense > 0 ? (totalFixedExpense / totalExpense) * 100 : 0;

      const recentTransactions: RecentTransactionItem[] = verifiedTransactions
        .slice(-200)
        .reverse()
        .map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().split("T")[0],
          description: tx.description,
          amount: Number(tx.amount),
          flowType: tx.flowType,
          frequency: tx.frequency,
          categoryName: tx.category?.name || "Sin Categoría",
          color: tx.category?.colorHex || "#64748b",
        }));

      return {
        kpi: {
          totalIncome,
          totalExpense,
          netBalance,
          savingsRate: Math.round(savingsRate * 10) / 10,
          fixedCostRatio: Math.round(fixedCostRatio * 10) / 10,
          pendingReviewCount: pendingCount,
          verifiedCount: verifiedTransactions.length,
        },
        cashFlowTrend,
        frequencyStacked,
        categoryDistribution,
        pendingTransactions: pendingTransactions.map((tx) => ({
          id: tx.id,
          date: tx.date.toISOString().split("T")[0],
          description: tx.description,
          rawDescription: tx.rawDescription,
          amount: Number(tx.amount),
          flowType: tx.flowType,
          frequency: tx.frequency,
          confidenceScore: tx.confidenceScore ?? 0.85,
          categoryId: tx.categoryId,
          categoryName: tx.category?.name || "Sin Categoría",
          color: tx.category?.colorHex || "#6366f1",
        })),
        recentTransactions,
      };
    } catch (error) {
      console.error("[ANALYTICS_SERVICE_ERROR]", error);
      // Return empty default metrics if DB is fresh or unmigrated
      return {
        kpi: {
          totalIncome: 0,
          totalExpense: 0,
          netBalance: 0,
          savingsRate: 0,
          fixedCostRatio: 0,
          pendingReviewCount: 0,
          verifiedCount: 0,
        },
        cashFlowTrend: [],
        frequencyStacked: [],
        categoryDistribution: [],
        pendingTransactions: [],
        recentTransactions: [],
      };
    }
  }
}
