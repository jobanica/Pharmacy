"use client";

import * as React from "react";
import { Printer, Bluetooth, Monitor, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { PrinterType, ReceiptPaper } from "@/lib/branding";
import { readPrinterPrefs, writePrinterPrefs } from "@/lib/printer/prefs";

const PAPERS: ReceiptPaper[] = ["58mm", "80mm", "A4"];

export function PrinterDeviceSettings({
  defaultPrinterType,
  defaultPaper,
  defaultAutoPrint,
}: {
  defaultPrinterType: PrinterType;
  defaultPaper: ReceiptPaper;
  defaultAutoPrint: boolean;
}) {
  const [printerType, setPrinterType] = React.useState<PrinterType>(defaultPrinterType);
  const [paper, setPaper] = React.useState<ReceiptPaper>(defaultPaper);
  const [autoPrint, setAutoPrint] = React.useState<boolean>(defaultAutoPrint);
  const [connecting, setConnecting] = React.useState(false);
  const [connected, setConnected] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // Hydrate from this device's saved preferences (falling back to org defaults).
  React.useEffect(() => {
    const p = readPrinterPrefs();
    if (p.printerType) setPrinterType(p.printerType);
    if (p.paper) setPaper(p.paper);
    if (typeof p.autoPrint === "boolean") setAutoPrint(p.autoPrint);
    setLoaded(true);
  }, []);

  // Persist whenever a preference changes (after initial hydrate).
  React.useEffect(() => {
    if (!loaded) return;
    writePrinterPrefs({ printerType, paper, autoPrint });
  }, [loaded, printerType, paper, autoPrint]);

  async function connectBluetooth() {
    setConnecting(true);
    try {
      const { printViaBluetooth } = await import("@/lib/escpos/bluetooth");
      // A minimal ESC/POS init + feed acts as a connection + test.
      const bytes = new Uint8Array([0x1b, 0x40, 0x0a, 0x0a, 0x0a]);
      await printViaBluetooth(bytes);
      setConnected(true);
      toast.success("Bluetooth printer connected.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not connect";
      if (!/cancelled|user gesture|chooser/i.test(msg)) toast.error(msg);
    } finally {
      setConnecting(false);
    }
  }

  async function testPrint() {
    if (printerType === "bluetooth") {
      try {
        const { printViaBluetooth } = await import("@/lib/escpos/bluetooth");
        const text =
          "\x1b\x40" + // init
          "   *** TEST PRINT ***\n" +
          "  Printer is working!\n\n\n";
        const bytes = new TextEncoder().encode(text);
        await printViaBluetooth(bytes);
        toast.success("Test sent to Bluetooth printer.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Test print failed";
        if (!/cancelled|user gesture|chooser/i.test(msg)) toast.error(msg);
      }
      return;
    }
    window.print();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Printer className="size-5" />
          Printer
        </CardTitle>
        <CardDescription>
          These settings are saved on this device only, so each terminal can use
          its own printer. They override the pharmacy defaults for receipts printed here.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        <div className="grid gap-2">
          <Label>Printer connection</Label>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            {(["browser", "bluetooth"] as PrinterType[]).map((pt) => (
              <button
                key={pt}
                type="button"
                onClick={() => setPrinterType(pt)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  printerType === pt ? "border-primary ring-1 ring-primary" : "hover:bg-muted/40"
                }`}
              >
                {pt === "bluetooth" ? <Bluetooth className="size-4" /> : <Monitor className="size-4" />}
                {pt === "bluetooth" ? "Bluetooth" : "Browser / USB"}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {printerType === "bluetooth"
              ? "Prints directly to a paired Bluetooth thermal printer (Chrome/Edge on desktop or Android)."
              : "Opens the OS print dialog. Works with any USB, Wi-Fi, or network printer."}
          </p>
        </div>

        {printerType === "bluetooth" ? (
          <div>
            <Button type="button" variant="outline" onClick={connectBluetooth} disabled={connecting}>
              {connecting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : connected ? (
                <CheckCircle2 className="size-4 text-emerald-500" />
              ) : (
                <Bluetooth className="size-4" />
              )}
              {connected ? "Connected" : "Connect Bluetooth printer"}
            </Button>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label>Paper width</Label>
          <div className="flex gap-2">
            {PAPERS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPaper(p)}
                className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                  paper === p ? "border-primary ring-1 ring-primary" : "hover:bg-muted/40"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch checked={autoPrint} onCheckedChange={(v) => setAutoPrint(v)} />
          <span className="text-sm">Auto-print receipt after a sale</span>
        </div>

        <div>
          <Button type="button" variant="outline" onClick={testPrint}>
            <Printer className="size-4" />
            Test print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
