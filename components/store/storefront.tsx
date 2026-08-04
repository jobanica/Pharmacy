"use client";

import * as React from "react";
import {
  Minus,
  Plus,
  ShoppingCart,
  MapPin,
  Store,
  CheckCircle2,
  Loader2,
  Search,
  X,
  Pill,
  Phone,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { DeliveryMap } from "@/components/store/delivery-map";
import { OrderTracker } from "@/components/store/order-tracker";
import { placeOrder } from "@/lib/orders/actions";
import { formatCentavos } from "@/lib/money";
import { hasOnlinePayment, type Storefront } from "@/lib/storefront/settings";

type Product = {
  id: string;
  name: string;
  generic_name: string | null;
  unit: string;
  default_price_centavos: number;
  requires_prescription: boolean;
};
type Branch = { id: string; name: string; address: string | null; phone: string | null };

type Fulfillment = "pickup" | "delivery";
type Payment = "on_fulfillment" | "online";

export function Storefront({
  orgSlug,
  storeName,
  logoUrl,
  brandColor,
  branches,
  products,
  storefront,
}: {
  orgSlug: string;
  storeName: string;
  logoUrl: string | null;
  brandColor?: string | null;
  branches: Branch[];
  products: Product[];
  storefront: Storefront;
}) {
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [search, setSearch] = React.useState("");
  const [branchId, setBranchId] = React.useState(branches[0]?.id ?? "");
  const [fulfillment, setFulfillment] = React.useState<Fulfillment>("pickup");
  const [payment, setPayment] = React.useState<Payment>("on_fulfillment");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [geo, setGeo] = React.useState<{ lat: number | null; lng: number | null }>({
    lat: null,
    lng: null,
  });
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [placed, setPlaced] = React.useState<{ number: string; id: string } | null>(null);
  const [cartOpen, setCartOpen] = React.useState(false);

  const byId = React.useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.generic_name?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lines = [...cart.entries()]
    .map(([id, qty]) => ({ product: byId.get(id)!, qty }))
    .filter((l) => l.product);
  const subtotal = lines.reduce(
    (s, l) => s + l.product.default_price_centavos * l.qty,
    0,
  );
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const deliveryFee = fulfillment === "delivery" ? storefront.deliveryFeeCentavos : 0;
  const total = subtotal + deliveryFee;

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, qty);
      return next;
    });
  }

  function submit() {
    if (lines.length === 0) return toast.error("Your cart is empty");
    if (!name.trim() || !phone.trim())
      return toast.error("Please enter your name and phone");
    if (fulfillment === "delivery" && !address.trim())
      return toast.error("Please enter a delivery address");
    setPending(true);
    placeOrder({
      orgSlug,
      branchId,
      name,
      phone,
      fulfillment,
      payment,
      address: fulfillment === "delivery" ? address : "",
      lat: fulfillment === "delivery" ? geo.lat : null,
      lng: fulfillment === "delivery" ? geo.lng : null,
      notes,
      items: lines.map((l) => ({ productId: l.product.id, quantity: l.qty })),
    }).then((res) => {
      setPending(false);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setPlaced({ number: res.orderNumber, id: res.orderId });
      setCart(new Map());
      setCartOpen(false);
    });
  }

  const brandStyle = brandColor
    ? ({ "--brand": brandColor } as React.CSSProperties)
    : undefined;

  // ── Order success ────────────────────────────────────────────────────────────
  if (placed) {
    const branch = branches.find((b) => b.id === branchId);
    return (
      <div className="store-root min-h-screen bg-gray-50" style={brandStyle}>
        <StoreHeader storeName={storeName} logoUrl={logoUrl} />
        <div className="mx-auto max-w-lg px-4 py-20 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex size-20 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="size-10 text-emerald-500" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Order placed!</h1>
          <p className="mt-3 text-gray-500">
            Order <span className="font-semibold text-gray-900">{placed.number}</span> at{" "}
            {storeName} has been received. We&apos;ll contact you at{" "}
            <span className="font-semibold text-gray-900">{phone}</span> to confirm.
          </p>

          <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white text-left text-sm shadow-sm">
            <div className="border-b border-gray-100 bg-gray-50 px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Order summary
            </div>
            <div className="divide-y divide-gray-100">
              <Row label="Order number" value={placed.number} />
              <Row label="Method" value={fulfillment === "pickup" ? "Pickup" : "Delivery"} />
              {fulfillment === "pickup" && branch ? (
                <Row label="Pick up at" value={branch.name} />
              ) : null}
              <Row
                label="Payment"
                value={
                  payment === "online"
                    ? "Online (payment link will be sent)"
                    : fulfillment === "delivery"
                    ? "Cash on delivery"
                    : "Cash on pickup"
                }
              />
            </div>
          </div>

          {placed.id ? (
            <div className="mt-6">
              <OrderTracker orderId={placed.id} fulfillment={fulfillment} />
            </div>
          ) : null}

          <Button
            className="mt-8 h-11 w-full rounded-xl text-base"
            onClick={() => setPlaced(null)}
          >
            Place another order
          </Button>
        </div>
      </div>
    );
  }

  // ── Main storefront ──────────────────────────────────────────────────────────
  return (
    <div className="store-root min-h-screen bg-gray-50" style={brandStyle}>
      {/* Header */}
      <StoreHeader
        storeName={storeName}
        logoUrl={logoUrl}
        itemCount={itemCount}
        onCartClick={() => setCartOpen(true)}
      />

      {/* Hero banner */}
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                {storeName}
              </h1>
              <p className="mt-1 text-gray-500">
                Order online for pickup or delivery · Pay on fulfillment or online
              </p>
              {branches.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {branches.map((b) => (
                    <span
                      key={b.id}
                      className="flex items-center gap-1.5 text-xs text-gray-500"
                    >
                      <MapPin className="size-3.5 shrink-0 text-primary" />
                      {b.name}
                      {b.address ? ` · ${b.address}` : ""}
                      {b.phone ? (
                        <>
                          <Phone className="ml-1 size-3.5 shrink-0 text-primary" />
                          {b.phone}
                        </>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 text-sm">
              <Clock className="size-4 text-primary" />
              <span className="text-gray-700">
                Orders accepted &amp; confirmed within 30 min
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
          {/* Catalog */}
          <div>
            <div className="relative mb-5">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search medicines & products…"
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            {search && (
              <p className="mb-3 text-sm text-gray-500">
                {filtered.length === 0
                  ? "No results found"
                  : `${filtered.length} result${filtered.length !== 1 ? "s" : ""} for "${search}"`}
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {filtered.map((p) => {
                const qty = cart.get(p.id) ?? 0;
                return (
                  <ProductCard
                    key={p.id}
                    product={p}
                    qty={qty}
                    onAdd={() => setQty(p.id, qty + 1)}
                    onRemove={() => setQty(p.id, qty - 1)}
                    onSet={(n) => setQty(p.id, n)}
                  />
                );
              })}
            </div>

            {filtered.length === 0 && !search ? (
              <div className="flex flex-col items-center gap-3 py-20 text-center">
                <Pill className="size-10 text-gray-300" />
                <p className="text-gray-400">No products available yet.</p>
              </div>
            ) : null}
          </div>

          {/* Checkout panel — desktop sticky */}
          <div className="hidden lg:block">
            <CheckoutPanel
              lines={lines}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              storefront={storefront}
              itemCount={itemCount}
              branches={branches}
              branchId={branchId}
              fulfillment={fulfillment}
              payment={payment}
              name={name}
              phone={phone}
              address={address}
              geo={geo}
              notes={notes}
              pending={pending}
              onBranchChange={setBranchId}
              onFulfillmentChange={setFulfillment}
              onPaymentChange={setPayment}
              onNameChange={setName}
              onPhoneChange={setPhone}
              onAddressChange={setAddress}
              onGeoChange={setGeo}
              onNotesChange={setNotes}
              onQtyChange={setQty}
              onSubmit={submit}
            />
          </div>
        </div>
      </div>

      {/* Mobile floating cart button */}
      {itemCount > 0 && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex h-14 w-full max-w-sm items-center justify-between rounded-2xl bg-primary px-5 text-sm font-semibold text-white shadow-lg"
          >
            <span className="flex items-center gap-2">
              <ShoppingCart className="size-5" />
              View order · {itemCount} item{itemCount !== 1 ? "s" : ""}
            </span>
            <span>{formatCentavos(total)}</span>
          </button>
        </div>
      )}

      {/* Mobile cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white lg:hidden">
          <div className="flex items-center justify-between border-b px-4 py-4">
            <span className="text-base font-semibold text-gray-900">Your order</span>
            <button
              type="button"
              onClick={() => setCartOpen(false)}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <CheckoutPanel
              lines={lines}
              subtotal={subtotal}
              deliveryFee={deliveryFee}
              total={total}
              storefront={storefront}
              itemCount={itemCount}
              branches={branches}
              branchId={branchId}
              fulfillment={fulfillment}
              payment={payment}
              name={name}
              phone={phone}
              address={address}
              geo={geo}
              notes={notes}
              pending={pending}
              onBranchChange={setBranchId}
              onFulfillmentChange={setFulfillment}
              onPaymentChange={setPayment}
              onNameChange={setName}
              onPhoneChange={setPhone}
              onAddressChange={setAddress}
              onGeoChange={setGeo}
              onNotesChange={setNotes}
              onQtyChange={setQty}
              onSubmit={submit}
              flat
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StoreHeader({
  storeName,
  logoUrl,
  itemCount = 0,
  onCartClick,
}: {
  storeName: string;
  logoUrl: string | null;
  itemCount?: number;
  onCartClick?: () => void;
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt={storeName}
              className="size-9 shrink-0 rounded-lg object-contain"
            />
          ) : (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Pill className="size-5 text-primary" />
            </div>
          )}
          <span className="truncate text-base font-bold text-gray-900">{storeName}</span>
        </div>
        {onCartClick && (
          <button
            type="button"
            onClick={onCartClick}
            className="relative flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 lg:hidden"
          >
            <ShoppingCart className="size-4" />
            Cart
            {itemCount > 0 && (
              <span className="absolute -right-2 -top-2 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                {itemCount}
              </span>
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function ProductCard({
  product: p,
  qty,
  onAdd,
  onRemove,
  onSet,
}: {
  product: Product;
  qty: number;
  onAdd: () => void;
  onRemove: () => void;
  onSet: (n: number) => void;
}) {
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
        qty > 0 ? "border-primary/30 ring-1 ring-primary/20" : "border-gray-200"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-gray-900">{p.name}</span>
          {p.requires_prescription ? (
            <Badge className="border-amber-300 bg-amber-50 text-amber-700 text-[10px] font-semibold">
              Rx
            </Badge>
          ) : null}
        </div>
        {p.generic_name ? (
          <p className="mt-0.5 text-xs text-gray-500">{p.generic_name}</p>
        ) : null}
        <p className="mt-1.5 text-base font-bold text-gray-900">
          {p.default_price_centavos === 0
            ? "Price on inquiry"
            : formatCentavos(p.default_price_centavos)}
          {p.unit ? (
            <span className="ml-1 text-xs font-normal text-gray-400">/ {p.unit}</span>
          ) : null}
        </p>
      </div>

      <div className="shrink-0">
        {qty > 0 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onRemove}
              className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50"
            >
              <Minus className="size-3.5" />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!isNaN(n)) onSet(n);
              }}
              className="h-8 w-10 rounded-lg border border-gray-200 bg-white text-center text-sm font-semibold text-gray-900 focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
            <button
              type="button"
              onClick={onAdd}
              className="flex size-8 items-center justify-center rounded-lg bg-primary text-white transition hover:bg-primary/90"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-9 items-center gap-1.5 rounded-xl bg-primary/10 px-3 text-sm font-semibold text-primary transition hover:bg-primary/20"
          >
            <Plus className="size-4" />
            Add
          </button>
        )}
      </div>
    </div>
  );
}

type CheckoutPanelProps = {
  lines: { product: Product; qty: number }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  storefront: Storefront;
  itemCount: number;
  branches: Branch[];
  branchId: string;
  fulfillment: Fulfillment;
  payment: Payment;
  name: string;
  phone: string;
  address: string;
  geo: { lat: number | null; lng: number | null };
  notes: string;
  pending: boolean;
  onBranchChange: (id: string) => void;
  onFulfillmentChange: (f: Fulfillment) => void;
  onPaymentChange: (p: Payment) => void;
  onNameChange: (v: string) => void;
  onPhoneChange: (v: string) => void;
  onAddressChange: (v: string) => void;
  onGeoChange: (g: { lat: number | null; lng: number | null }) => void;
  onNotesChange: (v: string) => void;
  onQtyChange: (id: string, qty: number) => void;
  onSubmit: () => void;
  flat?: boolean;
};

function CheckoutPanel({
  lines,
  subtotal,
  deliveryFee,
  total,
  storefront,
  itemCount,
  branches,
  branchId,
  fulfillment,
  payment,
  name,
  phone,
  address,
  geo,
  notes,
  pending,
  onBranchChange,
  onFulfillmentChange,
  onPaymentChange,
  onNameChange,
  onPhoneChange,
  onAddressChange,
  onGeoChange,
  onNotesChange,
  onQtyChange,
  onSubmit,
  flat,
}: CheckoutPanelProps) {
  const wrap = flat ? "p-4 grid gap-5" : "sticky top-24 grid gap-5 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm";

  return (
    <div className={wrap}>
      {/* Cart lines */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-gray-900">
            Your order
            {itemCount > 0 ? (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {itemCount}
              </span>
            ) : null}
          </span>
        </div>
        {lines.length === 0 ? (
          <p className="rounded-xl bg-gray-50 py-6 text-center text-sm text-gray-400">
            Add items from the catalog to start your order.
          </p>
        ) : (
          <div className="grid gap-2 rounded-xl bg-gray-50 p-3">
            {lines.map((l) => (
              <div key={l.product.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate text-gray-700">
                  <span className="font-medium">{l.product.name}</span>
                </span>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onQtyChange(l.product.id, l.qty - 1)}
                    className="flex size-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                  >
                    <Minus className="size-3" />
                  </button>
                  <span className="w-5 text-center text-xs font-semibold">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => onQtyChange(l.product.id, l.qty + 1)}
                    className="flex size-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:bg-gray-100"
                  >
                    <Plus className="size-3" />
                  </button>
                  <span className="w-16 text-right text-xs font-semibold text-gray-900">
                    {formatCentavos(l.product.default_price_centavos * l.qty)}
                  </span>
                </div>
              </div>
            ))}
            <div className="mt-1 flex justify-between border-t border-gray-200 pt-2 text-sm text-gray-700">
              <span>Subtotal</span>
              <span>{formatCentavos(subtotal)}</span>
            </div>
            {fulfillment === "delivery" ? (
              <div className="flex justify-between text-sm text-gray-700">
                <span>Delivery fee</span>
                <span>{deliveryFee > 0 ? formatCentavos(deliveryFee) : "Free"}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm font-bold text-gray-900">
              <span>Total</span>
              <span>{formatCentavos(total)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Fulfillment */}
      <div className="grid gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          How would you like it?
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <FulTab
            active={fulfillment === "pickup"}
            icon={<Store className="size-4" />}
            label="Pickup"
            onClick={() => onFulfillmentChange("pickup")}
          />
          <FulTab
            active={fulfillment === "delivery"}
            icon={<MapPin className="size-4" />}
            label="Delivery"
            onClick={() => onFulfillmentChange("delivery")}
          />
        </div>

        <div className="grid gap-1">
          <Label className="text-xs text-gray-500">
            {fulfillment === "pickup" ? "Pick up at" : "Deliver from"}
          </Label>
          <select
            value={branchId}
            onChange={(e) => onBranchChange(e.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.address ? ` — ${b.address}` : ""}
              </option>
            ))}
          </select>
        </div>

        {fulfillment === "delivery" ? (
          <div className="grid gap-2">
            <DeliveryMap
              value={geo}
              onChange={({ lat, lng, address: a }) => {
                onGeoChange({ lat, lng });
                if (a) onAddressChange(a);
              }}
            />
            <div className="grid gap-1">
              <Label className="text-xs text-gray-500">Delivery address</Label>
              <Textarea
                rows={2}
                value={address}
                onChange={(e) => onAddressChange(e.target.value)}
                placeholder="House/unit, street, barangay, landmark…"
                className="rounded-xl border-gray-200 text-sm"
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* Contact */}
      <div className="grid gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Contact details
        </Label>
        <Input
          placeholder="Full name"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="h-10 rounded-xl border-gray-200 text-sm"
        />
        <Input
          placeholder="Mobile number"
          type="tel"
          value={phone}
          onChange={(e) => onPhoneChange(e.target.value)}
          className="h-10 rounded-xl border-gray-200 text-sm"
        />
      </div>

      {/* Payment */}
      <div className="grid gap-2">
        <Label className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Payment
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <FulTab
            active={payment === "on_fulfillment"}
            label={fulfillment === "delivery" ? "Cash on delivery" : "Cash on pickup"}
            onClick={() => onPaymentChange("on_fulfillment")}
          />
          <FulTab
            active={payment === "online"}
            label="Pay online"
            onClick={() => onPaymentChange("online")}
          />
        </div>
        {payment === "online" ? (
          hasOnlinePayment(storefront) ? (
            <div className="grid gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500">
                Pay to any of the accounts below, then send your proof of payment when we confirm.
              </p>
              {storefront.gcash.enabled ? (
                <PayLine label="GCash" name={storefront.gcash.name} number={storefront.gcash.number} />
              ) : null}
              {storefront.maya.enabled ? (
                <PayLine label="Maya" name={storefront.maya.name} number={storefront.maya.number} />
              ) : null}
              {storefront.bank.enabled ? (
                <PayLine
                  label={storefront.bank.bankName || "Bank"}
                  name={storefront.bank.name}
                  number={storefront.bank.number}
                />
              ) : null}
              {storefront.qrUrl ? (
                <div className="flex flex-col items-center gap-1 pt-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={storefront.qrUrl} alt="Payment QR" className="h-40 w-40 rounded-lg border object-contain" />
                  <span className="text-xs text-gray-500">Scan to pay</span>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              We&apos;ll contact you with payment details after we confirm your order.
            </p>
          )
        ) : null}
      </div>

      {/* Notes */}
      <div className="grid gap-1">
        <Label className="text-xs text-gray-500">Special instructions (optional)</Label>
        <Textarea
          rows={2}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Allergies, substitutions, special requests…"
          className="rounded-xl border-gray-200 text-sm"
        />
      </div>

      <button
        type="button"
        onClick={onSubmit}
        disabled={pending || lines.length === 0}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white shadow-md transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        {lines.length === 0
          ? "Add items to place order"
          : `Place order · ${formatCentavos(total)}`}
      </button>
    </div>
  );
}

function PayLine({ label, name, number }: { label: string; name: string; number: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="font-semibold text-gray-900">{label}</span>
      <span className="text-right text-gray-700">
        {number}
        {name ? <span className="block text-xs text-gray-500">{name}</span> : null}
      </span>
    </div>
  );
}

function FulTab({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 px-5 py-3">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
