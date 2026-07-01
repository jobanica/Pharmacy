"use client";

import * as React from "react";
import { toast } from "sonner";

import type { ReceiptData } from "@/lib/escpos/receipt";
import type { PrinterType } from "@/lib/branding";
import { readPrinterPrefs } from "@/lib/printer/prefs";

/**
 * Triggers auto-print once on mount.
 * - printerType "browser": opens window.print() after a short delay
 * - printerType "bluetooth": encodes ESC/POS and streams to the cached BT printer
 *
 * Per-device preferences (set on the Printer settings page) override the
 * org defaults passed in, so each terminal prints its own way.
 */
export function AutoPrint({
  enabled,
  printerType = "browser",
  receipt,
}: {
  enabled: boolean;
  printerType?: PrinterType;
  receipt?: ReceiptData;
}) {
  React.useEffect(() => {
    const prefs = readPrinterPrefs();
    const effectiveEnabled = typeof prefs.autoPrint === "boolean" ? prefs.autoPrint : enabled;
    const effectiveType = prefs.printerType ?? printerType;
    if (!effectiveEnabled) return;

    if (effectiveType === "bluetooth" && receipt) {
      let cancelled = false;
      const t = setTimeout(async () => {
        if (cancelled) return;
        try {
          const [{ encodeReceipt }, { printViaBluetooth }] = await Promise.all([
            import("@/lib/escpos/receipt"),
            import("@/lib/escpos/bluetooth"),
          ]);
          await printViaBluetooth(encodeReceipt(receipt));
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Bluetooth print failed";
          if (!/cancelled|user gesture|chooser/i.test(msg)) toast.error(msg);
        }
      }, 600);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // browser / USB / Wi-Fi — use OS print dialog
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [enabled, printerType, receipt]);

  return null;
}
