"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=credentials");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect("/login?error=credentials");
  }

  // Enforce single-user allowlist at sign-in too — without this, an
  // unauthorised user would briefly hold a session before the proxy bounces
  // them on the next request.
  const allowedEmail = process.env.ALLOWED_EMAIL;
  if (allowedEmail && email !== allowedEmail) {
    await supabase.auth.signOut();
    redirect("/login?error=unauthorized");
  }

  redirect("/");
}
