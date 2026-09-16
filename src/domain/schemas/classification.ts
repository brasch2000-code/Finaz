import { z } from "zod";

export const FlowTypeEnum = z.enum(["INCOME", "EXPENSE"]);
export const FrequencyTypeEnum = z.enum(["FIJO", "RECURRENTE", "ESPORADICO"]);

export const CategorizationResultSchema = z.object({
  categoryName: z.string().min(1).describe("Categoría estandarizada que coincide con la taxonomía del sistema"),
  flowType: FlowTypeEnum.describe("Dirección del flujo de caja: INCOME (Ingreso) o EXPENSE (Gasto)"),
  frequency: FrequencyTypeEnum.describe("Periodicidad del gasto o ingreso: FIJO, RECURRENTE o ESPORADICO"),
  confidence: z.number().min(0).max(1).describe("Puntaje de confianza del modelo entre 0.00 y 1.00"),
  cleanMerchantName: z.string().describe("Nombre normalizado del comercio o destinatario limpio de códigos POS"),
  reasoning: z.string().max(250).describe("Explicación breve de la clasificación asignada"),
});

export type CategorizationResult = z.infer<typeof CategorizationResultSchema>;

export const BatchCategorizationRequestSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().optional(),
      description: z.string().min(1),
      amount: z.number(),
      flowHint: FlowTypeEnum.optional(),
    })
  ).min(1).max(50),
});

export type BatchCategorizationRequest = z.infer<typeof BatchCategorizationRequestSchema>;
