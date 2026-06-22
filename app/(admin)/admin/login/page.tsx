import { ShieldCheck } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function AdminLoginPage() {
  return (
    <div className="dark app-shell flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="size-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Platform Admin</h1>
          <p className="text-sm text-muted-foreground">Super-admin access only</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your admin email and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInForm redirectTo="/admin" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
