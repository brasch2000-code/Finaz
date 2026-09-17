import { extractText, getDocumentProxy } from "unpdf";
import { Decimal } from "@prisma/client/runtime/library";
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  NormalizedTransactionPayload,
  parseChileanCurrency,
  parseDateFlexible,
  generateTransactionHash,
  mapFrequency,
} from "./csv-parser";
import {
  StatementExtractionSchema,
  StatementRow,
} from "@/domain/schemas/statement";

export type ChileanBankId =
  | "SANTANDER"
  | "BANCO_CHILE"
  | "BANCOESTADO"
  | "BCI"
  | "SCOTIABANK"
  | "FALABELLA"
  | "ITAU"
  | "CENCOSUD"
  | "RIPLEY"
  | "TENPO"
  | "MACH"
  | "GENERIC_CHILEAN";

export interface BankDetectionResult {
  bank: ChileanBankId;
  bankName: string;
  confidence: number;
}

export interface PdfParseResult {
  transactions: NormalizedTransactionPayload[];
  detectedBank: ChileanBankId;
  bankName: string;
  extractionTier: "TIER1_DETERMINISTIC" | "TIER2_LLM_STRUCTURED";
  totalPages: number;
  warnings: string[];
}

// --------------------------------------------------------------------------
// 1. Detección Inteligente de Banco Emisor (Chilean Financial Entities)
// --------------------------------------------------------------------------
const BANK_SIGNATURES: Array<{
  id: ChileanBankId;
  name: string;
  keywords: string[];
  weight: number;
}> = [
  {
    id: "SANTANDER",
    name: "Banco Santander Chile",
    keywords: [
      "santander",
      "banco santander",
      "santander-chile",
      "97.036.000",
      "supergiro",
      "santander life",
      "cuenta corriente santander",
      "cartola historica santander",
      "latampass santander",
    ],
    weight: 1.0,
  },
  {
    id: "BANCO_CHILE",
    name: "Banco de Chile / Edwards",
    keywords: [
      "banco de chile",
      "banco edwards",
      "bancochile",
      "97.004.000",
      "cuenta corriente banco de chile",
      "dólares premio",
    ],
    weight: 1.0,
  },
  {
    id: "BANCOESTADO",
    name: "BancoEstado",
    keywords: [
      "bancoestado",
      "banco del estado",
      "cuenta rut",
      "cuentarut",
      "cuenta pro",
      "97.030.000",
    ],
    weight: 1.0,
  },
  {
    id: "BCI",
    name: "Banco de Crédito e Inversiones (BCI)",
    keywords: [
      "bci",
      "credito e inversiones",
      "97.015.000",
      "bci nova",
      "bci plus",
    ],
    weight: 1.0,
  },
  {
    id: "SCOTIABANK",
    name: "Scotiabank Chile",
    keywords: ["scotiabank", "scotia", "97.018.000", "scotiaclub"],
    weight: 1.0,
  },
  {
    id: "FALABELLA",
    name: "Banco Falabella / CMR",
    keywords: [
      "banco falabella",
      "cmr falabella",
      "cmr puntos",
      "falabella",
      "tarjeta cmr",
    ],
    weight: 1.0,
  },
  {
    id: "ITAU",
    name: "Banco Itaú Chile",
    keywords: ["itau", "itaú", "banco itau", "corpbanca", "itau personal bank"],
    weight: 1.0,
  },
  {
    id: "CENCOSUD",
    name: "Tarjeta Cencosud Scotiabank",
    keywords: ["cencosud", "tarjeta cencosud", "puntos cencosud"],
    weight: 1.0,
  },
  {
    id: "RIPLEY",
    name: "Banco Ripley",
    keywords: ["ripley", "banco ripley", "tarjeta ripley", "chevalier"],
    weight: 1.0,
  },
  {
    id: "TENPO",
    name: "Tenpo Prepago",
    keywords: ["tenpo", "tenpo prepago", "tenpocard"],
    weight: 1.0,
  },
  {
    id: "MACH",
    name: "MACH BCI",
    keywords: ["mach", "somos mach", "tarjeta mach"],
    weight: 1.0,
  },
];

