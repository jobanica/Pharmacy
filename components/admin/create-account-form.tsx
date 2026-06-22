"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createAccount } from "@/lib/admin/actions";

export function CreateAccountForm() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({
    email: "",
    password: "",
    fullName: "",
    orgName: "",
    plan: "free" as "free" | "starter" | "pro",
  });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await createAccount(form);
    setPending(false);
    if ("error" in res) {
      toast.error(res.error);
    } else {
      toast.success("Account created successfully");
      setForm({ email: "", password: "", fullName: "", orgName: "", plan: "free" });
      router.push("/admin/subscriptions");
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>New pharmacy account</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="fullName">Owner name</Label>
            <Input
              id="fullName"
              value={form.fullName}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Juan dela Cruz"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="owner@pharmacy.com"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="orgName">Pharmacy name</Label>
            <Input
              id="orgName"
              value={form.orgName}
              onChange={(e) => set("orgName", e.target.value)}
              placeholder="Dela Cruz Pharmacy"
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="plan">Starting plan</Label>
            <select
              id="plan"
              value={form.plan}
              onChange={(e) => set("plan", e.target.value as typeof form.plan)}
              className="h-9 rounded-md border bg-transparent px-3 text-sm capitalize"
            >
              <option value="free">Free</option>
              <option value="starter">Starter — ₱699/mo</option>
              <option value="pro">Pro — ₱1,799/mo</option>
            </select>
          </div>
          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Create account
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
