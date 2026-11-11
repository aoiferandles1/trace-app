import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { pathForStep } from "@/lib/patient/auth";

/**
 * The emailed sign-in link lands here (PLAN.md section 0).
 *
 * - `?token_hash=...&type=email` (or magiclink, signup): the template sends
 *   the hash straight here; verifyOtp signs the person in.
 * - `?code=...`: Supabase's default link goes through Supabase first and
 *   comes back with a PKCE code, which only works in the browser that asked
 *   for the email.
 *
 * Then on to the person's sign-up step, or /home. A bad or used link goes to
 * /auth/link-expired.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  const supabase = await createClient();
  let userId: string | null = null;

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) userId = data.user?.id ?? null;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) userId = data.user?.id ?? null;
  }

  if (!userId) {
    return NextResponse.redirect(new URL("/auth/link-expired", url.origin));
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_step")
    .eq("id", userId)
    .maybeSingle();
  return NextResponse.redirect(new URL(pathForStep(profile?.onboarding_step ?? "about"), url.origin));
}