export function detectBank(text: string): BankDetectionResult {
  const norm = text.toLowerCase();

  for (const sig of BANK_SIGNATURES) {
    let matchCount = 0;
    for (const kw of sig.keywords) {
      if (norm.includes(kw)) {
        matchCount++;
      }
    }
    if (matchCount > 0) {
      const confidence = Math.min(1.0, 0.6 + matchCount * 0.2);
      return {
        bank: sig.id,
        bankName: sig.name,
        confidence,
      };
    }
  }

  return {
    bank: "GENERIC_CHILEAN",
    bankName: "Cartola Bancaria Estándar",
    confidence: 0.5,
  };
}

// --------------------------------------------------------------------------
// 2. Reconstrucción Espacial de Filas por Coordenadas Y (Y-Banding)
// --------------------------------------------------------------------------
export async function extractStructuredTextFromPdf(
  pdfProxy: Awaited<ReturnType<typeof getDocumentProxy>>
): Promise<string> {
  let fullText = "";

  for (let pageNum = 1; pageNum <= pdfProxy.numPages; pageNum++) {
    const page = await pdfProxy.getPage(pageNum);
    const textContent = await page.getTextContent();
    const items = textContent.items as Array<{
      str: string;
      transform: number[];
    }>;

    if (!items || items.length === 0) continue;

    // Agrupar items por coordenada vertical Y con tolerancia de 3.5px
    const lineBuckets = new Map<number, Array<{ x: number; text: string }>>();

    for (const item of items) {
      if (!item.str || item.str.trim().length === 0) continue;
      const x = item.transform[4];
      const rawY = item.transform[5];
      // Bucket Y
      const y = Math.round(rawY / 3.5) * 3.5;

      if (!lineBuckets.has(y)) {
        lineBuckets.set(y, []);
      }
      lineBuckets.get(y)!.push({ x, text: item.str });
    }

    // Ordenar Y descendente (de arriba a abajo en la página)
    const sortedY = Array.from(lineBuckets.keys()).sort((a, b) => b - a);

    const pageLines = sortedY.map((y) => {
      const rowItems = lineBuckets.get(y)!;
      // Ordenar X ascendente (de izquierda a derecha en la fila)
      rowItems.sort((a, b) => a.x - b.x);
      return rowItems.map((i) => i.text.trim()).join(" ");
    });

    fullText += pageLines.join("\n") + "\n";
  }

  return fullText;
}

// --------------------------------------------------------------------------
// 3. Parser Universal de Líneas y Tokens de Estados de Cuenta
// --------------------------------------------------------------------------
const STATEMENT_EXCLUDE_PATTERNS = [
  /página\s+\d+/i,
  /cartola\s+de\s+cuenta/i,
  /estado\s+de\s+cuenta/i,
  /estado\s+de\s+movimientos/i,
  /saldo\s+anterior/i,
  /saldo\s+inicial/i,
  /saldo\s+final/i,
  /saldo\s+disponible/i,
  /total\s+cargos/i,
  /total\s+abonos/i,
  /total\s+pagar/i,
  /total\s+facturado/i,
  /pago\s+m[ií]nimo/i,
  /fecha\s+facturaci/i,
  /fecha\s+vencimiento/i,
  /fecha\s+l[ií]mite/i,
  /cupo\s+total/i,
  /cupo\s+utilizado/i,
  /cupo\s+disponible/i,
  /l[ií]nea\s+de\s+cr[eé]dito/i,
  /tasa\s+de\s+inter[eé]s/i,
  /cae\s*:/i,
  /rut\s*:\s*\d+/i,
  /cuenta\s+n[uú]mero/i,
  /tarjeta\s+n[uú]mero/i,
  /titular\s*:/i,
  /resumen\s+de\s+movimientos/i,
  /movimientos\s+nacionales/i,
  /movimientos\s+internacionales/i,
  /detalle\s+de\s+cargos/i,
  /detalle\s+de\s+abonos/i,
  /fecha\s+descripci/i,
  /fecha\s+transacci/i,
];

