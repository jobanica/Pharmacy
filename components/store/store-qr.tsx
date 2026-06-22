"use client";

import * as React from "react";
import QRCode from "react-qr-code";
import { Printer, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function StoreQr({ storeUrl, storeName }: { storeUrl: string; storeName: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-5" />
          QR Code Ordering
        </CardTitle>
        <CardDescription>
          Display or print this QR code in your pharmacy. Customers scan it to place orders for
          pickup or delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <div className="rounded-xl border bg-white p-4 print:border-0 print:p-0">
          <QRCode value={storeUrl} size={160} />
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1">
            <p className="text-sm font-medium">{storeName} — Online Orders</p>
            <p className="break-all text-xs text-muted-foreground">{storeUrl}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            Print QR code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
