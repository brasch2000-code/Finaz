import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  CategorizationResultSchema,
  CategorizationResult,
} from "@/domain/schemas/classification";

export interface OmniRouterOptions {
  provider?: "anthropic" | "openai";
  taxonomyCategories?: string[];
  maxConcurrency?: number;
}

export interface ClassificationEnvelope {
  result: CategorizationResult;
  resolutionTier: "TIER1_CACHE" | "TIER2_ANTHROPIC" | "TIER2_OPENAI" | "TIER3_HEURISTIC";
  latencyMs: number;
}

// Caché determinístico de comercios y conceptos frecuentes (Sub-10ms bypass)
const DETERMINISTIC_RULE_CACHE: Record<
  string,
  {
    categoryName: string;
    flowType: "INCOME" | "EXPENSE";
    frequency: "FIJO" | "RECURRENTE" | "ESPORADICO";
    cleanMerchantName: string;
  }
> = {
  // Comida y salidas
  chaparrita: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Comida Rápida" },
  coquita: { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Bebidas / Snack" },
  kika: { categoryName: "Otros salida a comer", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Kika Salida" },
  mcdonald: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "McDonald's" },
  "burger king": { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Burger King" },
  wendy: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Wendy's" },
  kfc: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "KFC" },
  doggi: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Doggis" },
  pedidosya: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "PedidosYa" },
  rappi: { categoryName: "Comer mal", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Rappi" },
  starbucks: { categoryName: "Otros salida a comer", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Starbucks" },

  // Supermercados y alimentación
  lider: { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Supermercado Lider" },
  jumbo: { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Supermercado Jumbo" },
  unimarc: { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Unimarc" },
  "santa isabel": { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Santa Isabel" },
  tottus: { categoryName: "Alimentacion", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Tottus" },

  // Transporte
  metro: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Metro de Santiago" },
  bip: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Carga Tarjeta Bip" },
  uber: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Uber Viajes" },
  cabify: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Cabify" },
  didi: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "DiDi Viajes" },
  copec: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Pronto Copec" },
  shell: { categoryName: "Cargar Pase", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Shell Combustibles" },

  // Servicios y compromisos fijos
  enel: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Enel Distribución" },
  cge: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "CGE Electricidad" },
  "aguas andinas": { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Aguas Andinas" },
  vtr: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "VTR Telecomunicaciones" },
  entel: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Entel" },
  wom: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "WOM Móvil" },
  movistar: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Movistar" },
  arriendo: { categoryName: "Arriendo", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Pago de Arriendo" },
  gasto_comun: { categoryName: "Servicios Básicos", flowType: "EXPENSE", frequency: "FIJO", cleanMerchantName: "Gastos Comunes" },

  // Suscripciones
  netflix: { categoryName: "Suscripciones", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Netflix" },
  spotify: { categoryName: "Suscripciones", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Spotify" },
  "disney plus": { categoryName: "Suscripciones", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Disney+" },
  "amazon prime": { categoryName: "Suscripciones", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "Amazon Prime Video" },
  youtube: { categoryName: "Suscripciones", flowType: "EXPENSE", frequency: "RECURRENTE", cleanMerchantName: "YouTube Premium" },

  // Salud
  farmacia: { categoryName: "Salud y Farmacia", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Farmacia" },
  ahumada: { categoryName: "Salud y Farmacia", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Farmacias Ahumada" },
  cruz: { categoryName: "Salud y Farmacia", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Cruz Verde" },
  salcobrand: { categoryName: "Salud y Farmacia", flowType: "EXPENSE", frequency: "ESPORADICO", cleanMerchantName: "Salcobrand" },

  // Ingresos
  mesada: { categoryName: "Mesada", flowType: "INCOME", frequency: "FIJO", cleanMerchantName: "Mesada Familiar" },
  ayudantia: { categoryName: "Ayudantia", flowType: "INCOME", frequency: "RECURRENTE", cleanMerchantName: "Ayudantía Universitaria" },
  sueldo: { categoryName: "Salario", flowType: "INCOME", frequency: "FIJO", cleanMerchantName: "Salario Mensual" },
  remuneracion: { categoryName: "Salario", flowType: "INCOME", frequency: "FIJO", cleanMerchantName: "Remuneración Laboral" },
  honorarios: { categoryName: "Salario", flowType: "INCOME", frequency: "RECURRENTE", cleanMerchantName: "Boleta de Honorarios" },
  "pago deuda": { categoryName: "Pago deuda", flowType: "INCOME", frequency: "ESPORADICO", cleanMerchantName: "Devolución / Pago Deuda" },
};

export class OmniRouter {
  private primaryProvider: "anthropic" | "openai";

  constructor(primaryProvider: "anthropic" | "openai" = "anthropic") {
    this.primaryProvider = primaryProvider;
  }

  public async classifyWithEnvelope(
    description: string,
    amount: number,
    flowHint?: "INCOME" | "EXPENSE",
    options?: OmniRouterOptions
  ): Promise<ClassificationEnvelope> {
    const startTime = Date.now();
    const normDesc = description.toLowerCase().trim();

    // 1. Tier 1: Deterministic Match
    for (const [key, rule] of Object.entries(DETERMINISTIC_RULE_CACHE)) {
      if (normDesc.includes(key)) {
        return {
          result: {
            categoryName: rule.categoryName,
            flowType: rule.flowType,
            frequency: rule.frequency,
            confidence: 0.98,
            cleanMerchantName: rule.cleanMerchantName,
            reasoning: `Clasificación automática por regla exacta para "${key}".`,
          },
          resolutionTier: "TIER1_CACHE",
          latencyMs: Date.now() - startTime,
        };
      }
    }

    // 2. Tier 2: Primary LLM Provider
    const requestedProvider = options?.provider || this.primaryProvider;
    const taxonomyList =
      options?.taxonomyCategories?.join(", ") ||
      "Mesada, Ayudantia, Salario, Pago deuda, Otros Ingresos, Cargar Pase, Alimentacion, Comer mal, Otros salida a comer, Arriendo, Servicios Básicos, Salud y Farmacia, Suscripciones, Ocio y Discrecional";

    const systemPrompt = `Eres el motor de inteligencia y clasificación financiera para transacciones en Chile e internacionales.
Tu tarea es clasificar la descripción bancaria en una categoría estándar, dirección de flujo (INCOME o EXPENSE) y frecuencia (FIJO, RECURRENTE, ESPORADICO).

Categorías válidas del sistema: [${taxonomyList}]

Definición de frecuencias:
- FIJO: Pagos fijos regulares o compromisos estructurales (Mesada, Sueldo, Pase, Arriendo, Servicios).
- RECURRENTE: Gastos habituales de vida periódicos (Supermercado, Almuerzos diarios, Streaming, Comer mal).
- ESPORADICO: Gastos o ingresos imprevistos, salidas especiales, compras retail, emergencias de salud.

Reglas:
1. Normaliza el nombre del comercio eliminando ruido bancario (ej: 'COMPRA WEBPAY UBER TRIP 98' -> 'Uber', 'FARM AHUMADA SNTGO' -> 'Farmacias Ahumada').
2. Asigna un nivel de confianza realista (0.00 a 1.00). Si la descripción es ambigua, asigna un puntaje menor a 0.70.`;

    const userPrompt = `Transacción a clasificar:
- Descripción bruta: "${description}"
- Monto: $${amount} CLP
- Sugerencia de flujo: ${flowHint || "DESCONOCIDO"}`;

    try {
      const primaryModel =
        requestedProvider === "anthropic"
          ? anthropic("claude-3-5-haiku-20241022")
          : openai("gpt-4o-mini");

      const { object } = await generateObject({
        model: primaryModel,
        schema: CategorizationResultSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
        abortSignal: AbortSignal.timeout(6000),
      });

      return {
        result: object,
        resolutionTier: requestedProvider === "anthropic" ? "TIER2_ANTHROPIC" : "TIER2_OPENAI",
        latencyMs: Date.now() - startTime,
      };
    } catch (primaryError) {
      console.warn(`[OmniRouter] Primary provider (${requestedProvider}) failed, attempting fallback provider:`, primaryError);

      // Try Secondary LLM Provider
      const fallbackProvider = requestedProvider === "anthropic" ? "openai" : "anthropic";
      try {
        const fallbackModel =
          fallbackProvider === "anthropic"
            ? anthropic("claude-3-5-haiku-20241022")
            : openai("gpt-4o-mini");

        const { object } = await generateObject({
          model: fallbackModel,
          schema: CategorizationResultSchema,
          system: systemPrompt,
          prompt: userPrompt,
          temperature: 0.1,
          abortSignal: AbortSignal.timeout(6000),
        });

        return {
          result: object,
          resolutionTier: fallbackProvider === "anthropic" ? "TIER2_ANTHROPIC" : "TIER2_OPENAI",
          latencyMs: Date.now() - startTime,
        };
      } catch (fallbackError) {
        console.warn("[OmniRouter] Secondary provider failed, applying heuristic fallback:", fallbackError);

        // 3. Tier 3: Heuristic Fallback
        const isIncome =
          flowHint === "INCOME" ||
          normDesc.includes("transferencia recibida") ||
          normDesc.includes("abono") ||
          normDesc.includes("deposito");

        return {
          result: {
            categoryName: isIncome ? "Otros Ingresos" : "Otros Gastos",
            flowType: isIncome ? "INCOME" : "EXPENSE",
            frequency: "ESPORADICO",
            confidence: 0.5,
            cleanMerchantName: description.slice(0, 40),
            reasoning: "Clasificación heurística preventiva por indisponibilidad de API LLM.",
          },
          resolutionTier: "TIER3_HEURISTIC",
          latencyMs: Date.now() - startTime,
        };
      }
    }
  }

  public async classifyTransaction(
    description: string,
    amount: number,
    flowHint?: "INCOME" | "EXPENSE",
    options?: OmniRouterOptions
  ): Promise<CategorizationResult> {
    const envelope = await this.classifyWithEnvelope(description, amount, flowHint, options);
    return envelope.result;
  }

  public async classifyBatch(
    items: Array<{ description: string; amount: number; flowHint?: "INCOME" | "EXPENSE" }>,
    options?: OmniRouterOptions
  ): Promise<CategorizationResult[]> {
    const maxConcurrency = options?.maxConcurrency || 5;
    const results: CategorizationResult[] = [];

    for (let i = 0; i < items.length; i += maxConcurrency) {
      const chunk = items.slice(i, i + maxConcurrency);
      const chunkPromises = chunk.map((item) =>
        this.classifyTransaction(item.description, item.amount, item.flowHint, options)
      );
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }
}

export const omniRouter = new OmniRouter();
