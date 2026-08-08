import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";

const STATUS_LABELS: Record<string, string> = {
  draft: "Πρόχειρο",
  active: "Ενεργό",
  pending_renewal: "Προς ανανέωση",
  expired: "Ληγμένο",
  cancelled: "Ακυρωμένο",
  lapsed: "Διακοπή",
};

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const client = searchParams.get("client");
  const line = searchParams.get("line");
  const carrier = searchParams.get("carrier");
  const status = searchParams.get("status");
  const expiring = searchParams.get("expiring");

  let query = supabase
    .from("policies")
    .select(
      "policy_number, status, end_date, premium_gross, premium_net, insurance_lines(name_el), carriers(name), clients!inner(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(5000);

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

  const { data: policies } = await query;

  const rows = (policies ?? []).map((p) => {
    const client = p.clients as unknown as { display_name: string | null } | null;
    const line = p.insurance_lines as unknown as { name_el: string } | null;
    const carrier = p.carriers as unknown as { name: string } | null;
    return {
      policy_number: p.policy_number,
      client: client?.display_name ?? "",
      line: line?.name_el ?? "",
      carrier: carrier?.name ?? "",
      end_date: p.end_date,
      premium_gross: p.premium_gross,
      premium_net: p.premium_net ?? "",
      status: STATUS_LABELS[p.status] ?? p.status,
    };
  });

  const csv = toCsv(rows, [
    { key: "policy_number", label: "Αριθμός" },
    { key: "client", label: "Πελάτης" },
    { key: "line", label: "Κλάδος" },
    { key: "carrier", label: "Εταιρεία" },
    { key: "end_date", label: "Λήξη" },
    { key: "premium_gross", label: "Μικτό ασφάλιστρο" },
    { key: "premium_net", label: "Καθαρό ασφάλιστρο" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "symvolaia.csv");
}
