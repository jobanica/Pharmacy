"use client";

import * as React from "react";
import { Minus, Plus, ShoppingCart, MapPin, Store, CheckCircle2, Loader2 } from "lucide-react";
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
  branches,
  products,
}: {
  orgSlug: string;
  storeName: string;
  logoUrl: string | null;
  branches: Branch[];
  products: Product[];
}) {
  const [cart, setCart] = React.useState<Map<string, number>>(new Map());
  const [search, setSearch] = React.useState("");
  const [branchId, setBranchId] = React.useState(branches[0]?.id ?? "");
  const [fulfillment, setFulfillment] = React.useState<Fulfillment>("pickup");
  const [payment, setPayment] = React.useState<Payment>("on_fulfillment");
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [geo, setGeo] = React.useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [placed, setPlaced] = React.useState<{ number: string; id: string } | null>(null);

  const byId = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.generic_name?.toLowerCase().includes(q),
    );
  }, [products, search]);

  const lines = [...cart.entries()].map(([id, qty]) => ({ product: byId.get(id)!, qty })).filter((l) => l.product);
  const subtotal = lines.reduce((s, l) => s + l.product.default_price_centavos * l.qty, 0);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

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
    if (!name.trim() || !phone.trim()) return toast.error("Please enter your name and phone");
    if (fulfillment === "delivery" && !address.trim()) return toast.error("Please enter a delivery address");
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
    });
  }

  if (placed) {
    const branch = branches.find((b) => b.id === branchId);
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <h1 className="mt-4 text-2xl font-semibold">Order placed!</h1>
        <p className="mt-2 text-muted-foreground">
          Your order <span className="font-semibold text-foreground">{placed.number}</span> at{" "}
          {storeName} has been received. We&apos;ll contact you at {phone} to confirm.
        </p>
        <div className="mt-4 rounded-lg border p-4 text-left text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Method</span><span className="font-medium capitalize">{fulfillment}</span></div>
          {fulfillment === "pickup" && branch ? (
            <div className="flex justify-between"><span className="text-muted-foreground">Pick up at</span><span className="font-medium">{branch.name}</span></div>
          ) : null}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Payment</span>
            <span className="font-medium">{payment === "online" ? "Online (we'll send a link)" : "On pickup / delivery"}</span>
          </div>
        </div>

        {placed.id ? (
          <OrderTracker orderId={placed.id} fulfillment={fulfillment} />
        ) : null}

        <Button className="mt-6" onClick={() => setPlaced(null)}>Place another order</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="mb-6 flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-10 rounded-lg bg-white object-contain p-1" />
        ) : (
          <Store className="size-8 text-primary" />
        )}
        <div>
          <h1 className="text-xl font-semibold">{storeName}</h1>
          <p className="text-sm text-muted-foreground">Order online for pickup or delivery</p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Catalog */}
        <div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search medicines & products…"
            className="mb-3"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {filtered.map((p) => {
              const qty = cart.get(p.id) ?? 0;
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-lg border p-3">
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {p.name}
                      {p.requires_prescription ? (
                        <Badge variant="outline" className="ml-2 text-amber-600">Rx</Badge>
                      ) : null}
                    </div>
                    {p.generic_name ? (
                      <div className="truncate text-xs text-muted-foreground">{p.generic_name}</div>
                    ) : null}
                    <div className="text-sm font-semibold">{formatCentavos(p.default_price_centavos)}</div>
                  </div>
                  {qty > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(p.id, qty - 1)}>
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">{qty}</span>
                      <Button size="icon" variant="outline" className="size-8" onClick={() => setQty(p.id, qty + 1)}>
                        <Plus className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setQty(p.id, 1)}>
                      <Plus className="size-4" />
                      Add
                    </Button>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products found.</p>
            ) : null}
          </div>
        </div>

        {/* Cart + checkout */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="grid gap-4 rounded-xl border p-4">
            <div className="flex items-center gap-2 font-semibold">
              <ShoppingCart className="size-5" />
              Your order
              {itemCount > 0 ? <Badge variant="secondary">{itemCount}</Badge> : null}
            </div>

            {lines.length > 0 ? (
              <div className="grid gap-1.5 text-sm">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex justify-between gap-2">
                    <span className="truncate">{l.qty}× {l.product.name}</span>
                    <span className="shrink-0">{formatCentavos(l.product.default_price_centavos * l.qty)}</span>
                  </div>
                ))}
                <div className="mt-1 flex justify-between border-t pt-2 font-semibold">
                  <span>Subtotal</span>
                  <span>{formatCentavos(subtotal)}</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Add items from the list to start your order.</p>
            )}

            {/* Fulfillment */}
            <div className="grid grid-cols-2 gap-2">
              <Toggle active={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>
                <Store className="size-4" /> Pickup
              </Toggle>
              <Toggle active={fulfillment === "delivery"} onClick={() => setFulfillment("delivery")}>
                <MapPin className="size-4" /> Delivery
              </Toggle>
            </div>

            <div className="grid gap-1">
              <Label className="text-xs">{fulfillment === "pickup" ? "Pick up at" : "Deliver from"}</Label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-3 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}{b.address ? ` — ${b.address}` : ""}</option>
                ))}
              </select>
            </div>

            {fulfillment === "delivery" ? (
              <div className="grid gap-2">
                <DeliveryMap
                  value={geo}
                  onChange={({ lat, lng, address: a }) => {
                    setGeo({ lat, lng });
                    if (a) setAddress(a);
                  }}
                />
                <div className="grid gap-1">
                  <Label className="text-xs">Delivery address</Label>
                  <Textarea rows={2} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="House/unit, street, barangay, landmark…" />
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            {/* Payment */}
            <div className="grid gap-1">
              <Label className="text-xs">Payment</Label>
              <div className="grid grid-cols-2 gap-2">
                <Toggle active={payment === "on_fulfillment"} onClick={() => setPayment("on_fulfillment")}>
                  Pay on {fulfillment === "delivery" ? "delivery" : "pickup"}
                </Toggle>
                <Toggle active={payment === "online"} onClick={() => setPayment("online")}>
                  Pay online
                </Toggle>
              </div>
              {payment === "online" ? (
                <p className="text-xs text-muted-foreground">
                  We&apos;ll send you a payment link to confirm your order.
                </p>
              ) : null}
            </div>

            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />

            <Button onClick={submit} disabled={pending || lines.length === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Place order · {formatCentavos(subtotal)}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
        (active ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted/50")
      }
    >
      {children}
    </button>
  );
}
