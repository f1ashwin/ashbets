import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Use in Server Components / Server Actions / route handlers that require a
 * signed-in user. Middleware already blocks unauthenticated requests before
 * reaching these — this helper exists so the rest of the codebase has a typed
 * `User` to read without nullable checks.
 */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (allowedEmail && user.email !== allowedEmail) {
    redirect("/login?error=unauthorized");
  }

  return user;
}

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
