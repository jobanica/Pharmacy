"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Tags, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory, deleteCategory } from "@/lib/catalog/actions";

type Category = { id: string; name: string; product_count: number };

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [pending, startTransition] = React.useTransition();

  function add() {
    const value = name.trim();
    if (!value) return;
    startTransition(async () => {
      const res = await createCategory({ name: value });
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Category added");
        setName("");
        router.refresh();
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteCategory(id);
      if ("error" in res) toast.error(res.error);
      else {
        toast.success("Category removed");
        router.refresh();
      }
    });
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline">
            <Tags className="size-4" />
            Categories
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Removing a category leaves its products uncategorized.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New category name"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
          <Button onClick={add} disabled={pending}>
            <Plus className="size-4" />
            Add
          </Button>
        </div>

        <div className="grid gap-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <span>
                  {c.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {c.product_count} product{c.product_count === 1 ? "" : "s"}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  disabled={pending}
                  onClick={() => remove(c.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
