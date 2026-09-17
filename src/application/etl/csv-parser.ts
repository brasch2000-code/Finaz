import { createHash } from "crypto";
import { parse } from "csv-parse/sync";
import { Decimal } from "@prisma/client/runtime/library";

export interface LegacyCsvRow {
  Fecha?: string;
  Descripcion?: string;
  "Tipo Ingreso"?: string;
  Ingreso?: string | number;
  "Frecuencia Gasto"?: string;
  "Tipo Gasto"?: string;
  Gasto?: string | number;
  "Columna 1"?: string;
  [key: string]: unknown;
}

export interface NormalizedTransactionPayload {
  hash: string;
  date: Date;
  description: string;
  rawDescription: string;
  amount: Decimal;
  flowType: "INCOME" | "EXPENSE";
  frequency: "FIJO" | "RECURRENTE" | "ESPORADICO";
  categoryNameCandidate?: string;
  metadata: {
    rawNotes?: string;
    originalRowIndex: number;
    rawColumns: Record<string, unknown>;
  };
}

export function parseChileanCurrency(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return Math.abs(value);

  const str = String(value).trim();
  // Remove currency signs, spaces, dots as thousands separators
  const cleaned = str
    .replace(/[$CLP\s]/gi, "")
    .replace(/\.(?=\d{3})/g, "") // Remove thousands dots e.g. 15.000 -> 15000
    .replace(",", "."); // Convert decimal comma to dot if any

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : Math.abs(parsed);
}

const SPANISH_MONTH_MAP: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  set: "09",
  oct: "10",
  nov: "11",
  dic: "12",
};

export function parseDateFlexible(dateStr?: string | null): Date {
  if (!dateStr) return new Date();
  const trimmed = dateStr.trim();

  // 1. Handle DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (4-digit year)
  const ddmmyyyyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyyMatch) {
    const day = parseInt(ddmmyyyyMatch[1], 10);
    const month = parseInt(ddmmyyyyMatch[2], 10) - 1;
    const year = parseInt(ddmmyyyyMatch[3], 10);
    return new Date(Date.UTC(year, month, day, 12, 0, 0));
  }

  // 2. Handle DD/MM/YY, DD-MM-YY, DD.MM.YY (2-digit year, e.g. 14/08/26 -> 2026-08-14)
  const ddmmyyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-](\d{2})$/);
  if (ddmmyyMatch) {
    const day = parseInt(ddmmyyMatch[1], 10);
    const month = parseInt(ddmmyyMatch[2], 10) - 1;
    const shortYear = parseInt(ddmmyyMatch[3], 10);
    const fullYear = shortYear >= 70 ? 1900 + shortYear : 2000 + shortYear;
    return new Date(Date.UTC(fullYear, month, day, 12, 0, 0));
  }

  // 3. Handle DD/MM or DD-MM (without year, assume current year)
  const ddmmMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ddmmMatch) {
    const day = parseInt(ddmmMatch[1], 10);
    const month = parseInt(ddmmMatch[2], 10) - 1;
    const currentYear = new Date().getFullYear();
    return new Date(Date.UTC(currentYear, month, day, 12, 0, 0));
  }

  // 4. Handle Spanish textual months e.g. "14 AGO 2026", "14-AGO-26", "14 AGO"
  const textMonthMatch = trimmed.match(
    /^(\d{1,2})(?:[\/\-\s]+)([a-zA-Z]{3,4})(?:(?:[\/\-\s]+)(\d{2,4}))?$/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase().slice(0, 3);
    const monthNum = SPANISH_MONTH_MAP[mStr];
    if (monthNum) {
      const month = parseInt(monthNum, 10) - 1;
      let year = textMonthMatch[3] ? parseInt(textMonthMatch[3], 10) : new Date().getFullYear();
      if (year < 100) {
        year = year >= 70 ? 1900 + year : 2000 + year;
      }
      return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
  }

  // 5. Handle standard ISO strings (YYYY-MM-DD)
  const isoDate = new Date(trimmed);
  return isNaN(isoDate.getTime()) ? new Date() : isoDate;
}

export function mapFrequency(rawFreq?: string | null): "FIJO" | "RECURRENTE" | "ESPORADICO" {
  if (!rawFreq) return "ESPORADICO";
  const norm = rawFreq.trim().toUpperCase();
  if (norm.includes("FIJ")) return "FIJO";
  if (norm.includes("REC")) return "RECURRENTE";
  return "ESPORADICO";
}

export function generateTransactionHash(
  date: Date,
  description: string,
  amount: number,
  flowType: string,
  occurrenceIndex?: number
): string {
  const dateStr = date.toISOString().split("T")[0];
  const descStr = description.trim().toLowerCase().replace(/\s+/g, " ");
  const occurrenceSuffix = occurrenceIndex && occurrenceIndex > 0 ? `|#${occurrenceIndex}` : "";
  const rawKey = `${dateStr}|${descStr}|${amount.toFixed(2)}|${flowType}${occurrenceSuffix}`;
  return createHash("sha256").update(rawKey).digest("hex");
}

export function parseTransactionsCsv(
  fileContent: string | Buffer
): NormalizedTransactionPayload[] {
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as LegacyCsvRow[];

  const normalized: NormalizedTransactionPayload[] = [];

  records.forEach((row, index) => {
    const rawDesc =
      row.Descripcion?.trim() ||
      (typeof row.Description === "string" ? row.Description.trim() : undefined) ||
      (typeof row.Detalle === "string" ? row.Detalle.trim() : undefined) ||
      "Transacción Sin Descripción";

    const date = parseDateFlexible(
      typeof row.Fecha === "string"
        ? row.Fecha
        : typeof row.Date === "string"
        ? row.Date
        : undefined
    );
    const incomeAmount = parseChileanCurrency(row.Ingreso as string | number | undefined);
    const expenseAmount = parseChileanCurrency(row.Gasto as string | number | undefined);

    if (incomeAmount === 0 && expenseAmount === 0) {
      return; // Skip empty rows
    }

    const isIncome = incomeAmount > 0;
    const amountNum = isIncome ? incomeAmount : expenseAmount;
    const flowType: "INCOME" | "EXPENSE" = isIncome ? "INCOME" : "EXPENSE";
    const categoryName = isIncome
      ? typeof row["Tipo Ingreso"] === "string"
        ? row["Tipo Ingreso"].trim()
        : undefined
      : typeof row["Tipo Gasto"] === "string"
      ? row["Tipo Gasto"].trim()
      : undefined;

    const frequency = mapFrequency(
      (typeof row["Frecuencia Gasto"] === "string"
        ? row["Frecuencia Gasto"]
        : typeof row["Frecuencia"] === "string"
        ? row["Frecuencia"]
        : undefined)
    );
    const hash = generateTransactionHash(date, rawDesc, amountNum, flowType);

    normalized.push({
      hash,
      date,
      description: rawDesc,
      rawDescription: rawDesc,
      amount: new Decimal(amountNum),
      flowType,
      frequency,
      categoryNameCandidate: categoryName || undefined,
      metadata: {
        rawNotes:
          typeof row["Columna 1"] === "string"
            ? row["Columna 1"].trim()
            : undefined,
        originalRowIndex: index + 1,
        rawColumns: row,
      },
    });
  });

  return normalized;
}
