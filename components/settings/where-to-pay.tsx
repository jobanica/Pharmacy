import Image from "next/image";
import { QrCode } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCentavos } from "@/lib/money";
import type { CollectionDetails } from "@/lib/billing/collection";

/**
 * Where to send the money, shown once the service agreement is signed and
 * directly above the receipt form — the owner scans, pays, then uploads.
 *
 * A Server Component: it only renders, and the QR URL is public.
 */
export function WhereToPay({
  details,
  amountCentavos,
  label,
}: {
  details: CollectionDetails;
  /** From the portal's commission rule. Null when it could not be reached. */
  amountCentavos: number | null;
  /** What the amount is for, e.g. "activation fee". */
  label: string;
}) {
  const rows = [
    details.gcash.enabled
      ? { key: "GCash", name: details.gcash.name, number: details.gcash.number }
      : null,
    details.maya.enabled
      ? { key: "Maya", name: details.maya.name, number: details.maya.number }
      : null,
    details.bank.enabled
      ? {
          key: details.bank.bankName || "Bank transfer",
          name: details.bank.name,
          number: details.bank.number,
        }
      : null,
  ].filter((r): r is { key: string; name: string; number: string } => r !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="size-4" />
          Where to send your {label}
        </CardTitle>
        <CardDescription>
          {amountCentavos !== null ? (
            <>
              Send <strong className="text-foreground">{formatCentavos(amountCentavos)}</strong>{" "}
              using any of the options below, then submit the receipt underneath.
            </>
          ) : (
            <>Pay using any of the options below, then submit the receipt underneath.</>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {details.qrUrl ? (
          <Image
            src={details.qrUrl}
            alt="Payment QR code"
            width={200}
            height={200}
            unoptimized
            className="shrink-0 self-center rounded-xl border bg-white p-3 sm:self-start"
          />
        ) : null}
        <div className="grid flex-1 gap-3 text-sm">
          {rows.map((r) => (
            <div key={r.key} className="grid gap-0.5">
              <div className="font-medium">{r.key}</div>
              {r.name ? <div className="text-muted-foreground">{r.name}</div> : null}
              {r.number ? <div className="font-mono text-xs">{r.number}</div> : null}
            </div>
          ))}
          {details.note ? (
            <p className="text-xs text-muted-foreground">{details.note}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
