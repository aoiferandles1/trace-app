import { createClient } from "@/lib/supabase/client";
import type { InsuranceConnection } from "./record";

/**
 * ============================================================================
 * MOCK INSURANCE ADAPTER: a stand-in for a real provider integration.
 * ============================================================================
 *
 * Owner's decision (11 Nov 2026): insurance is mocked on every account, real
 * or demo. No Irish insurer offers Trace a sign-in yet, so "signing in" with
 * a provider here does not contact the provider at all. It saves a sample
 * plan (VHI's is the one the InsuranceA2 board shows) through
 * `save_insurance` with `via: "provider"`.
 *
 * A real integration would replace `connectWithProvider` with an OAuth-style
 * redirect to the provider's own sign-in page and read the plan back with a
 * read-only token. Whatever replaces it: Trace never asks for, sees or stores
 * a provider password. `save_insurance` has no argument that could take one,
 * and the database keeps only the last four characters of the member number.
 */

/** The providers on the board, in its order. "Other provider" is manual entry. */
export const MOCK_PROVIDERS = ["VHI", "Laya Healthcare", "Irish Life Health"] as const;

/**
 * The sample plan each mocked sign-in returns. VHI's is InsuranceA2's (ending
 * 4821, "Comprehensive plan", renews 1 Mar 2027); the others differ, so the
 * stand-in does not give every insurer the same plan (E10). Made up, not
 * any insurer's real product names.
 */
const SAMPLE_PLANS: Record<string, { member_number: string; plan_name: string; renews_on: string }> = {
  VHI: { member_number: "MOCK-0000-4821", plan_name: "Comprehensive plan", renews_on: "2027-03-01" },
  "Laya Healthcare": { member_number: "MOCK-0000-7306", plan_name: "Essential plan", renews_on: "2027-06-15" },
  "Irish Life Health": { member_number: "MOCK-0000-2958", plan_name: "Select plan", renews_on: "2027-01-20" },
};

/** MOCK: "signs in" with the provider and saves the sample plan. No network call to any provider. */
export async function connectWithProvider(provider: string): Promise<InsuranceConnection> {
  const plan = SAMPLE_PLANS[provider] ?? SAMPLE_PLANS.VHI;
  const { data, error } = await createClient().rpc("save_insurance", {
    provider,
    member_number: plan.member_number,
    plan_name: plan.plan_name,
    renews_on: plan.renews_on,
    via: "provider",
  });
  if (error) throw error;
  return data as unknown as InsuranceConnection;
}
