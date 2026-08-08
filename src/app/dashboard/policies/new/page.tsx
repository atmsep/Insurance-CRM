import { createClient } from "@/lib/supabase/server";
import { PolicyForm, type RenewFromData } from "../policy-form";
import type { PaymentFrequency } from "@/lib/database.types";

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

function addYears(dateStr: string, years: number) {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export default async function NewPolicyPage({
  searchParams,
}: {
  searchParams: Promise<{ client_id?: string; renew_from?: string }>;
}) {
  const { client_id, renew_from } = await searchParams;
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

  let renewFrom: RenewFromData | undefined;
  let defaultClientId = client_id;
  let defaultCarrierId: string | undefined;
  let defaultLineId: string | undefined;

  if (renew_from) {
    const { data: source } = await supabase
      .from("policies")
      .select("*")
      .eq("id", renew_from)
      .single();

    if (source) {
      const [{ data: vehicle }, { data: property }, { data: lifeHealth }] = await Promise.all([
        supabase.from("policy_vehicle_details").select("*").eq("policy_id", source.id).maybeSingle(),
        supabase.from("policy_property_details").select("*").eq("policy_id", source.id).maybeSingle(),
        supabase.from("policy_life_health_details").select("*").eq("policy_id", source.id).maybeSingle(),
      ]);

      defaultClientId = source.client_id;
      defaultCarrierId = source.carrier_id;
      defaultLineId = source.insurance_line_id;

      renewFrom = {
        policyId: source.id,
        policyGroupId: source.policy_group_id,
        policyNumber: source.policy_number,
        startDate: source.end_date,
        endDate: addYears(source.end_date, 1),
        premiumGross: source.premium_gross,
        premiumNet: source.premium_net,
        taxesFees: source.taxes_fees,
        paymentFrequency: source.payment_frequency as PaymentFrequency,
        vehicle: vehicle ?? undefined,
        property: property ?? undefined,
        lifeHealth: lifeHealth ?? undefined,
      };
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{renewFrom ? "Ανανέωση συμβολαίου" : "Νέο συμβόλαιο"}</h1>
      <PolicyForm
        clients={clientOptions}
        carriers={carriers ?? []}
        insuranceLines={insuranceLines ?? []}
        defaultClientId={defaultClientId}
        defaultCarrierId={defaultCarrierId}
        defaultLineId={defaultLineId}
        renewFrom={renewFrom}
      />
    </div>
  );
}
