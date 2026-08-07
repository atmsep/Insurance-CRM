import { createClient } from "@/lib/supabase/server";
import { ClaimForm } from "../claim-form";

function clientDisplayName(c: {
  client_type: string;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
}) {
  if (c.client_type === "individual" && c.client_individuals) {
    return `${c.client_individuals.first_name} ${c.client_individuals.last_name}`;
  }
  return c.client_legal_entities?.company_name ?? "—";
}

export default async function NewClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ policy_id?: string }>;
}) {
  const { policy_id } = await searchParams;
  const supabase = await createClient();

  const { data: policies } = await supabase
    .from("policies")
    .select(
      "id, policy_number, clients(client_type, client_individuals(first_name,last_name), client_legal_entities(company_name))",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const policyOptions = (policies ?? []).map((p) => {
    const client = p.clients as unknown as Parameters<typeof clientDisplayName>[0] | null;
    return {
      id: p.id,
      label: `${p.policy_number} — ${client ? clientDisplayName(client) : "—"}`,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Νέα ζημιά</h1>
      <ClaimForm policies={policyOptions} defaultPolicyId={policy_id} />
    </div>
  );
}
