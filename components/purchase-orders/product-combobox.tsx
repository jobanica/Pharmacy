"use client";

import * as React from "react";

type Product = { id: string; name: string };

/**
 * Searchable product picker — type to filter, click to select. Uses themed
 * popover colors so the list stays readable in both light and dark mode.
 */
export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = "Search product…",
}: {
  products: Product[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const rootRef = React.useRef<HTMLDivElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;

  React.useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const q = query.trim().toLowerCase();
  const filtered = React.useMemo(
    () => (q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products),
    [products, q],
  );
  const matches = filtered.slice(0, 50);

  return (
    <div ref={rootRef} className="relative min-w-[180px] flex-1">
      <input
        type="text"
        value={open ? query : selected?.name ?? ""}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        className="h-9 w-full rounded-md border bg-transparent px-3 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
      />
      {open ? (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No products found</div>
          ) : (
            matches.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={`block w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground ${
                  p.id === value ? "bg-accent/50 font-medium" : ""
                }`}
              >
                {p.name}
              </button>
            ))
          )}
          {q && filtered.length > 50 ? (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">
              Showing first 50 — keep typing to narrow.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
