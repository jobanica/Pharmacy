import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ACTIVE_BRANCH_COOKIE } from "@/lib/auth/session";

/**
 * GET /api/switch-branch?id=<branchId>&next=<path>
 *
 * Sets the active-branch cookie then redirects back to the page the user
 * was on. Using a proper HTTP redirect is more reliable than calling a
 * server action + window.location.reload() from the client.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const branchId = searchParams.get("id");
  const next = searchParams.get("next") ?? "/dashboard";

  // Validate that next is a relative path (no open-redirect risk).
  const safePath = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (branchId) {
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BRANCH_COOKIE, branchId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return NextResponse.redirect(new URL(safePath, request.url));
}
