"use client";

import * as React from "react";
import { Loader2, ClipboardList } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPrescription } from "@/lib/prescriptions/actions";

type Form = {
  patientName: string;
  patientDob: string;
  doctorName: string;
  doctorPrcNo: string;
  dateIssued: string;
  rxNumber: string;
  notes: string;
};

const empty: Form = {
  patientName: "",
  patientDob: "",
  doctorName: "",
  doctorPrcNo: "",
  dateIssued: new Date().toISOString().slice(0, 10),
  rxNumber: "",
  notes: "",
};

export function RxDialog({
  open,
  onSave,
  onCancel,
}: {
  open: boolean;
  onSave: (prescriptionId: string) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState<Form>(empty);
  const [pending, start] = React.useTransition();

  React.useEffect(() => {
    if (open) setForm({ ...empty, dateIssued: new Date().toISOString().slice(0, 10) });
  }, [open]);

  function field(key: keyof Form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function save() {
    start(async () => {
      const res = await createPrescription({
        patientName: form.patientName,
        patientDob: form.patientDob || null,
        doctorName: form.doctorName,
        doctorPrcNo: form.doctorPrcNo || null,
        dateIssued: form.dateIssued,
        rxNumber: form.rxNumber || null,
        notes: form.notes || null,
      });
      if ("error" in res) {
        toast.error(res.error);
      } else {
        onSave(res.prescriptionId);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="size-5" />
            Prescription Details
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-amber-400">
          One or more items require a valid prescription. Fill in the details before completing the sale.
        </p>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Patient name *</Label>
              <Input value={form.patientName} onChange={field("patientName")} placeholder="Full name" />
            </div>
            <div className="grid gap-1.5">
              <Label>Date of birth</Label>
              <Input type="date" value={form.patientDob} onChange={field("patientDob")} />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Doctor / prescriber *</Label>
              <Input value={form.doctorName} onChange={field("doctorName")} placeholder="Dr. Juan dela Cruz" />
            </div>
            <div className="grid gap-1.5">
              <Label>PRC license no.</Label>
              <Input value={form.doctorPrcNo} onChange={field("doctorPrcNo")} placeholder="0000000" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Date issued *</Label>
              <Input type="date" value={form.dateIssued} onChange={field("dateIssued")} />
            </div>
            <div className="grid gap-1.5">
              <Label>Rx / control no.</Label>
              <Input value={form.rxNumber} onChange={field("rxNumber")} placeholder="Optional" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={field("notes")}
              placeholder="Directions, special instructions…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !form.patientName || !form.doctorName || !form.dateIssued}>
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Save &amp; continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
