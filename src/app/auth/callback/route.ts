import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=callback`);
  }

  // Enforce single-user allowlist at the callback boundary too, so an
  // unauthorised user is signed out immediately instead of bouncing through
  // the middleware on the next request.
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (allowedEmail) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && user.email !== allowedEmail) {
      await supabase.auth.signOut();
      return NextResponse.redirect(`${origin}/login?error=unauthorized`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
