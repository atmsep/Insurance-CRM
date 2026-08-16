import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { POLICY_STATUS_LABELS as STATUS_LABELS } from "../policy-labels";
import { parsePolicyFilters, applyPolicyFilters } from "../filters";

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams: sp } = new URL(request.url);
  const filters = parsePolicyFilters(Object.fromEntries(sp.entries()));
  const ids = sp.get("ids");

  let query = supabase
    .from("policies")
    .select(
      "id, policy_number, status, issue_date, start_date, end_date, premium_gross, premium_net, risk_label, renewal_number, insurance_lines(name_el), carriers(name), clients!inner(display_name)",
    )
    .eq("is_current_term", true)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (ids) {
    query = query.in("id", ids.split(","));
  } else {
    query = applyPolicyFilters(query, filters);
  }

  const { data: policies } = await query;

  const rows = (policies ?? []).map((p) => {
    const client = p.clients as unknown as { display_name: string | null } | null;
    const line = p.insurance_lines as unknown as { name_el: string } | null;
    const carrier = p.carriers as unknown as { name: string } | null;
    return {
      risk: p.risk_label ?? "",
      policy_number: p.policy_number,
      renewal_number: p.renewal_number,
      client: client?.display_name ?? "",
      line: line?.name_el ?? "",
      carrier: carrier?.name ?? "",
      issue_date: p.issue_date ?? "",
      start_date: p.start_date,
      end_date: p.end_date,
      premium_gross: p.premium_gross,
      premium_net: p.premium_net ?? "",
      status: STATUS_LABELS[p.status] ?? p.status,
    };
  });

  const csv = toCsv(rows, [
    { key: "risk", label: "Χαρακτηριστικό" },
    { key: "policy_number", label: "Αριθμός" },
    { key: "renewal_number", label: "Αρ. Ανανέωσης" },
    { key: "client", label: "Πελάτης" },
    { key: "line", label: "Κλάδος" },
    { key: "carrier", label: "Εταιρεία" },
    { key: "issue_date", label: "Έκδοση" },
    { key: "start_date", label: "Έναρξη" },
    { key: "end_date", label: "Λήξη" },
    { key: "premium_gross", label: "Μικτό ασφάλιστρο" },
    { key: "premium_net", label: "Καθαρό ασφάλιστρο" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "symvolaia.csv");
}
