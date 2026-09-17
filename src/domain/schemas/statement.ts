import { z } from "zod";
import { FrequencyTypeEnum } from "./classification";

export const StatementMovementTypeEnum = z.enum(["CARGO", "ABONO"]);

export const StatementRowSchema = z.object({
  date: z
    .string()
    .describe("Fecha de la transacción en formato YYYY-MM-DD o DD/MM/YYYY"),
  description: z
    .string()
    .min(1)
    .describe("Descripción o detalle del movimiento o comercio"),
  amount: z
    .number()
    .positive()
    .describe("Monto absoluto de la transacción en CLP (positivo, sin signo)"),
  movementType: StatementMovementTypeEnum.describe(
    "CARGO (Gasto/Débito) o ABONO (Ingreso/Crédito/Depósito)"
  ),
  balance: z
    .number()
    .optional()
    .describe("Saldo resultante posterior al movimiento si está disponible"),
  categoryHint: z
    .string()
    .optional()
    .describe("Categoría sugerida si es evidente (ej. Supermercado, Salario, Servicios)"),
  frequencyHint: FrequencyTypeEnum.optional().describe(
    "Frecuencia sugerida: FIJO, RECURRENTE o ESPORADICO"
  ),
});

export type StatementRow = z.infer<typeof StatementRowSchema>;

export const StatementExtractionSchema = z.object({
  detectedBank: z
    .string()
    .optional()
    .describe("Nombre del banco emisor detectado (ej. Santander, Banco de Chile, BancoEstado, BCI)"),
  accountNumberMasked: z
    .string()
    .optional()
    .describe("Número de cuenta enmascarado si está visible"),
  statementPeriod: z
    .string()
    .optional()
    .describe("Período o mes de la cartola (ej. Abril 2026)"),
  rows: z.array(StatementRowSchema).describe("Lista de movimientos extraídos de la cartola"),
});

export type StatementExtractionResult = z.infer<typeof StatementExtractionSchema>;
