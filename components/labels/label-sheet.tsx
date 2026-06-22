"use client";

import * as React from "react";
import { Printer } from "lucide-react";

type LabelType = "shelf" | "batch";

type BatchInfo = {
  id: string;
  batch_number: string | null;
  expiry_date: string | null;
  quantity: number;
};

type ProductInfo = {
  id: string;
  name: string;
  generic_name: string | null;
  unit: string;
  default_price_centavos: number;
  sku: string | null;
  barcode: string | null;
};

function formatPrice(centavos: number) {
  return `₱${(centavos / 100).toFixed(2)}`;
}

export function LabelSheet({
  product,
  batches,
  orgName,
}: {
  product: ProductInfo;
  batches: BatchInfo[];
  orgName: string;
}) {
  const [labelType, setLabelType] = React.useState<LabelType>("shelf");
  const [copies, setCopies] = React.useState<Record<string, number>>(() => {
    const m: Record<string, number> = { _shelf: 1 };
    for (const b of batches) m[b.id] = 1;
    return m;
  });

  const shelfCopies = copies["_shelf"] ?? 1;

  const shelfLabels = Array.from({ length: shelfCopies }, (_, i) => (
    <ShelfLabel key={i} product={product} orgName={orgName} />
  ));

  const batchLabels = batches.flatMap((b) =>
    Array.from({ length: copies[b.id] ?? 1 }, (_, i) => (
      <BatchLabel key={`${b.id}-${i}`} product={product} batch={b} orgName={orgName} />
    )),
  );

  return (
    <>
      {/* Controls — hidden when printing */}
      <div className="no-print fixed inset-x-0 top-0 z-10 flex items-center gap-4 border-b bg-white px-6 py-3 shadow-sm">
        <span className="font-semibold text-sm">{product.name} — Label Print</span>

        <div className="flex gap-2 ml-4">
          {(["shelf", "batch"] as LabelType[]).map((t) => (
            <button
              key={t}
              onClick={() => setLabelType(t)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                labelType === t ? "bg-black text-white border-black" : "border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {t === "shelf" ? "Shelf labels" : "Batch labels"}
            </button>
          ))}
        </div>

        {labelType === "shelf" ? (
          <label className="ml-4 flex items-center gap-2 text-sm">
            Copies:
            <input
              type="number"
              min={1}
              max={100}
              value={shelfCopies}
              onChange={(e) =>
                setCopies((s) => ({ ...s, _shelf: Math.max(1, parseInt(e.target.value) || 1) }))
              }
              className="w-16 rounded border px-2 py-1 text-sm"
            />
          </label>
        ) : null}

        {labelType === "batch" && batches.length > 0 ? (
          <div className="ml-4 flex items-center gap-4">
            {batches.map((b) => (
              <label key={b.id} className="flex items-center gap-1.5 text-sm">
                <span className="text-gray-500">
                  {b.batch_number ?? "No batch"}{b.expiry_date ? ` (exp ${b.expiry_date})` : ""}:
                </span>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={copies[b.id] ?? 1}
                  onChange={(e) =>
                    setCopies((s) => ({ ...s, [b.id]: Math.max(0, parseInt(e.target.value) || 0) }))
                  }
                  className="w-14 rounded border px-2 py-1 text-sm"
                />
              </label>
            ))}
          </div>
        ) : null}

        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Printer className="size-4" />
          Print
        </button>
      </div>

      {/* Label sheet — shown on screen with top padding to clear controls, and in print */}
      <div className="mt-16 p-4 print:mt-0 print:p-0">
        {labelType === "shelf" ? (
          <div className="label-grid">{shelfLabels}</div>
        ) : batches.length > 0 ? (
          <div className="label-grid">{batchLabels}</div>
        ) : (
          <p className="p-8 text-center text-gray-500 text-sm no-print">
            No batches in stock at this branch.
          </p>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; background: white; }
        }
        .label-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          padding: 4px;
        }
        .label-card {
          width: 90mm;
          min-height: 38mm;
          border: 1px solid #000;
          padding: 4mm;
          box-sizing: border-box;
          font-family: Arial, sans-serif;
          page-break-inside: avoid;
        }
        @media screen {
          .label-card {
            box-shadow: 0 1px 3px rgba(0,0,0,0.12);
          }
        }
      `}</style>
    </>
  );
}

function ShelfLabel({ product, orgName }: { product: ProductInfo; orgName: string }) {
  return (
    <div className="label-card">
      <div style={{ fontSize: "7pt", color: "#666", marginBottom: "2mm" }}>{orgName}</div>
      <div style={{ fontSize: "12pt", fontWeight: "bold", lineHeight: 1.2, marginBottom: "1mm" }}>
        {product.name}
      </div>
      {product.generic_name ? (
        <div style={{ fontSize: "8pt", color: "#444", marginBottom: "2mm" }}>{product.generic_name}</div>
      ) : null}
      <div style={{ fontSize: "16pt", fontWeight: "bold", color: "#000", marginTop: "auto" }}>
        {formatPrice(product.default_price_centavos)}
        <span style={{ fontSize: "8pt", fontWeight: "normal", marginLeft: "2mm" }}>/{product.unit}</span>
      </div>
      {product.sku ? (
        <div style={{ fontSize: "6pt", color: "#999", marginTop: "1mm" }}>SKU: {product.sku}</div>
      ) : null}
    </div>
  );
}

function BatchLabel({
  product,
  batch,
  orgName,
}: {
  product: ProductInfo;
  batch: BatchInfo;
  orgName: string;
}) {
  const expired =
    batch.expiry_date ? new Date(batch.expiry_date) < new Date() : false;
  const expiryColor = expired ? "#c00" : "#000";

  return (
    <div className="label-card">
      <div style={{ fontSize: "7pt", color: "#666", marginBottom: "1mm" }}>{orgName}</div>
      <div style={{ fontSize: "11pt", fontWeight: "bold", lineHeight: 1.2 }}>{product.name}</div>
      {product.generic_name ? (
        <div style={{ fontSize: "7pt", color: "#555", marginBottom: "2mm" }}>{product.generic_name}</div>
      ) : null}
      <div style={{ display: "flex", gap: "6mm", marginTop: "2mm", fontSize: "8pt" }}>
        <div>
          <div style={{ color: "#666", fontSize: "6pt" }}>BATCH</div>
          <div style={{ fontWeight: "bold" }}>{batch.batch_number ?? "—"}</div>
        </div>
        <div>
          <div style={{ color: "#666", fontSize: "6pt" }}>EXPIRY</div>
          <div style={{ fontWeight: "bold", color: expiryColor }}>
            {batch.expiry_date ?? "—"}
            {expired ? " ⚠" : ""}
          </div>
        </div>
        <div>
          <div style={{ color: "#666", fontSize: "6pt" }}>QTY</div>
          <div style={{ fontWeight: "bold" }}>{batch.quantity} {product.unit}</div>
        </div>
      </div>
      <div style={{ fontSize: "9pt", fontWeight: "bold", marginTop: "2mm" }}>
        {formatPrice(product.default_price_centavos)}
      </div>
    </div>
  );
}
