import { createClient } from "@/lib/supabase/server";
import { PolicyForm, type RenewFromData } from "../policy-form";
import type { PaymentFrequency } from "@/lib/database.types";

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

  const [{ data: carriers }, { data: insuranceLines }] = await Promise.all([
    supabase.from("carriers").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("insurance_lines")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  let renewFrom: RenewFromData | undefined;
  let defaultClientId = client_id;
  let defaultClientLabel: string | undefined;
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

  if (defaultClientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("display_name")
      .eq("id", defaultClientId)
      .maybeSingle();
    defaultClientLabel = client?.display_name ?? undefined;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">{renewFrom ? "Ανανέωση συμβολαίου" : "Νέο συμβόλαιο"}</h1>
      <PolicyForm
        carriers={carriers ?? []}
        insuranceLines={insuranceLines ?? []}
        defaultClientId={defaultClientId}
        defaultClientLabel={defaultClientLabel}
        defaultCarrierId={defaultCarrierId}
        defaultLineId={defaultLineId}
        renewFrom={renewFrom}
      />
    </div>
  );
}
