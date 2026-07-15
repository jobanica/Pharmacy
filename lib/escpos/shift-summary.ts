/**
 * ESC/POS encoder for the cashier shift summary slip.
 * Mirrors the layout shown in ShiftSummaryView.
 */

import type { ReceiptPaper } from "./receipt";
import type { ShiftSummary } from "@/lib/shifts/actions";

/** Encode a shift summary as an ESC/POS byte stream. */
export function encodeShiftSummary(s: ShiftSummary, paper: ReceiptPaper = "80mm"): Uint8Array {
  const os = s.overShortCentavos;
  const osText =
    os === 0 ? "—" : `${os > 0 ? "+" : ""}${peso(Math.abs(os))}`;

  // Reuse the same ESC/POS primitives by assembling a minimal ReceiptData-like
  // structure. But shift summary has a different layout, so we build it directly.
  const { EscPosBuilderInternal } = _internals;
  const w = paper === "58mm" ? 32 : 48;
  const b = new EscPosBuilderInternal().init();

  b.align("center");
  b.bold(true).doubleSize(true).line(s.storeName).doubleSize(false).bold(false);
  if (s.branchName) b.line(s.branchName);
  b.line("SHIFT SUMMARY");
  b.align("left").line(dashes(w));

  b.line(lr("Cashier", s.cashierName, w));
  b.line(lr("Opened", fmtDt(s.openedAt), w));
  b.line(lr("Closed", fmtDt(s.closedAt), w));
  b.line(dashes(w));

  b.line(lr("Transactions", String(s.salesCount), w));
  b.line(lr("Gross sales", peso(s.grossCentavos), w));
  b.line(lr("Discounts", `-${peso(s.discountCentavos)}`, w));
  b.bold(true).line(lr("Net sales", peso(s.netCentavos), w)).bold(false);
  b.line(dashes(w));

  b.line(lr("Opening cash", peso(s.openingCashCentavos), w));
  b.line(lr("Cash collected", peso(s.cashCollectedCentavos), w));
  b.line(lr("Expected cash", peso(s.openingCashCentavos + s.cashCollectedCentavos), w));
  b.line(lr("Closing cash", peso(s.closingCashCentavos), w));
  b.bold(true).line(lr("Over / Short", osText, w)).bold(false);

  if (s.paymentBreakdown && s.paymentBreakdown.length > 0) {
    b.line(dashes(w));
    b.line("BY PAYMENT METHOD");
    for (const p of s.paymentBreakdown) {
      b.line(lr(p.label, peso(p.centavos), w));
    }
  }

  if (s.cashBreakdown && s.cashBreakdown.length > 0) {
    b.line(dashes(w));
    b.line("CASH BREAKDOWN");
    for (const c of s.cashBreakdown) {
      const d = c.denomCentavos;
      const label = `P${d >= 100 ? d / 100 : (d / 100).toFixed(2)} x ${c.count}`;
      b.line(lr(label, peso(d * c.count), w));
    }
  }

  b.line(dashes(w)).align("center");
  b.line("Shift closing record");

  return b.cut().build();
}

// -- helpers (duplicated from receipt.ts to avoid coupling) -------------------

function peso(centavos: number): string {
  const sign = centavos < 0 ? "-" : "";
  const abs = Math.abs(centavos);
  const whole = Math.floor(abs / 100).toLocaleString("en-US");
  const frac = String(abs % 100).padStart(2, "0");
  return `${sign}P${whole}.${frac}`;
}

function lr(left: string, right: string, width: number): string {
  const space = width - left.length - right.length;
  if (space < 1) return `${left.slice(0, Math.max(0, width - right.length - 1))} ${right}`;
  return left + " ".repeat(space) + right;
}

const dashes = (w: number) => "-".repeat(w);

function fmtDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour12: true });
  } catch {
    return iso;
  }
}

// -- re-export the builder class internals so this file can use it ------------

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

class EscPosBuilderInternal {
  private bytes: number[] = [];
  raw(...b: number[]): this { this.bytes.push(...b); return this; }
  init(): this { return this.raw(ESC, 0x40); }
  align(mode: "left" | "center" | "right"): this {
    return this.raw(ESC, 0x61, mode === "center" ? 1 : mode === "right" ? 2 : 0);
  }
  bold(on: boolean): this { return this.raw(ESC, 0x45, on ? 1 : 0); }
  doubleSize(on: boolean): this { return this.raw(GS, 0x21, on ? 0x11 : 0x00); }
  text(s: string): this {
    for (const ch of fold(s)) this.bytes.push(ch.charCodeAt(0) & 0xff);
    return this;
  }
  line(s = ""): this { return this.text(s).raw(LF); }
  feed(n = 1): this { return this.raw(ESC, 0x64, n); }
  cut(): this { return this.feed(3).raw(GS, 0x56, 0x01); }
  build(): Uint8Array { return Uint8Array.from(this.bytes); }
}

function fold(s: string): string {
  return s.replace(/[₱]/g, "P").replace(/[×]/g, "x").replace(/[—–]/g, "-").replace(/[^\x20-\x7e]/g, "?");
}

// Expose via a namespace so encodeShiftSummary can access it without exporting the class.
const _internals = { EscPosBuilderInternal };
