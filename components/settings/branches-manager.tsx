"use client";

import * as React from "react";
import { toast } from "sonner";
import { Building2, Plus } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createBranch,
  updateBranch,
  setBranchActive,
} from "@/lib/branches/actions";

export type BranchRow = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
};

export function BranchesManager({ branches }: { branches: BranchRow[] }) {
  const [pending, start] = React.useTransition();

  // New-branch form state.
  const [name, setName] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [phone, setPhone] = React.useState("");

  function add() {
    if (!name.trim()) {
      toast.error("Enter a branch name");
      return;
    }
    start(async () => {
      const res = await createBranch({
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Branch added");
        setName("");
        setAddress("");
        setPhone("");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Branches</CardTitle>
          <CardDescription>
            Add and manage the locations of your pharmacy. Staff and stock are
            scoped per branch.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {branches.map((b) => (
            <BranchItem key={b.id} branch={b} pending={pending} start={start} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="size-4" />
            Add a branch
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="grid gap-1.5">
            <Label htmlFor="b-name">Name</Label>
            <Input
              id="b-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cubao Branch"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-address">Address (optional)</Label>
            <Input
              id="b-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="b-phone">Phone (optional)</Label>
            <Input
              id="b-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={add} disabled={pending}>
              {pending ? "Saving…" : "Add branch"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function BranchItem({
  branch,
  pending,
  start,
}: {
  branch: BranchRow;
  pending: boolean;
  start: React.TransitionStartFunction;
}) {
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(branch.name);
  const [address, setAddress] = React.useState(branch.address ?? "");
  const [phone, setPhone] = React.useState(branch.phone ?? "");

  function save() {
    if (!name.trim()) {
      toast.error("Enter a branch name");
      return;
    }
    start(async () => {
      const res = await updateBranch({
        id: branch.id,
        name: name.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Branch updated");
        setEditing(false);
      }
    });
  }

  function toggle() {
    start(async () => {
      const res = await setBranchActive({
        id: branch.id,
        isActive: !branch.is_active,
      });
      if ("error" in res) toast.error(res.error);
      else toast.success(branch.is_active ? "Branch archived" : "Branch restored");
    });
  }

  if (editing) {
    return (
      <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Address</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="flex gap-2 sm:col-span-3">
          <Button onClick={save} disabled={pending} size="sm">
            Save
          </Button>
          <Button
            onClick={() => setEditing(false)}
            variant="outline"
            size="sm"
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{branch.name}</span>
            {!branch.is_active ? (
              <Badge variant="outline" className="text-muted-foreground">
                Archived
              </Badge>
            ) : null}
          </div>
          {branch.address ? (
            <p className="truncate text-xs text-muted-foreground">
              {branch.address}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          onClick={() => setEditing(true)}
          variant="outline"
          size="sm"
          disabled={pending}
        >
          Edit
        </Button>
        <Button
          onClick={toggle}
          variant={branch.is_active ? "ghost" : "outline"}
          size="sm"
          disabled={pending}
        >
          {branch.is_active ? "Archive" : "Restore"}
        </Button>
      </div>
    </div>
  );
}
