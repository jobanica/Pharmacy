"use client";

import * as React from "react";
import { FileCheck2, Receipt, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCentavos } from "@/lib/money";
import { submitReceiptAction, requestContractLinkAction } from "@/lib/portal/actions";
import { nextBillingMonth } from "@/lib/agent-kit/billing";
import { suspendsAt } from "@/lib/portal/grace";
import type { ManualPayment } from "@/lib/supabase/types";

const STATUS_LABEL: Record<ManualPayment["status"], string> = {
  submitted: "Waiting for review",
  confirmed: "Confirmed",
  rejected: "Rejected",
  reversed: "Reversed",
};

function monthLabel(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 7)}-01T00:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Manila",
  });
}

/**
 * Service agreement + bank-transfer receipts, for a pharmacy that signed up
 * through an agent. Shown only to those accounts: everyone else's billing page
 * is untouched.
 */
export function PortalPayments({
  contractStatus,
  minimumTermEndsAt,
  payments,
  activationPaid,
  paidUntil,
}: {
  contractStatus: "unsigned" | "signed";
  minimumTermEndsAt: string | null;
  payments: ManualPayment[];
  /** Whether an activation payment is already submitted or confirmed. */
  activationPaid: boolean;
  /** End of paid coverage from confirmed monthly receipts, ISO or null. */
  paidUntil: string | null;
}) {
  const [pending, start] = React.useTransition();
  const signed = contractStatus === "signed";
  const formRef = React.useRef<HTMLFormElement>(null);
  const [type, setType] = React.useState<"activation" | "monthly">(
    activationPaid ? "monthly" : "activation",
  );

  const suggestedMonth = nextBillingMonth(
    paidUntil ? new Date(paidUntil) : null,
    new Date(),
  );

  function sign() {
    start(async () => {
      const res = await requestContractLinkAction();
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      // The agreement is hosted by the portal; signing happens there.
      window.location.href = res.url;
    });
  }

  function submit(formData: FormData) {
    start(async () => {
      const res = await submitReceiptAction(formData);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Receipt submitted. We'll confirm it shortly.");
      formRef.current?.reset();
    });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            Service agreement
            <Badge variant={signed ? "default" : "outline"}>
              {signed ? "signed" : "not signed"}
            </Badge>
          </CardTitle>
          <CardDescription>
            {signed
              ? minimumTermEndsAt
                ? `Signed. Minimum term runs to ${new Date(minimumTermEndsAt).toLocaleDateString("en-PH", { dateStyle: "long", timeZone: "Asia/Manila" })}.`
                : "Signed. Thank you."
              : "Sign the agreement before submitting your activation payment. It opens in our agent portal."}
          </CardDescription>
        </CardHeader>
        {!signed ? (
          <CardContent>
            <Button onClick={sign} disabled={pending}>
              <FileCheck2 className="size-4" />
              Sign agreement
            </Button>
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="size-4" />
            Submit a payment
          </CardTitle>
          <CardDescription>
            Pay by bank transfer, then send us the receipt. The bank reference
            number is required — it is how we match your payment, and each one
            can only be submitted once.
          </CardDescription>
          {paidUntil ? (
            <p className="text-sm">
              {new Date(paidUntil) > new Date() ? (
                <span className="text-emerald-400">
                  Paid up to{" "}
                  {new Date(paidUntil).toLocaleDateString("en-PH", {
                    dateStyle: "long",
                    timeZone: "Asia/Manila",
                  })}
                  .
                </span>
              ) : (
                <span className="text-amber-400">
                  Your subscription lapsed on{" "}
                  {new Date(paidUntil).toLocaleDateString("en-PH", {
                    dateStyle: "long",
                    timeZone: "Asia/Manila",
                  })}
                  .{" "}
                  {suspendsAt(new Date(paidUntil)) > new Date() ? (
                    <>
                      Send a receipt before{" "}
                      {suspendsAt(new Date(paidUntil)).toLocaleDateString("en-PH", {
                        dateStyle: "long",
                        timeZone: "Asia/Manila",
                      })}{" "}
                      to keep your account open.
                    </>
                  ) : (
                    <>Send a receipt to reopen your account.</>
                  )}
                </span>
              )}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {!signed ? (
            <p className="text-sm text-muted-foreground">
              Sign the service agreement above to submit your activation payment.
            </p>
          ) : (
            <form ref={formRef} action={submit} className="grid gap-4 sm:max-w-md">
              <div className="grid gap-2">
                <Label htmlFor="type">This payment is for</Label>
                <select
                  id="type"
                  name="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as "activation" | "monthly")}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {!activationPaid ? (
                    <option value="activation">One-time activation</option>
                  ) : null}
                  <option value="monthly">Monthly subscription</option>
                </select>
              </div>

              {type === "monthly" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="billing_month_start">First month covered</Label>
                    <Input
                      id="billing_month_start"
                      name="billing_month_start"
                      type="month"
                      defaultValue={suggestedMonth}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="months_covered">Months paid</Label>
                    <Input
                      id="months_covered"
                      name="months_covered"
                      type="number"
                      min={1}
                      max={12}
                      defaultValue={1}
                      required
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="amount">Amount paid (₱)</Label>
                <Input id="amount" name="amount" inputMode="decimal" placeholder="800" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank_reference">Bank reference number</Label>
                <Input
                  id="bank_reference"
                  name="bank_reference"
                  placeholder="From your transfer confirmation"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="receipt">Receipt photo or screenshot</Label>
                <Input
                  id="receipt"
                  name="receipt"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  required
                />
                <p className="text-xs text-muted-foreground">JPEG, PNG or WebP, under 4 MB.</p>
              </div>
              <Button type="submit" disabled={pending} className="w-fit">
                Submit receipt
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {payments.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Payment history</CardTitle>
            <CardDescription>
              What you have submitted and where each one stands.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:px-6 sm:pb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="px-4 py-2 font-medium sm:px-0">Submitted</th>
                  <th className="px-4 py-2 font-medium">For</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Reference</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="px-4 py-2 sm:px-0">
                      {new Date(p.submitted_at).toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                        timeZone: "Asia/Manila",
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {p.type === "activation"
                        ? "Activation"
                        : `${monthLabel(p.billing_month_start)}${p.months_covered > 1 ? ` +${p.months_covered - 1} mo` : ""}`}
                    </td>
                    <td className="px-4 py-2">{formatCentavos(p.amount_centavos)}</td>
                    <td className="px-4 py-2 font-mono text-xs">{p.bank_reference}</td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          p.status === "confirmed"
                            ? "default"
                            : p.status === "submitted"
                              ? "outline"
                              : "destructive"
                        }
                      >
                        {STATUS_LABEL[p.status]}
                      </Badge>
                      {p.reason ? (
                        <span className="ml-2 text-xs text-muted-foreground">{p.reason}</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
