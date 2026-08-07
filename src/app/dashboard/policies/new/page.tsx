import { createClient } from "@/lib/supabase/server";
import { PolicyForm } from "../policy-form";

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

export default async function NewPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string }>;
}) {
  const { client_id } = await searchParams;
  const supabase = await createClient();

  const [{ data: clients }, { data: carriers }, { data: insuranceLines }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, client_type, client_individuals(first_name,last_name), client_legal_entities(company_name)")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("carriers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("insurance_lines")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  const clientOptions = (clients ?? []).map((c) => ({
    id: c.id,
    name: clientDisplayName(c as never),
  }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Νέο συμβόλαιο</h1>
      <PolicyForm
        clients={clientOptions}
        carriers={carriers ?? []}
        insuranceLines={insuranceLines ?? []}
        defaultClientId={client_id}
      />
    </div>
  );
}
