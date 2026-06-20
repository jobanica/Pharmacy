"use client";

import * as React from "react";
import { UserPlus, X, Star, Search } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createCustomer } from "@/lib/loyalty/actions";

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  points_balance: number;
};

export function CustomerPicker({
  customers,
  selected,
  onSelect,
  redeemPoints,
  onRedeemChange,
  maxRedeemable,
}: {
  customers: Customer[];
  selected: Customer | null;
  onSelect: (c: Customer | null) => void;
  redeemPoints: number;
  onRedeemChange: (n: number) => void;
  maxRedeemable: number;
}) {
  const [query, setQuery] = React.useState("");
  const [addOpen, setAddOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [pending, start] = React.useTransition();

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q))
      .slice(0, 5);
  }, [query, customers]);

  function add() {
    if (!name.trim()) {
      toast.error("Enter a name");
      return;
    }
    start(async () => {
      const res = await createCustomer({ name, phone });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Customer added");
      onSelect(res.customer);
      setAddOpen(false);
      setName("");
      setPhone("");
      setQuery("");
    });
  }

  if (selected) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="size-4 text-amber-300" />
            <div>
              <div className="text-sm font-medium">{selected.name}</div>
              <div className="text-xs text-muted-foreground">
                {selected.points_balance} pts available
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => {
              onSelect(null);
              onRedeemChange(0);
            }}
          >
            <X className="size-4" />
          </Button>
        </div>
        {maxRedeemable > 0 ? (
          <div className="mt-3 flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Redeem pts</Label>
            <Input
              type="number"
              min="0"
              max={maxRedeemable}
              value={redeemPoints || ""}
              onChange={(e) =>
                onRedeemChange(Math.max(0, Math.min(maxRedeemable, Number(e.target.value) || 0)))
              }
              className="h-8 w-24"
            />
            <button
              type="button"
              className="text-xs text-fuchsia-300 hover:underline"
              onClick={() => onRedeemChange(maxRedeemable)}
            >
              Max {maxRedeemable}
            </button>
            {redeemPoints > 0 ? (
              <span className="ml-auto text-xs text-teal-300">−₱{redeemPoints}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Add loyalty member (name or phone)…"
          className="h-9 pl-8"
        />
      </div>
      {matches.length > 0 ? (
        <div className="mt-2 grid gap-1">
          {matches.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onSelect(c);
                setQuery("");
              }}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-white/5"
            >
              <span>
                {c.name}
                {c.phone ? <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span> : null}
              </span>
              <span className="text-xs text-amber-300">{c.points_balance} pts</span>
            </button>
          ))}
        </div>
      ) : null}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogTrigger
          render={
            <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-muted-foreground">
              <UserPlus className="size-4" />
              New loyalty member
            </Button>
          }
        />
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New loyalty member</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="grid gap-2">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="optional" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={add} disabled={pending}>
              Add &amp; attach
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
