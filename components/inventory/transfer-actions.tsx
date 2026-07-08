"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CsvExportButton, type CsvColumn } from "@/components/alerts/csv-export-button";
import { updateTransfer } from "@/lib/transfers/actions";

export type TransferCsvRow = {
  product: string;
  quantity: number;
  unit: string;
  unitCost: string;
  totalCost: string;
};

type BranchOption = { id: string; name: string };

const CSV_COLUMNS: CsvColumn<TransferCsvRow>[] = [
  { header: "Product", value: (r) => r.product },
  { header: "Quantity", value: (r) => r.quantity },
  { header: "Unit", value: (r) => r.unit },
  { header: "Unit cost", value: (r) => r.unitCost },
  { header: "Total cost", value: (r) => r.totalCost },
];

export function TransferActions({
  transferId,
  editable,
  csvRows,
  csvFilename,
  branches,
  currentToBranchId,
  currentNotes,
}: {
  transferId: string;
  editable: boolean;
  csvRows: TransferCsvRow[];
  csvFilename: string;
  branches: BranchOption[];
  currentToBranchId: string;
  currentNotes: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="size-4" />
        Print
      </Button>
      <CsvExportButton rows={csvRows} columns={CSV_COLUMNS} filename={csvFilename} />
      {editable ? (
        <EditTransferDialog
          transferId={transferId}
          branches={branches}
          currentToBranchId={currentToBranchId}
          currentNotes={currentNotes}
        />
      ) : null}
    </div>
  );
}

function EditTransferDialog({
  transferId,
  branches,
  currentToBranchId,
  currentNotes,
}: {
  transferId: string;
  branches: BranchOption[];
  currentToBranchId: string;
  currentNotes: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [toBranchId, setToBranchId] = React.useState(currentToBranchId);
  const [notes, setNotes] = React.useState(currentNotes);
  const [pending, start] = React.useTransition();

  function save() {
    start(async () => {
      const res = await updateTransfer(transferId, toBranchId, notes);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      toast.success("Transfer updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setToBranchId(currentToBranchId);
          setNotes(currentNotes);
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-4" />
            Edit
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit transfer</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="xfer-dest">Destination branch</Label>
            <select
              id="xfer-dest"
              value={toBranchId}
              onChange={(e) => setToBranchId(e.target.value)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="xfer-notes">Notes</Label>
            <textarea
              id="xfer-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes…"
              className="rounded-md border bg-transparent px-3 py-2 text-sm"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Quantities and products can&apos;t be changed here — they&apos;re locked once
            the stock has left the source branch. Cancel the transfer instead if
            it&apos;s wrong.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
