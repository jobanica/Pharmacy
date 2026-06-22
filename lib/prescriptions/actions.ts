"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { requireAppContext } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";

const schema = z.object({
  patientName: z.string().min(1, "Patient name is required").max(200),
  patientDob: z.string().optional().nullable(),
  doctorName: z.string().min(1, "Doctor name is required").max(200),
  doctorPrcNo: z.string().max(50).optional().nullable(),
  dateIssued: z.string().min(1, "Date issued is required"),
  rxNumber: z.string().max(100).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type PrescriptionResult = { ok: true; prescriptionId: string } | { error: string };

export async function createPrescription(
  input: z.input<typeof schema>,
): Promise<PrescriptionResult> {
  const ctx = await requireAppContext();
  if (!can(ctx.role, "create_sale")) return { error: "Insufficient role" };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prescriptions")
    .insert({
      organization_id: ctx.organization.id,
      branch_id: ctx.activeBranchId,
      patient_name: d.patientName,
      patient_dob: d.patientDob ?? null,
      doctor_name: d.doctorName,
      doctor_prc_no: d.doctorPrcNo ?? null,
      date_issued: d.dateIssued,
      rx_number: d.rxNumber ?? null,
      notes: d.notes ?? null,
      created_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  return { ok: true, prescriptionId: data.id };
}
