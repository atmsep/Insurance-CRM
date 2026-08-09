import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "../claim-form";
import { resolveClientName } from "@/lib/client-name";

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ policy_id?: string }>;
}) {
  const { policy_id } = await searchParams;
  const supabase = await createClient();

  let defaultPolicyLabel: string | undefined;
  if (policy_id) {
    const { data: policy } = await supabase
      .from("policies")
      .select(
        "policy_number, clients(client_type, client_individuals(first_name,last_name), client_legal_entities(company_name))",
      )
      .eq("id", policy_id)
      .maybeSingle();

    if (policy) {
      defaultPolicyLabel = `${policy.policy_number} — ${resolveClientName(policy.clients as never)}`;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Νέα ζημιά</h1>
      <ClaimForm defaultPolicyId={policy_id} defaultPolicyLabel={defaultPolicyLabel} />
    </div>
  );
}
