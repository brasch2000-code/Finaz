import { describe, it, expect } from "vitest";
import {
  parseTransactionsCsv,
  generateTransactionHash,
} from "../csv-parser";
import { FlowType, FrequencyType } from "@prisma/client";
import { OmniRouter } from "@/infrastructure/llm/omni-router";
import { CategorizationResultSchema } from "@/domain/schemas/classification";

describe("ETL CSV Parser & Normalization", () => {
  const sampleCsv = `Fecha,Descripcion,Tipo Ingreso,Ingreso,Frecuencia Gasto,Tipo Gasto,Gasto,Columna 1
2026-04-22,Chaparrita combo,,,Recurrente,Comer mal,2590.0,
2026-04-23,Coquita,,,Recurrente,Alimentacion,1350.0,
2026-04-24,Kika cabros,,,Esporádico,Otros salida a comer,40000.0,
2026-04-25,Mesada,Mesada,150000.0,,,
2026-04-26,Ayudantia Marzo,Ayudantia,85000.0,,,`;

  it("should parse dual-flow Chilean CSV accurately", () => {
    const results = parseTransactionsCsv(sampleCsv);

    expect(results).toHaveLength(5);

    // Expense transaction verification
    const tx1 = results[0];
    expect(tx1.description).toBe("Chaparrita combo");
    expect(tx1.flowType).toBe(FlowType.EXPENSE);
    expect(Number(tx1.amount)).toBe(2590);
    expect(tx1.frequency).toBe(FrequencyType.RECURRENTE);
    expect(tx1.categoryNameCandidate).toBe("Comer mal");

    // Income transaction verification
    const tx4 = results[3];
    expect(tx4.description).toBe("Mesada");
    expect(tx4.flowType).toBe(FlowType.INCOME);
    expect(Number(tx4.amount)).toBe(150000);
    expect(tx4.categoryNameCandidate).toBe("Mesada");
  });

  it("should generate deterministic SHA-256 idempotency hashes", () => {
    const date = new Date("2026-04-22T00:00:00.000Z");
    const hash1 = generateTransactionHash(date, "Chaparrita combo", 2590, FlowType.EXPENSE);
    const hash2 = generateTransactionHash(date, "Chaparrita combo", 2590, FlowType.EXPENSE);
    const hashDifferentAmount = generateTransactionHash(date, "Chaparrita combo", 3590, FlowType.EXPENSE);

    expect(hash1).toBe(hash2);
    expect(hash1).not.toBe(hashDifferentAmount);
    expect(hash1).toHaveLength(64); // SHA-256 hex length
  });
});

describe("OmniRouter Rule Cache & Schema Verification", () => {
  it("should match known recurring merchants via deterministic rule cache (Tier 1)", async () => {
    const router = new OmniRouter();
    const envelope = await router.classifyWithEnvelope("Compra en Coquita snack", 1350, "EXPENSE");

    expect(envelope.resolutionTier).toBe("TIER1_CACHE");
    expect(envelope.result.categoryName).toBe("Alimentacion");
    expect(envelope.result.frequency).toBe("RECURRENTE");
    expect(envelope.result.confidence).toBeGreaterThanOrEqual(0.95);
    expect(envelope.latencyMs).toBeLessThan(50);

    // Validate Zod schema adherence
    const validated = CategorizationResultSchema.safeParse(envelope.result);
    expect(validated.success).toBe(true);
  });

  it("should classify multiple vendors in batch mode accurately", async () => {
    const router = new OmniRouter();
    const batchItems = [
      { description: "Uber trip 44", amount: 4500, flowHint: "EXPENSE" as const },
      { description: "Sueldo Empresa", amount: 800000, flowHint: "INCOME" as const },
      { description: "Pago Enel Luz", amount: 35000, flowHint: "EXPENSE" as const },
      { description: "Netflix Mensual", amount: 9500, flowHint: "EXPENSE" as const },
    ];

    const results = await router.classifyBatch(batchItems);
    expect(results).toHaveLength(4);

    expect(results[0].categoryName).toBe("Cargar Pase");
    expect(results[1].categoryName).toBe("Salario");
    expect(results[1].flowType).toBe("INCOME");
    expect(results[2].categoryName).toBe("Servicios Básicos");
    expect(results[3].categoryName).toBe("Suscripciones");
  });

  it("should fallback gracefully to heuristic when unknown and no API keys are present", async () => {
    const router = new OmniRouter();
    // Non-cached vendor string
    const result = await router.classifyTransaction("Comercio Extrano 987XYZ", 12300, "EXPENSE");

    expect(result).toBeDefined();
    expect(result.flowType).toBe("EXPENSE");
    expect(result.confidence).toBeLessThanOrEqual(1.0);
    const validated = CategorizationResultSchema.safeParse(result);
    expect(validated.success).toBe(true);
  });
});
