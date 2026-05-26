import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const PUBLIC_PREFIXES = ["/login", "/auth/callback", "/auth/sign-out"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// Next.js 16 renamed Middleware to Proxy. The Supabase SSR docs still call
// this updateSession middleware — the pattern is unchanged, only the file
// convention is different. See node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
export default async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Cron endpoint authenticates via CRON_SECRET header, not session.
  if (pathname.startsWith("/api/cron")) {
    return response;
  }

  if (isPublic(pathname)) {
    return response;
  }

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Single-user allowlist. If ALLOWED_EMAIL is unset, any Supabase-
  // authenticated user is allowed (useful in dev / first login bootstrap).
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (allowedEmail && user.email !== allowedEmail) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "unauthorized");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
