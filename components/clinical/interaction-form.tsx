"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertInteraction, deleteInteraction } from "@/lib/clinical/actions";

type Product = { id: string; name: string; generic_name: string | null };
type Interaction = {
  id: string;
  product_id_a: string;
  product_id_b: string;
  severity: "minor" | "moderate" | "major";
  description: string | null;
};

const SEVERITY_LABELS: Record<string, string> = {
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
};

const SEVERITY_COLORS: Record<string, string> = {
  minor: "text-yellow-600",
  moderate: "text-orange-600",
  major: "text-destructive",
};

export function InteractionForm({ products }: { products: Product[] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [productA, setProductA] = React.useState("");
  const [productB, setProductB] = React.useState("");
  const [severity, setSeverity] = React.useState<"minor" | "moderate" | "major">("moderate");
  const [description, setDescription] = React.useState("");
  const [searchA, setSearchA] = React.useState("");
  const [searchB, setSearchB] = React.useState("");
  const [showA, setShowA] = React.useState(false);
  const [showB, setShowB] = React.useState(false);

  const filtered = (q: string) =>
    products.filter(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        (p.generic_name ?? "").toLowerCase().includes(q.toLowerCase()),
    ).slice(0, 8);

  const nameA = products.find((p) => p.id === productA)?.name;
  const nameB = products.find((p) => p.id === productB)?.name;

  function submit() {
    if (!productA || !productB) { toast.error("Select both products"); return; }
    startTransition(async () => {
      const res = await upsertInteraction({ productIdA: productA, productIdB: productB, severity, description: description || null });
      if ("error" in res) { toast.error(res.error); return; }
      toast.success("Interaction saved");
      setProductA(""); setProductB(""); setDescription(""); setSearchA(""); setSearchB("");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 rounded-xl border p-4">
      <p className="text-sm font-medium">Add interaction</p>
      <div className="grid grid-cols-2 gap-3">
        <ProductPicker
          label="Drug A"
          search={searchA}
          onSearch={(v) => { setSearchA(v); setShowA(true); setProductA(""); }}
          selected={nameA}
          results={filtered(searchA)}
          show={showA}
          onSelect={(id, name) => { setProductA(id); setSearchA(name); setShowA(false); }}
          onBlur={() => setTimeout(() => setShowA(false), 150)}
          onFocus={() => setShowA(true)}
        />
        <ProductPicker
          label="Drug B"
          search={searchB}
          onSearch={(v) => { setSearchB(v); setShowB(true); setProductB(""); }}
          selected={nameB}
          results={filtered(searchB)}
          show={showB}
          onSelect={(id, name) => { setProductB(id); setSearchB(name); setShowB(false); }}
          onBlur={() => setTimeout(() => setShowB(false), 150)}
          onFocus={() => setShowB(true)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Severity</Label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as typeof severity)}
            className="h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            {(["minor", "moderate", "major"] as const).map((s) => (
              <option key={s} value={s}>{SEVERITY_LABELS[s]}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Clinical notes..."
          />
        </div>
      </div>
      <Button size="sm" onClick={submit} disabled={pending || !productA || !productB}>
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
        Save interaction
      </Button>
    </div>
  );
}

function ProductPicker({
  label, search, onSearch, selected, results, show, onSelect, onBlur, onFocus,
}: {
  label: string;
  search: string;
  onSearch: (v: string) => void;
  selected: string | undefined;
  results: Product[];
  show: boolean;
  onSelect: (id: string, name: string) => void;
  onBlur: () => void;
  onFocus: () => void;
}) {
  return (
    <div className="relative grid gap-1.5">
      <Label>{label}</Label>
      <Input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Search product..."
        className={selected ? "border-primary" : ""}
      />
      {show && results.length > 0 ? (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {results.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={() => onSelect(p.id, p.name)}
              className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span>{p.name}</span>
              {p.generic_name ? <span className="text-xs text-muted-foreground">{p.generic_name}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function InteractionsList({
  interactions,
  products,
}: {
  interactions: Interaction[];
  products: Product[];
}) {
  const router = useRouter();
  const [deleting, startDelete] = React.useTransition();
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  if (interactions.length === 0) {
    return <p className="text-sm text-muted-foreground">No interactions registered yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Drug A</th>
            <th className="px-3 py-2 text-left">Drug B</th>
            <th className="px-3 py-2 text-left">Severity</th>
            <th className="px-3 py-2 text-left">Notes</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {interactions.map((ix) => (
            <tr key={ix.id} className="border-t">
              <td className="px-3 py-2">{productMap[ix.product_id_a]?.name ?? ix.product_id_a}</td>
              <td className="px-3 py-2">{productMap[ix.product_id_b]?.name ?? ix.product_id_b}</td>
              <td className={`px-3 py-2 font-medium ${SEVERITY_COLORS[ix.severity]}`}>
                {SEVERITY_LABELS[ix.severity]}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{ix.description ?? "—"}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const res = await deleteInteraction(ix.id);
                      if ("error" in res) toast.error(res.error);
                      else router.refresh();
                    })
                  }
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remove interaction"
                >
                  <X className="size-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
