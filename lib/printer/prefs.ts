"use client";

/**
 * Per-device printer preferences, stored in localStorage so each POS terminal
 * (and each role, including cashiers) can configure its own printer without
 * needing org-wide write access. When a preference is unset, the app falls back
 * to the organization's branding defaults.
 */
import type { PrinterType, ReceiptPaper } from "@/lib/branding";

export type PrinterPrefs = {
  printerType: PrinterType;
  autoPrint: boolean;
  paper: ReceiptPaper;
};

const KEY = "printer_prefs_v1";

export function readPrinterPrefs(): Partial<PrinterPrefs> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<PrinterPrefs>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

export function writePrinterPrefs(prefs: Partial<PrinterPrefs>): void {
  if (typeof window === "undefined") return;
  const next = { ...readPrinterPrefs(), ...prefs };
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearPrinterPrefs(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
