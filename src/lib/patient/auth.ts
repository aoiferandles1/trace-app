import type { AuthError } from "@supabase/supabase-js";
import type { OnboardingStep } from "./types";

/**
 * Sign-up steps after the email code (profiles.onboarding_step), in order,
 * with their routes and their number on the progress bar (steps 1 and 2 are
 * the email and the code).
 */
export const STEPS: { step: Exclude<OnboardingStep, "done">; path: string; number: number }[] = [
  { step: "about", path: "/signup/about", number: 3 },
  { step: "medical", path: "/signup/medical", number: 4 },
  { step: "privacy", path: "/signup/privacy", number: 5 },
  { step: "profiles", path: "/signup/profiles", number: 6 },
  { step: "welcome", path: "/signup/welcome", number: 7 },
];

export function stepIndex(step: string): number {
  if (step === "done") return STEPS.length;
  const i = STEPS.findIndex((s) => s.step === step);
  return i < 0 ? 0 : i;
}

/** Where a signed-in person belongs: their unfinished step, or home. */
export function pathForStep(step: string | null | undefined): string {
  if (!step || step === "done") return "/home";
  return STEPS.find((s) => s.step === step)?.path ?? STEPS[0].path;
}

/** The step after this one ("done" after welcome). */
export function nextStep(step: Exclude<OnboardingStep, "done">): OnboardingStep {
  const i = stepIndex(step);
  return STEPS[i + 1]?.step ?? "done";
}

/** Session storage key for the email between the email step and the code step. */
export const PENDING_EMAIL_KEY = "trace:pending-email";

export const INVITE_ONLY = "Trace is invite-only for now.";

export const NO_ACCOUNT = "We couldn't find an account for that email.";

/** Session storage key for the email typed on sign in, so a reload of the code step keeps it (A37). */
export const LOGIN_EMAIL_KEY = "trace:login-email";

/**
 * Words for the errors Supabase Auth returns on the email and code steps.
 * The invite trigger makes sign-up of an uninvited email fail with HTTP 500
 * "Database error saving new user" (supabase/README.md section 7).
 */
export function authErrorMessage(error: AuthError | Error, stage: "send" | "verify" | "login"): string {
  const message = error.message ?? "";
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  if (message.includes("Database error saving new user") || code === "unexpected_failure") {
    return INVITE_ONLY;
  }
  if (stage === "login" && (code === "otp_disabled" || /signups not allowed/i.test(message))) {
    return NO_ACCOUNT;
  }
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit" || /rate limit|security purposes/i.test(message)) {
    return "Too many emails were sent. Wait a minute, then try again.";
  }
  if (code === "email_address_invalid" || code === "validation_failed") {
    return "Enter an email address like name@example.ie";
  }
  if (stage === "verify" && (code === "otp_expired" || /expired|invalid/i.test(message))) {
    return "That code didn't work. Check it, or ask for a new code.";
  }
  if (/fetch|network/i.test(message)) {
    return "Trace couldn't connect. Check your connection and try again.";
  }
  return "Something went wrong. Try again in a moment.";
}

/** The plain message for a failed "Try the demo". */
export function demoErrorMessage(error: AuthError | Error): string {
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  if (code === "anonymous_provider_disabled" || /anonymous sign-ins are disabled/i.test(error.message)) {
    return "The demo is switched off right now. Try again later.";
  }
  if (code === "over_request_rate_limit" || /rate limit/i.test(error.message)) {
    return "The demo is busy right now. Try again in a few minutes.";
  }
  return "The demo couldn't start. Try again in a moment.";
}

/** A loose check before sending; Supabase does the real one. */
export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
