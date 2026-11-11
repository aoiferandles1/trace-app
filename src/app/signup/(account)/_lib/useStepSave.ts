"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePatientSession } from "@/components/patient/PatientSession";
import { createClient } from "@/lib/supabase/client";
import { nextStep, pathForStep, stepIndex } from "@/lib/patient/auth";
import type { OnboardingStep } from "@/lib/patient/types";
import type { TablesUpdate } from "@/lib/supabase/database.types";

/**
 * Saves a sign-up step's fields and moves on. The step reached only ever moves
 * forward, so going back to fix something does not lose later progress.
 * Leaving at any point and signing in again resumes at the step reached.
 */
export function useStepSave(step: Exclude<OnboardingStep, "done">) {
  const router = useRouter();
  const { profile, setProfile } = usePatientSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(fields: TablesUpdate<"profiles">, goTo?: string) {
    setBusy(true);
    setError(null);
    const next = nextStep(step);
    const reached = stepIndex(next) > stepIndex(profile.onboarding_step) ? next : profile.onboarding_step;
    const supabase = createClient();
    const { data, error: saveError } = await supabase
      .from("profiles")
      .update({ ...fields, onboarding_step: reached })
      .eq("id", profile.id)
      .select("*")
      .single();
    if (saveError || !data) {
      setBusy(false);
      setError("Your details couldn't be saved. Check your connection and try again.");
      return false;
    }
    setProfile(data);
    router.push(goTo ?? pathForStep(next));
    return true;
  }

  return { save, busy, error, profile };
}
