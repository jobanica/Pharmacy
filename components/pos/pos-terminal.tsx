"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { completeSale } from "@/lib/pos/actions";
import { CustomerPicker, type Customer } from "@/components/pos/customer-picker";
import { formatCentavos, pesosToCentavos, centavosToPesos } from "@/lib/money";
import type { DiscountType, PaymentMethodValue } from "@/lib/validation/pos";
import { PAYMENT_METHODS } from "@/lib/validation/pos";
import { RxDialog } from "@/components/pos/rx-dialog";

export type SellableProduct = {
  id: string;
  name: string;
  generic_name: string | null;
  sku: string | null;
  barcode: string | null;
  unit: string;
  default_price_centavos: number;
  on_hand: number;
  requires_prescription: boolean;
};

type CartLine = { product: SellableProduct; qty: number };
type TenderRow = { method: PaymentMethodValue; amount: string };

const METHOD_LABELS: Record<PaymentMethodValue, string> = {
  cash: "Cash",
  card: "Card",
  gcash: "GCash",
  maya: "Maya",
  other: "Other",
};

export function PosTerminal({
  products,
  branchName,
  customers,
  pesoPerPoint,
  vatRatePct = 12,
  tracksInventory = true,
}: {
  products: SellableProduct[];
  branchName: string;
  customers: Customer[];
  pesoPerPoint: number;
  vatRatePct?: number;
  /** When false (Free plan), products sell without stock limits. */
  tracksInventory?: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [cart, setCart] = React.useState<Map<string, CartLine>>(new Map());
  const [discount, setDiscount] = React.useState("");
  const [discountType, setDiscountType] = React.useState<DiscountType>("none");
  const [beneficiaryIdNo, setBeneficiaryIdNo] = React.useState("");
  const [beneficiaryName, setBeneficiaryName] = React.useState("");
  const [tenders, setTenders] = React.useState<TenderRow[]>([{ method: "cash", amount: "" }]);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [redeemPoints, setRedeemPoints] = React.useState(0);
  const [rxDialogOpen, setRxDialogOpen] = React.useState(false);
  const [prescriptionId, setPrescriptionId] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  const results = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.generic_name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q),
      )
      .slice(0, 30);
  }, [search, products]);

  function addToCart(p: SellableProduct) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(p.id);
      const qty = (line?.qty ?? 0) + 1;
      if (tracksInventory && qty > p.on_hand) {
        toast.error(`Only ${p.on_hand} ${p.unit}(s) of ${p.name} in stock`);
        return prev;
      }
      next.set(p.id, { product: p, qty });
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(id);
      if (!line) return prev;
      if (qty <= 0) {
        next.delete(id);
      } else if (tracksInventory && qty > line.product.on_hand) {
        toast.error(`Only ${line.product.on_hand} in stock`);
        return prev;
      } else {
        next.set(id, { ...line, qty });
      }
      return next;
    });
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;
    // Barcode scanners type the code then Enter — match exact first.
    const exact = products.find(
      (p) => p.barcode?.toLowerCase() === q || p.sku?.toLowerCase() === q,
    );
    const target = exact ?? (results.length === 1 ? results[0] : undefined);
    if (target) {
      addToCart(target);
      setSearch("");
    }
  }

  const lines = [...cart.values()];
  const subtotal = lines.reduce(
    (s, l) => s + l.product.default_price_centavos * l.qty,
    0,
  );

  // SC/PWD: server-authoritative formula mirrored here for preview.
  // discount = price - round(price / (1+vat/100) * 0.80), summed per item×qty.
  const scPwdDiscount = React.useMemo(() => {
    if (discountType !== "sc" && discountType !== "pwd") return 0;
    const divisor = 1 + vatRatePct / 100;
    return lines.reduce(
      (s, l) =>
        s +
        (l.product.default_price_centavos -
          Math.round((l.product.default_price_centavos / divisor) * 0.8)) *
          l.qty,
      0,
    );
  }, [discountType, lines, vatRatePct]);

  const discountCentavos =
    discountType === "sc" || discountType === "pwd"
      ? Math.min(scPwdDiscount, subtotal)
      : Math.min(discount ? pesosToCentavos(discount) : 0, subtotal);

  const maxRedeemable = customer
    ? Math.min(customer.points_balance, Math.floor((subtotal - discountCentavos) / 100))
    : 0;
  const effectiveRedeem = Math.min(redeemPoints, Math.max(maxRedeemable, 0));
  const redeemCentavos = effectiveRedeem * 100;
  const total = Math.max(subtotal - discountCentavos - redeemCentavos, 0);
  const tenderedCentavos = tenders.reduce(
    (s, t) => s + (t.amount ? pesosToCentavos(t.amount) : 0),
    0,
  );
  const change = tenderedCentavos - total;
  const hasRxItems = lines.some((l) => l.product.requires_prescription);
  const rxSatisfied = !hasRxItems || prescriptionId != null;
  const canComplete = lines.length > 0 && change >= 0 && rxSatisfied && !pending;

  function checkout() {
    if (!canComplete) return;
    startTransition(async () => {
      const validTenders = tenders
        .map((t) => ({ method: t.method, amountCentavos: t.amount ? pesosToCentavos(t.amount) : 0 }))
        .filter((t) => t.amountCentavos > 0);
      const res = await completeSale({
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
        discountCentavos,
        amountTenderedCentavos: 0,
        customerId: customer?.id ?? null,
        redeemPoints: effectiveRedeem,
        discountType,
        beneficiaryIdNo: beneficiaryIdNo || null,
        beneficiaryName: beneficiaryName || null,
        prescriptionId,
        tenders: validTenders,
      });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Sale completed");
      router.push(`/pos/receipt/${res.saleId}`);
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
      {/* Product picker */}
      <Card>
        <CardContent className="p-4">
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Scan barcode or search name / SKU…"
              className="pl-8"
            />
          </div>
          <div className="grid max-h-[34vh] gap-1 overflow-y-auto sm:grid-cols-2 lg:max-h-[60vh]">
            {results.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">
                {tracksInventory
                  ? "No matching products with stock."
                  : "No matching products. Add products in the catalog."}
              </p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">
                      {p.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.generic_name ?? p.sku ?? ""}
                      {tracksInventory ? ` · ${p.on_hand} ${p.unit}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-medium">
                    {formatCentavos(p.default_price_centavos)}
                  </span>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cart */}
      <Card className="flex flex-col">
        <CardContent className="flex flex-1 flex-col gap-3 p-4">
          <div className="flex items-center gap-2 font-medium">
            <ShoppingCart className="size-4" />
            Cart
            <Badge variant="secondary" className="ml-auto">
              {branchName}
            </Badge>
          </div>

          <div className="min-h-[140px] flex-1 divide-y overflow-y-auto">
            {lines.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Cart is empty. Scan or tap a product.
              </p>
            ) : (
              lines.map((l) => (
                <div key={l.product.id} className="flex items-center gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {l.product.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCentavos(l.product.default_price_centavos)} ×{" "}
                      {l.qty} = {formatCentavos(l.product.default_price_centavos * l.qty)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.product.id, l.qty - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{l.qty}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.product.id, l.qty + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive"
                      onClick={() => setQty(l.product.id, 0)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <CustomerPicker
            customers={customers}
            selected={customer}
            onSelect={setCustomer}
            redeemPoints={redeemPoints}
            onRedeemChange={setRedeemPoints}
            maxRedeemable={maxRedeemable}
          />

          <div className="grid gap-2 border-t pt-3 text-sm">
            <Row label="Subtotal" value={formatCentavos(subtotal)} />

            {/* Discount type */}
            <div className="flex items-center justify-between gap-2">
              <Label>Discount type</Label>
              <select
                value={discountType}
                onChange={(e) => {
                  setDiscountType(e.target.value as DiscountType);
                  setDiscount("");
                }}
                className="h-8 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="none">None</option>
                <option value="sc">Senior Citizen (SC)</option>
                <option value="pwd">PWD</option>
                <option value="manual">Manual</option>
              </select>
            </div>

            {(discountType === "sc" || discountType === "pwd") ? (
              <div className="grid gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/5 p-2">
                <p className="text-[11px] text-amber-400">
                  {discountType === "sc" ? "RA 9994" : "RA 10754"}: 20% off net price + VAT exempt
                </p>
                <Input
                  value={beneficiaryName}
                  onChange={(e) => setBeneficiaryName(e.target.value)}
                  placeholder={discountType === "sc" ? "Senior citizen name" : "PWD name"}
                  className="h-8 text-sm"
                />
                <Input
                  value={beneficiaryIdNo}
                  onChange={(e) => setBeneficiaryIdNo(e.target.value)}
                  placeholder={discountType === "sc" ? "OSCA ID no." : "PWD ID no."}
                  className="h-8 text-sm"
                />
              </div>
            ) : null}

            {discountType === "manual" ? (
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="discount">Discount (₱)</Label>
                <Input
                  id="discount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-8 w-28 text-right"
                />
              </div>
            ) : null}
            {discountCentavos > 0 ? (
              <Row
                label={discountType === "sc" ? "SC Discount (20%)" : discountType === "pwd" ? "PWD Discount (20%)" : "Discount"}
                value={`−${formatCentavos(discountCentavos)}`}
                className="text-amber-300"
              />
            ) : null}
            {effectiveRedeem > 0 ? (
              <Row
                label={`Points redeemed (${effectiveRedeem})`}
                value={`−${formatCentavos(redeemCentavos)}`}
                className="text-teal-300"
              />
            ) : null}
            <Row
              label="Total"
              value={formatCentavos(total)}
              className="text-base font-semibold"
            />
            {customer ? (
              <Row
                label="Points to earn"
                value={`+${Math.floor(total / (pesoPerPoint * 100))}`}
                className="text-xs text-amber-300"
              />
            ) : null}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Tender</Label>
              {tenders.map((t, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-sm"
                    value={t.method}
                    onChange={(e) => {
                      const next = [...tenders];
                      next[i] = { ...next[i], method: e.target.value as PaymentMethodValue };
                      setTenders(next);
                    }}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                    ))}
                  </select>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={t.amount}
                    onChange={(e) => {
                      const next = [...tenders];
                      next[i] = { ...next[i], amount: e.target.value };
                      setTenders(next);
                    }}
                    className="h-8 flex-1 text-right"
                  />
                  {tenders.length > 1 ? (
                    <button
                      type="button"
                      className="rounded p-1 hover:bg-muted"
                      onClick={() => setTenders(tenders.filter((_, j) => j !== i))}
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              ))}
              {tenders.length < 5 ? (
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => setTenders([...tenders, { method: "cash", amount: "" }])}
                >
                  + Add payment method
                </button>
              ) : null}
            </div>
            <Row
              label="Change"
              value={change >= 0 ? formatCentavos(change) : "—"}
              className={change < 0 ? "text-destructive" : "text-emerald-600"}
            />
          </div>

          {hasRxItems ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              {prescriptionId ? (
                <span className="text-emerald-400">✓ Prescription recorded</span>
              ) : (
                <button
                  type="button"
                  className="text-amber-400 underline"
                  onClick={() => setRxDialogOpen(true)}
                >
                  ⚠ Rx required — tap to enter prescription
                </button>
              )}
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setCart(new Map());
                setDiscount("");
                setTenders([{ method: "cash", amount: "" }]);
                setCustomer(null);
                setRedeemPoints(0);
                setDiscountType("none");
                setBeneficiaryIdNo("");
                setBeneficiaryName("");
                setPrescriptionId(null);
              }}
              disabled={lines.length === 0 || pending}
            >
              Clear
            </Button>
            <Button
              className="flex-1"
              onClick={hasRxItems && !prescriptionId ? () => setRxDialogOpen(true) : checkout}
              disabled={lines.length === 0 || (change < 0 && tenderedCentavos > 0) || pending}
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {hasRxItems && !prescriptionId ? "Enter Prescription" : "Complete sale"}
            </Button>
          </div>

          <RxDialog
            open={rxDialogOpen}
            onSave={(id) => {
              setPrescriptionId(id);
              setRxDialogOpen(false);
            }}
            onCancel={() => setRxDialogOpen(false)}
          />
          <button
            type="button"
            className="text-xs text-muted-foreground underline"
            onClick={() => setTenders([{ method: "cash", amount: centavosToPesos(total).toFixed(2) }])}
          >
            Exact cash
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between ${className ?? ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
