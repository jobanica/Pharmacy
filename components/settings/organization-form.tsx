"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOrganization } from "@/lib/organization/actions";

export function OrganizationForm({
  name,
  role,
  branchCount,
  canEdit,
}: {
  name: string;
  role: string;
  branchCount: number;
  canEdit: boolean;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(name);
  const [pending, start] = React.useTransition();

  function save() {
    if (!value.trim()) {
      toast.error("Enter a pharmacy name");
      return;
    }
    start(async () => {
      const res = await updateOrganization({ name: value.trim() });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Organization updated");
        setEditing(false);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Organization</CardTitle>
            <CardDescription>Your pharmacy business account.</CardDescription>
          </div>
          {canEdit && !editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        {editing ? (
          <div className="grid gap-2">
            <Label htmlFor="org-name">Pharmacy name</Label>
            <Input
              id="org-name"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="max-w-md"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setValue(name);
                  setEditing(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{name}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Your role</span>
          <span className="font-medium">{role}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Branches</span>
          <span className="font-medium">{branchCount}</span>
        </div>
      </CardContent>
    </Card>
  );
}
