import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getRecentFeedback } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requirePlatformAdmin();
  const feedback = await getRecentFeedback(100);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted-foreground">Messages submitted by subscribers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All feedback ({feedback.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No feedback yet.</p>
          ) : (
            <div className="divide-y">
              {feedback.map((f) => (
                <div key={f.id} className="grid gap-1 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="capitalize">{f.category}</Badge>
                    <span>{f.orgName ?? "—"}</span>
                    {f.userEmail ? <span>· {f.userEmail}</span> : null}
                    <span className="ml-auto">{new Date(f.createdAt).toLocaleDateString("en-PH")}</span>
                  </div>
                  <p className="whitespace-pre-line text-sm">{f.message}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
