"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CodeInput } from "@/components/ui/CodeInput";
import { TextField } from "@/components/ui/TextField";
import { createClient } from "@/lib/supabase/client";
import { authErrorMessage, looksLikeEmail, pathForStep } from "@/lib/patient/auth";

/**
 * The email and code steps, shared by sign-up (p-create, p-verify) and sign in
 * (/login, no Figma frame of its own, so it reuses these two).
 *
 * Sign-up sends with `shouldCreateUser: true`; the invite trigger refuses an
 * uninvited email and this shows "Trace is invite-only for now.". Sign in
 * sends with `shouldCreateUser: false`, so it never creates an account.
 *
 * Supabase's email carries a link until the template is changed to send the
 * code, so the code step also says the link works (PLAN.md section 0). The
 * link lands on /auth/confirm.
 */

export async function sendEmailCode(email: string, mode: "signup" | "login") {
  const supabase = createClient();
  return supabase.auth.signInWithOtp({
    email: email.trim(),
    options: {
      shouldCreateUser: mode === "signup",
      emailRedirectTo: `${window.location.origin}/auth/confirm`,
    },
  });
}

export function EmailForm({
  mode,
  onSent,
}: {
  mode: "signup" | "login";
  onSent: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!looksLikeEmail(email)) {
      setError("Enter an email address like name@example.ie");
      inputRef.current?.focus();
      return;
    }
    setBusy(true);
    setError(null);
    const { error: sendError } = await sendEmailCode(email, mode);
    setBusy(false);
    if (sendError) {
      setError(authErrorMessage(sendError, mode === "login" ? "login" : "send"));
      inputRef.current?.focus();
      return;
    }
    onSent(email.trim());
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <TextField
        ref={inputRef}
        label="Email address"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        placeholder="janedoe@email.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={error}
      />
      <Button type="submit" size="lg" fullWidth loading={busy} className="mt-7">
        Continue
      </Button>
    </form>
  );
}

export function CodeForm({ email, mode }: { email: string; mode: "signup" | "login" }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function verify(value: string) {
    if (value.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email, token: value, type: "email" });
    if (verifyError || !data.user) {
      setBusy(false);
      setError(verifyError ? authErrorMessage(verifyError, "verify") : "That code didn't work. Check it, or ask for a new code.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_step")
      .eq("id", data.user.id)
      .maybeSingle();
    router.replace(pathForStep(profile?.onboarding_step ?? "about"));
  }

  async function resend() {
    setResending(true);
    setResent(null);
    const { error: sendError } = await sendEmailCode(email, mode);
    setResending(false);
    setResent(sendError ? authErrorMessage(sendError, mode === "login" ? "login" : "send") : "We sent a new code.");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      noValidate
      className="flex flex-col gap-6"
    >
      <CodeInput
        length={6}
        value={code}
        onChange={(v) => {
          setCode(v);
          if (error) setError(null);
        }}
        onComplete={(v) => void verify(v)}
        label="6-digit code"
        labelHidden
        hint="Or open the link in the email on this device."
        error={error}
        autoFocus
        disabled={busy}
      />
      <Button type="submit" size="lg" fullWidth loading={busy}>
        {mode === "signup" ? "Verify email" : "Sign in"}
      </Button>
      <div className="flex flex-col items-center gap-1">
        <Button variant="ghost" size="md" onClick={resend} loading={resending}>
          Didn&apos;t get it? Resend code
        </Button>
        <p role="status" className="min-h-5 text-center text-body-sm text-text-tertiary">
          {resent}
        </p>
      </div>
    </form>
  );
}
