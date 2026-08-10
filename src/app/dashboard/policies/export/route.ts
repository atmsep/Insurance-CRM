import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { POLICY_STATUS_LABELS as STATUS_LABELS } from "../policy-labels";
import { getOutstandingByPolicy } from "../balance";

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const client = searchParams.get("client");
  const line = searchParams.get("line");
  const carrier = searchParams.get("carrier");
  const status = searchParams.get("status");
  const risk = searchParams.get("risk");
  const expiring = searchParams.get("expiring");
  const ids = searchParams.get("ids");

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
    if (expiring) {
      const days = Number(expiring) || 30;
      const until = new Date();
      until.setDate(until.getDate() + days);
      query = query.eq("status", "active").lte("end_date", until.toISOString().slice(0, 10));
    }
    if (q) query = query.ilike("policy_number", `%${q}%`);
    if (client) query = query.ilike("clients.display_name", `%${client}%`);
    if (line) query = query.eq("insurance_line_id", line);
    if (carrier) query = query.eq("carrier_id", carrier);
    if (status) query = query.eq("status", status);
    if (risk) query = query.ilike("risk_label", `%${risk}%`);
  }

  const { data: policies } = await query;
  const outstandingByPolicy = await getOutstandingByPolicy(supabase, policies ?? []);

  const rows = (policies ?? []).map((p) => {
    const client = p.clients as unknown as { display_name: string | null } | null;
    const line = p.insurance_lines as unknown as { name_el: string } | null;
    const carrier = p.carriers as unknown as { name: string } | null;
    const outstanding = outstandingByPolicy.get(p.id);
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
      outstanding: outstanding ?? "",
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
    { key: "outstanding", label: "Υπόλοιπο" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "symvolaia.csv");
}
