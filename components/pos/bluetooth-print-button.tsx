"use client";

import * as React from "react";
import { Bluetooth, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { encodeReceipt, type ReceiptData } from "@/lib/escpos/receipt";
import { printViaBluetooth } from "@/lib/escpos/bluetooth";

export function BluetoothPrintButton({ receipt }: { receipt: ReceiptData }) {
  const [busy, setBusy] = React.useState(false);

  async function onPrint() {
    setBusy(true);
    try {
      await printViaBluetooth(encodeReceipt(receipt));
      toast.success("Sent to Bluetooth printer");
    } catch (err) {
      // User-cancelled chooser shows as a benign abort — don't alarm them.
      const msg = err instanceof Error ? err.message : "Bluetooth print failed";
      if (/cancelled|user gesture|chooser/i.test(msg)) {
        // no-op: they dismissed the device picker
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={onPrint} disabled={busy}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Bluetooth className="size-4" />}
      Bluetooth print
    </Button>
  );
}
