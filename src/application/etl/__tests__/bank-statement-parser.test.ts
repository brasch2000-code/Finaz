import { describe, it, expect } from "vitest";
import {
  detectBank,
  parseSantanderStatementLines,
  parseStatementLinesUniversal,
} from "../bank-statement-parser";
import { parseDateFlexible } from "../csv-parser";

describe("Bank Statement Parser - Bank Detection", () => {
  it("should detect Banco Santander from statement headers and keywords", () => {
    const santanderHeader = `
      BANCO SANTANDER-CHILE
      RUT: 97.036.000-K
      CARTOLA HISTORICA CUENTA CORRIENTE
      Cuenta N° 0-000-1234567-8
      Titular: JUAN IGNACIO PEREZ
    `;

    const result = detectBank(santanderHeader);
    expect(result.bank).toBe("SANTANDER");
    expect(result.bankName).toContain("Santander");
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("should detect other Chilean banks and cards accurately", () => {
    const bciText = "CARTOLA CUENTA PRIMA BCI - BANCO DE CREDITO E INVERSIONES";
    expect(detectBank(bciText).bank).toBe("BCI");

    const chileText = "BANCO DE CHILE - ESTADO DE MOVIMIENTOS CTA CTE 97.004.000";
    expect(detectBank(chileText).bank).toBe("BANCO_CHILE");

    const estadoText = "BANCOESTADO - CARTOLA CUENTA RUT SALDO DISPONIBLE";
    expect(detectBank(estadoText).bank).toBe("BANCOESTADO");

    const falabellaText = "BANCO FALABELLA - ESTADO DE CUENTA TARJETA CMR PUNTOS";
    expect(detectBank(falabellaText).bank).toBe("FALABELLA");
  });

  it("should fallback to GENERIC_CHILEAN when bank is unknown", () => {
    const unknownText = "ESTADO FINANCIERO MENSUAL DE TRANSACCIONES";
    const result = detectBank(unknownText);
    expect(result.bank).toBe("GENERIC_CHILEAN");
    expect(result.confidence).toBe(0.5);
  });
});

describe("Bank Statement Parser - Date Flexibility", () => {
  it("should parse 2-digit years correctly (e.g. 14/08/26)", () => {
    const d1 = parseDateFlexible("14/08/26");
    expect(d1.toISOString()).toContain("2026-08-14");

    const d2 = parseDateFlexible("02-04-26");
    expect(d2.toISOString()).toContain("2026-04-02");
  });

  it("should parse Spanish textual dates correctly (e.g. 14 AGO 2026)", () => {
    const d1 = parseDateFlexible("14 AGO 2026");
    expect(d1.toISOString()).toContain("2026-08-14");

    const d2 = parseDateFlexible("05-MAY-26");
    expect(d2.toISOString()).toContain("2026-05-05");
  });
});

describe("Bank Statement Parser - Credit Card & Mixed Statements", () => {
  const sampleCreditCardText = `
    ESTADO DE CUENTA TARJETA DE CREDITO
    Periodo: 01/08/2026 al 31/08/2026
    PAGO MINIMO: $ 25.000   TOTAL FACTURADO: $ 185.000

    14/08/26 15/08/26 PARIS SANTIAGO CL $ 5.099 01/01
    14/08/26 CLParis 5.099,00 $5.099QOBUZ
    14/08/26 15/08/26 QOBUZ SANTIAGO CL $ 5.099 01/01
    18/08/2026 19/08/2026 SUPERMERCADO JUMBO SANTIAGO CL $ 64.990
    20/08/2026 UBER *TRIP SANTIAGO CL 4.500 00
    22/08/2026 SPOTIFY AB STOCKHOLM SE USD 5.99 $ 5.690
    25/08/2026 PAGO RECIBIDO GRACIAS -150.000
    28/08/26 30/08/26 FARMACIAS CRUZ VERDE 12.990
    01/09/2026 COMISION MANTENCION MENSUAL 3.500
  `;

  it("should parse all credit card transactions including dual dates and squished tokens", () => {
    const transactions = parseStatementLinesUniversal(sampleCreditCardText);

    expect(transactions.length).toBe(9);

    // 1. Paris
    expect(transactions[0].description).toBe("PARIS");
    expect(Number(transactions[0].amount)).toBe(5099);
    expect(transactions[0].flowType).toBe("EXPENSE");
    expect(transactions[0].date.toISOString()).toContain("2026-08-14");

    // 2. CLParis squished token
    expect(transactions[1].description).toBe("CLParis");
    expect(Number(transactions[1].amount)).toBe(5099);

    // 4. Jumbo
    expect(transactions[3].description).toBe("SUPERMERCADO JUMBO");
    expect(Number(transactions[3].amount)).toBe(64990);
    expect(transactions[3].flowType).toBe("EXPENSE");

    // 6. Spotify
    expect(transactions[5].description).toContain("SPOTIFY AB STOCKHOLM SE");
    expect(Number(transactions[5].amount)).toBe(5690);

    // 7. Pago Recibido (Income / Payment)
    expect(transactions[6].description).toBe("PAGO RECIBIDO GRACIAS");
    expect(Number(transactions[6].amount)).toBe(150000);
    expect(transactions[6].flowType).toBe("INCOME");

    // 8. Farmacias Cruz Verde
    expect(transactions[7].description).toBe("FARMACIAS CRUZ VERDE");
    expect(Number(transactions[7].amount)).toBe(12990);

    // 9. Comision Mantencion
    expect(transactions[8].description).toBe("COMISION MANTENCION MENSUAL");
    expect(Number(transactions[8].amount)).toBe(3500);
  });
});

describe("Bank Statement Parser - Banco Santander Regex Parser (Tier 1)", () => {
  const sampleSantanderText = `
    BANCO SANTANDER-CHILE
    CARTOLA DE CUENTA CORRIENTE EN MONEDA NACIONAL
    Cuenta: 12345678  Periodo: 01/04/2026 al 30/04/2026
    SALDO ANTERIOR: $ 1.500.000

    FECHA       DESCRIPCION                           CARGOS ($)   ABONOS ($)    SALDO ($)
    02/04/2026  COMPRA WEBPAY LIDER EXPRESS            45.990           0       1.454.010
    05/04/2026  TRANSFERENCIA DE MARCELO ALVAREZ            0     150.000       1.604.010
    10/04/2026  PAC ENEL DISTRIBUCION CHILE            32.400           0       1.571.610
    15/04/2026  GIRO CAJERO AUTOMATICO REDBANC         50.000           0       1.521.610
    25/04/2026  ABONO REMUNERACION EMPRESA SPA              0     980.000       2.501.610
    28/04/2026  COMISION MANTENCION CUENTA              5.990           0       2.495.620

    TOTAL CARGOS: $ 134.380   TOTAL ABONOS: $ 1.130.000
    SALDO FINAL: $ 2.495.620
    Página 1 de 1
  `;

  it("should parse Santander statement transactions with correct flows and amounts", () => {
    const transactions = parseSantanderStatementLines(sampleSantanderText);

    expect(transactions).toHaveLength(6);

    // 1. Cargo: Lider Express
    const tx1 = transactions[0];
    expect(tx1.description).toContain("LIDER EXPRESS");
    expect(tx1.flowType).toBe("EXPENSE");
    expect(Number(tx1.amount)).toBe(45990);
    expect(tx1.date.toISOString()).toContain("2026-04-02");

    // 2. Abono: Transferencia Recibida
    const tx2 = transactions[1];
    expect(tx2.description).toBe("TRANSFERENCIA DE MARCELO ALVAREZ");
    expect(tx2.flowType).toBe("INCOME");
    expect(Number(tx2.amount)).toBe(150000);

    // 3. Cargo: PAC Enel
    const tx3 = transactions[2];
    expect(tx3.description).toContain("ENEL DISTRIBUCION");
    expect(tx3.flowType).toBe("EXPENSE");
    expect(Number(tx3.amount)).toBe(32400);

    // 5. Abono: Remuneración
    const tx5 = transactions[4];
    expect(tx5.description).toBe("ABONO REMUNERACION EMPRESA SPA");
    expect(tx5.flowType).toBe("INCOME");
    expect(Number(tx5.amount)).toBe(980000);
    expect(tx5.frequency).toBe("FIJO");
  });

  it("should ignore header, summary and balance rows", () => {
    const rawHeader = `
      SALDO INICIAL 1.000.000
      TOTAL CARGOS 50.000
      TOTAL ABONOS 100.000
      Página 1 de 4
      RUT: 97.036.000-K
    `;
    const result = parseSantanderStatementLines(rawHeader);
    expect(result).toHaveLength(0);
  });
});