export function parseStatementLinesUniversal(
  text: string,
  bankHint?: ChileanBankId
): NormalizedTransactionPayload[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const payloads: NormalizedTransactionPayload[] = [];
  const occurrenceTracker = new Map<string, number>();

  rawLines.forEach((line, index) => {
    if (line.length < 5) return;

    // Verificar si es encabezado o resumen a ignorar
    if (STATEMENT_EXCLUDE_PATTERNS.some((pat) => pat.test(line))) {
      return;
    }

    // 1. Detectar Fecha inicial en la línea
    // Soporta: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, DD/MM/YY, DD-MM-YY, DD/MM, DD MMM YYYY, DD-MMM-YY
    const datePrefixMatch = line.match(
      /^(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?|\d{1,2}(?:[\/\-\s]+)(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*(?:(?:[\/\-\s]+)\d{2,4})?)/i
    );

    if (!datePrefixMatch) {
      return;
    }

    const rawDate1 = datePrefixMatch[1];
    let remaining = line.slice(datePrefixMatch[0].length).trim();

    // Si viene una segunda fecha inmediatamente (Fecha Proceso / Facturación)
    const date2Match = remaining.match(
      /^(\d{1,2}[\/\-\.]\d{1,2}(?:[\/\-\.]\d{2,4})?|\d{1,2}(?:[\/\-\s]+)(?:ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*(?:(?:[\/\-\s]+)\d{2,4})?)\s+/i
    );
    let rawDate2: string | undefined;
    if (date2Match) {
      rawDate2 = date2Match[1];
      remaining = remaining.slice(date2Match[0].length).trim();
    }

    // Normalizar la fecha
    const dateObj = parseDateFlexible(rawDate1);
    if (isNaN(dateObj.getTime())) {
      return;
    }

    // 2. Limpieza de tokens y extracción de montos y descripción
    // Remover cuotas del final (ej. "01/01", "01/03", "C/01")
    const cleanRemaining = remaining.replace(/\s+\d{1,2}\/\d{1,2}\s*$/, "").trim();

    // Tokenizar la parte restante
    const tokens = cleanRemaining.split(/\s+/);
    if (tokens.length === 0) return;

    // Buscar tokens numéricos de monto desde el final hacia el inicio
    const amountTokens: string[] = [];
    let i = tokens.length - 1;

    while (i >= 0) {
      const t = tokens[i];
      // Reconocer tokens de monto monetario (CLP / USD / Signos)
      if (
        /^[\+\-]?\$?\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?[\+\-]?$/i.test(t) ||
        /^\$?\d+(?:,\d+)?$/i.test(t) ||
        t === "0" ||
        /^USD\s*\d+/i.test(t) ||
        /^\$?\d+(?:\.\d{3})*[A-Z]+/i.test(t) // Squished tokens e.g. "$5.099QOBUZ"
      ) {
        amountTokens.unshift(t);
        i--;
      } else {
        break;
      }
    }

    const rawDescTokens = tokens.slice(0, i + 1);

    // Limpiar descripción de códigos sucios, auth codes iniciales y ciudades
    let cleanDesc = rawDescTokens
      .join(" ")
      .replace(/\s{2,}/g, " ")
      .replace(/^[\d\-]{4,}\s+/, "") // Remover código de autorización largo inicial
      .replace(/\s+[\$CLPUSD]+$/, "") // Remover signos de moneda colgantes al final
      .replace(
        /\s+(?:SANTIAGO|CHILE|CL|PROVINCIA|VALPARAISO|CONCEPCION|LAS CONDES|PROVIDENCIA|VITACURA)(?:\s+(?:SANTIAGO|CHILE|CL|PROVINCIA))*\s*$/gi,
        ""
      )
      .trim();

    let amount = 0;
    let flowType: "INCOME" | "EXPENSE" = "EXPENSE";

    const isExplicitIncomeDesc =
      /abono|sueldo|remuneraci[oó]n|transferencia\s+de\s+|transferencia\s+recibida|dep[oó]sito|devoluci[oó]n|interes\s+ganado|pago\s+recibido|pago\s+en\s+su\s+favor/i.test(
        cleanDesc
      );

    if (amountTokens.length > 0) {
      const nums: number[] = [];
      for (const at of amountTokens) {
        const cleanToken = at.replace(/^[^\d\+\-]+/, "").replace(/[^\d\.,\+\-]+$/, "");
        const val = parseChileanCurrency(cleanToken);
        if (val > 0) nums.push(val);
      }

      if (nums.length >= 3) {
        // [Cargo, Abono, Saldo]
        const cargo = nums[0];
        const abono = nums[1];
        if (cargo > 0 && abono === 0) {
          amount = cargo;
          flowType = "EXPENSE";
        } else if (abono > 0 && cargo === 0) {
          amount = abono;
          flowType = "INCOME";
        } else {
          amount = isExplicitIncomeDesc ? abono : cargo;
          flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
        }
      } else if (nums.length === 2) {
        // [Monto Original, Monto Facturado] o [Cargo, Abono]
        if (nums[0] === nums[1]) {
          amount = nums[0];
          flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
        } else if (nums[0] > 0 && nums[1] === 0) {
          amount = nums[0];
          flowType = "EXPENSE";
        } else if (nums[0] === 0 && nums[1] > 0) {
          amount = nums[1];
          flowType = "INCOME";
        } else {
          amount = nums[0];
          flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
        }
      } else if (nums.length === 1) {
        amount = nums[0];
        const firstToken = amountTokens[0];
        if (firstToken.startsWith("-") || firstToken.endsWith("-")) {
          flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
        } else if (firstToken.startsWith("+")) {
          flowType = "INCOME";
        } else {
          flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
        }
      }
    }

    // Fallback: Si no se encontró monto por tokens, intentar regex inline
    if (amount === 0 || !cleanDesc) {
      const inlineMatch = cleanRemaining.match(
        /(.+?)\s+([+\-]?\$?\s*\d{1,3}(?:\.\d{3})+(?:,\d+)?|[+\-]?\$?\s*\d+)\s*$/i
      );
      if (inlineMatch) {
        cleanDesc = inlineMatch[1].trim();
        amount = parseChileanCurrency(inlineMatch[2]);
        flowType = isExplicitIncomeDesc ? "INCOME" : "EXPENSE";
      }
    }

    if (amount <= 0 || cleanDesc.length < 2) {
      return;
    }

    // Control de ocurrencias idénticas en el mismo extracto
    const rawKey = `${dateObj.toISOString().split("T")[0]}_${cleanDesc.toLowerCase()}_${amount}_${flowType}`;
    const occurrenceIndex = occurrenceTracker.get(rawKey) || 0;
    occurrenceTracker.set(rawKey, occurrenceIndex + 1);

    const hash = generateTransactionHash(
      dateObj,
      cleanDesc,
      amount,
      flowType,
      occurrenceIndex
    );

    payloads.push({
      hash,
      date: dateObj,
      description: cleanDesc,
      rawDescription: line,
      amount: new Decimal(amount),
      flowType,
      frequency: mapFrequency(flowType === "INCOME" ? "FIJO" : "ESPORADICO"),
      metadata: {
        rawNotes: `${bankHint || "Universal"} PDF Line ${index + 1}`,
        originalRowIndex: index + 1,
        rawColumns: {
          rawDate: rawDate1,
          rawDate2,
          rawDescription: cleanDesc,
          tokens: amountTokens,
          sourceBank: bankHint || "GENERIC_CHILEAN",
        },
      },
    });
  });

  return payloads;
}

// --------------------------------------------------------------------------
// 4. Aliases para compatibilidad con código existente
// --------------------------------------------------------------------------
export function parseSantanderStatementLines(
  text: string
): NormalizedTransactionPayload[] {
  return parseStatementLinesUniversal(text, "SANTANDER");
}

export function parseGenericChileanStatementLines(
  text: string
): NormalizedTransactionPayload[] {
  return parseStatementLinesUniversal(text, "GENERIC_CHILEAN");
}

// --------------------------------------------------------------------------
// 5. Extracción Asistida por LLM (Tier 2 Structured Output Fallback)
// --------------------------------------------------------------------------
export async function extractStatementRowsWithLLM(
  text: string,
  bankHint?: string
): Promise<StatementRow[]> {
  const systemPrompt = `Eres un extractor experto de estados de cuenta y cartolas bancarias de Chile (Santander, Banco de Chile, BancoEstado, BCI, CMR Falabella, Scotiabank, Itaú, etc.).
Tu misión es extraer todos los movimientos y transacciones individuales presentes en el texto del documento.

Reglas:
1. Extrae cada transacción individual con:
   - date: Formato YYYY-MM-DD o DD/MM/YYYY.
   - description: Nombre del comercio o concepto limpio (ej. "Paris", "Lider Express", "PAC Enel", "Uber", "Spotify").
   - amount: Monto numérico entero positivo en CLP (sin signos, sin decimales ni símbolos de moneda).
   - movementType: "CARGO" si es gasto/débito/compra, "ABONO" si es ingreso/crédito/sueldo.
   - balance: Saldo posterior si está explícito.
2. Ignora filas que correspondan a "Saldo Anterior", "Saldo Inicial", "Total Cargos", "Total Abonos", "Cupo Utilizado", "Pago Mínimo" o subtotales de resumen.
3. Si la fecha viene en formato DD/MM, asume el año corriente.`;

  // Limitar longitud del texto enviado
  const trimmedText = text.slice(0, 20000);
  const userPrompt = `Banco sugerido: ${bankHint || "Desconocido"}\n\nTexto de la Cartola Bancaria:\n"""\n${trimmedText}\n"""`;

  try {
    // Intentar con Anthropic Claude 3.5 Haiku
    const { object } = await generateObject({
      model: anthropic("claude-3-5-haiku-20241022"),
      schema: StatementExtractionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.1,
      abortSignal: AbortSignal.timeout(18000),
    });

    return object.rows;
  } catch (anthropicError) {
    console.warn(
      "[StatementParser] Anthropic LLM extraction failed, attempting OpenAI fallback:",
      anthropicError
    );

    try {
      // Fallback a OpenAI gpt-4o-mini
      const { object } = await generateObject({
        model: openai("gpt-4o-mini"),
        schema: StatementExtractionSchema,
        system: systemPrompt,
        prompt: userPrompt,
        temperature: 0.1,
        abortSignal: AbortSignal.timeout(18000),
      });

      return object.rows;
    } catch (openaiError) {
      console.error(
        "[StatementParser] Both LLM providers failed for statement extraction:",
        openaiError
      );
      return [];
    }
  }
}

// --------------------------------------------------------------------------
// 6. Función Principal de Ingesta y Parseo de Cartolas PDF
// --------------------------------------------------------------------------
export async function parseTransactionsPdf(
  fileBuffer: Buffer | Uint8Array,
  options?: { forceBank?: ChileanBankId }
): Promise<PdfParseResult> {
  const warnings: string[] = [];
  const uint8 = new Uint8Array(fileBuffer);

  // Paso 1: Extracción de texto estructurado mediante Y-banding posicional
  // IMPORTANTE: getDocumentProxy transfiere (detach) el ArrayBuffer subyacente
  // al worker interno de unpdf, por lo que sólo puede invocarse UNA VEZ por
  // buffer. El proxy resultante se reutiliza para todas las operaciones.
  const pdfProxy = await getDocumentProxy(uint8);
  const totalPages = pdfProxy.numPages;

  let extractedText = "";
  try {
    extractedText = await extractStructuredTextFromPdf(pdfProxy);
  } catch (extractErr) {
    console.warn("[StatementParser] Spatial extraction failed, falling back to raw unpdf:", extractErr);
    const { text } = await extractText(pdfProxy, { mergePages: true });
    extractedText = text;
  }

  if (!extractedText || extractedText.trim().length === 0) {
    throw new Error(
      "No fue posible extraer texto del PDF. Asegúrese de que el documento no esté protegido por contraseña ni sea una imagen escaneada sin capa de texto."
    );
  }

  // Paso 2: Detección del banco emisor
  const detection = options?.forceBank
    ? {
        bank: options.forceBank,
        bankName:
          BANK_SIGNATURES.find((b) => b.id === options.forceBank)?.name ||
          "Banco Seleccionado",
        confidence: 1.0,
      }
    : detectBank(extractedText);

  // Paso 3: Tier 1 - Parser Determinístico Universal
  const deterministicRows = parseStatementLinesUniversal(
    extractedText,
    detection.bank
  );

  const lineCount = extractedText.split(/\r?\n/).filter((l) => l.trim().length > 0).length;

  // Criterio de Calidad (Quality Gate):
  // Si encontramos transacciones suficientes o el documento es muy breve
  const isSufficientDeterministic =
    deterministicRows.length >= 2 ||
    (deterministicRows.length === 1 && lineCount <= 10);

  if (isSufficientDeterministic) {
    return {
      transactions: deterministicRows,
      detectedBank: detection.bank,
      bankName: detection.bankName,
      extractionTier: "TIER1_DETERMINISTIC",
      totalPages,
      warnings,
    };
  }

  // Paso 4: Tier 2 - Fallback Inteligente con LLM Structured Output
  console.info(
    `[StatementParser] Deterministic parser found ${deterministicRows.length} rows in ${lineCount} lines. Escalating to Tier 2 LLM extraction for ${detection.bankName}...`
  );

  const llmRows = await extractStatementRowsWithLLM(
    extractedText,
    detection.bankName
  );

  if (llmRows && llmRows.length > 0) {
    const occurrenceTracker = new Map<string, number>();

    const normalizedLlmRows: NormalizedTransactionPayload[] = llmRows.map(
      (row, idx) => {
        const date = parseDateFlexible(row.date);
        const flowType = row.movementType === "ABONO" ? "INCOME" : "EXPENSE";

        const rawKey = `${date.toISOString().split("T")[0]}_${row.description.toLowerCase()}_${row.amount}_${flowType}`;
        const occurrenceIndex = occurrenceTracker.get(rawKey) || 0;
        occurrenceTracker.set(rawKey, occurrenceIndex + 1);

        const hash = generateTransactionHash(
          date,
          row.description,
          row.amount,
          flowType,
          occurrenceIndex
        );

        return {
          hash,
          date,
          description: row.description,
          rawDescription: `${row.date} | ${row.description} | $${row.amount} (${row.movementType})`,
          amount: new Decimal(row.amount),
          flowType,
          frequency:
            row.frequencyHint ||
            (flowType === "INCOME" ? "FIJO" : "ESPORADICO"),
          categoryNameCandidate: row.categoryHint,
          metadata: {
            rawNotes: `LLM Extracted Row ${idx + 1}`,
            originalRowIndex: idx + 1,
            rawColumns: {
              extractedRow: row,
              sourceBank: detection.bank,
              extractionMethod: "AI_SDK_TIER2",
            },
          },
        };
      }
    );

    return {
      transactions: normalizedLlmRows,
      detectedBank: detection.bank,
      bankName: detection.bankName,
      extractionTier: "TIER2_LLM_STRUCTURED",
      totalPages,
      warnings,
    };
  }

  // Si el LLM no devolvió filas (o no hay API keys configuradas) pero teníamos al menos 1 fila determinística
  if (deterministicRows.length > 0) {
    warnings.push(
      `Se extrajeron ${deterministicRows.length} movimientos de manera preliminar. Para cartolas no convencionales, active una API Key de LLM para extracción profunda.`
    );
    return {
      transactions: deterministicRows,
      detectedBank: detection.bank,
      bankName: detection.bankName,
      extractionTier: "TIER1_DETERMINISTIC",
      totalPages,
      warnings,
    };
  }

  throw new Error(
    `No se pudieron detectar transacciones en la cartola bancaria (${detection.bankName}). Verifique que el archivo contenga movimientos y texto legible.`
  );
}
