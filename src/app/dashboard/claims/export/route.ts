import { createClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { toCsv, csvResponse } from "@/lib/csv";
import { resolveClientName } from "@/lib/client-name";
import { CLAIM_STATUS_LABELS as STATUS_LABELS } from "../claim-labels";

export async function GET(request: Request) {
  await requireAgencyUser();
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const status = searchParams.get("status");
  const open = searchParams.get("open");
  const ids = searchParams.get("ids");

  let query = supabase
    .from("claims")
    .select(
      "claim_number, status, date_of_loss, claim_amount_estimated, policies(policy_number, clients(client_individuals(first_name,last_name), client_legal_entities(company_name)))",
    )
    .order("date_of_loss", { ascending: false })
    .limit(5000);

  if (ids) {
    query = query.in("id", ids.split(","));
  } else {
    if (q) query = query.ilike("claim_number", `%${q}%`);
    if (status) query = query.eq("status", status);
    else if (open) query = query.not("status", "in", "(paid,closed)");
  }

  const { data: claims } = await query;

  const rows = (claims ?? []).map((c) => {
    const policy = c.policies as unknown as {
      policy_number: string;
      clients: {
        client_individuals: { first_name: string; last_name: string } | null;
        client_legal_entities: { company_name: string } | null;
      } | null;
    } | null;
    return {
      claim_number: c.claim_number ?? "",
      policy_number: policy?.policy_number ?? "",
      client: resolveClientName(policy?.clients),
      date_of_loss: c.date_of_loss,
      claim_amount_estimated: c.claim_amount_estimated ?? "",
      status: STATUS_LABELS[c.status] ?? c.status,
    };
  });

  const csv = toCsv(rows, [
    { key: "claim_number", label: "Αριθμός ζημιάς" },
    { key: "policy_number", label: "Συμβόλαιο" },
    { key: "client", label: "Πελάτης" },
    { key: "date_of_loss", label: "Ημ. ζημιάς" },
    { key: "claim_amount_estimated", label: "Εκτιμώμενο ποσό" },
    { key: "status", label: "Κατάσταση" },
  ]);

  return csvResponse(csv, "zimies.csv");
}
