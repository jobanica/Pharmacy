"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function SetupForm({
  currentEmail,
  isPending,
}: {
  currentEmail: string;
  isPending: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [done, setDone] = React.useState(false);
  const [form, setForm] = React.useState({ email: "", password: "", confirm: "" });

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const updates: { email?: string; password?: string } = { password: form.password };
      if (form.email && form.email !== currentEmail) updates.email = form.email;

      const { error } = await supabase.auth.updateUser(updates);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Account setup complete!");
      setDone(true);
      setTimeout(() => router.push("/dashboard"), 1500);
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-10">
          <CheckCircle className="size-10 text-emerald-400" />
          <p className="text-sm font-medium">Setup complete — redirecting…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form onSubmit={handleSubmit} className="grid gap-4">
          {!isPending ? (
            <div className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-400">
              Your account is already set up. You can still update your credentials below.
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="email">New email address</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="you@yourpharmacy.com"
              required
            />
            {isPending ? (
              <p className="text-xs text-muted-foreground">
                Your current login is a temporary placeholder. Enter your real email above.
              </p>
            ) : null}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="password">New password</Label>
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
            <Label htmlFor="confirm">Confirm password</Label>
            <Input
              id="confirm"
              type="password"
              value={form.confirm}
              onChange={(e) => set("confirm", e.target.value)}
              placeholder="Repeat password"
              required
            />
          </div>

          <Button type="submit" disabled={pending} className="mt-2">
            {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            Save & complete setup
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
