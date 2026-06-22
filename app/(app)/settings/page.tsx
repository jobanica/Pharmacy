import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAppContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/roles";

export default async function SettingsOrganizationPage() {
  const ctx = await requireAppContext();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization</CardTitle>
        <CardDescription>Your pharmacy business account.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Name</span>
          <span className="font-medium">{ctx.organization.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Your role</span>
          <span className="font-medium">{ROLE_LABELS[ctx.role]}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Branches</span>
          <span className="font-medium">{ctx.branches.length}</span>
        </div>
      </CardContent>
    </Card>
  );
}
