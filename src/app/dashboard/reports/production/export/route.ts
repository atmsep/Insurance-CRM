import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../../policies/movement-labels";
import { parseProductionFilters, applyProductionFilters } from "../filters";
import { getOutgoingCommissionsByMovement } from "../commissions";

const EXPORT_SELECT =
  "id, kind, document_number, issue_date, start_date, end_date, premium_net, premium_gross, outgoing_agent_id, " +
  "agency_users!policy_movements_outgoing_agent_id_fkey(full_name), " +
  "policies!inner(policy_number, risk_label, carrier_id, insurance_line_id, " +
  "carriers(name), insurance_lines(name_el), " +
  "clients!inner(display_name, phone_mobile, phone_landline, client_individuals(first_name,last_name), client_legal_entities(company_name)))";

type ExportClient = {
  display_name: string | null;
  phone_mobile: string | null;
  phone_landline: string | null;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
} | null;

type ExportRow = {
  id: string;
  kind: string;
  document_number: string | null;
  issue_date: string;
  start_date: string;
  end_date: string;
  premium_net: number | null;
  premium_gross: number;
  agency_users: { full_name: string } | null;
  policies: {
    policy_number: string;
    risk_label: string | null;
    carriers: { name: string } | null;
    insurance_lines: { name_el: string } | null;
    clients: ExportClient;
  } | null;
};

function resolveClientName(client: ExportClient): string {
  if (!client) return "";
  if (client.client_individuals) {
    return `${client.client_individuals.first_name} ${client.client_individuals.last_name}`;
  }
  return client.client_legal_entities?.company_name ?? client.display_name ?? "";
}

export async function GET(request: Request) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { searchParams: sp } = new URL(request.url);
  const filters = parseProductionFilters(Object.fromEntries(sp.entries()));

  let query = admin
    .from("policy_movements")
    .select(EXPORT_SELECT)
    .order("issue_date", { ascending: false })
    .limit(5000);

  query = applyProductionFilters(query, filters);

  const { data } = await query;
  const rows = (data ?? []) as unknown as ExportRow[];

  const commissionByMovement = await getOutgoingCommissionsByMovement(
    admin,
    rows.map((r) => r.id),
  );

  const csvRows = rows.map((r) => {
    const policy = r.policies;
    const client = policy?.clients ?? null;
    return {
      agent: r.agency_users?.full_name ?? "",
      policy_number: policy?.policy_number ?? "",
      document: r.document_number ?? "",
      carrier: policy?.carriers?.name ?? "",
      kind: POLICY_MOVEMENT_KIND_LABELS[r.kind] ?? r.kind,
      line: policy?.insurance_lines?.name_el ?? "",
      risk: policy?.risk_label ?? "",
      issue_date: r.issue_date,
      start_date: r.start_date,
      end_date: r.end_date,
      client: resolveClientName(client),
      phone: [client?.phone_mobile, client?.phone_landline].filter(Boolean).join(" / "),
      premium_gross: r.premium_gross,
      premium_net: r.premium_net ?? "",
      commission: commissionByMovement.get(r.id) ?? "",
    };
  });

  const csv = toCsv(csvRows, [
    { key: "agent", label: "Συνεργάτης" },
    { key: "policy_number", label: "Συμβόλαιο" },
    { key: "document", label: "Απόδειξη" },
    { key: "carrier", label: "Εταιρεία" },
    { key: "kind", label: "Είδος" },
    { key: "line", label: "Κλάδος" },
    { key: "risk", label: "Χαρακτηριστικό" },
    { key: "issue_date", label: "Έκδοση" },
    { key: "start_date", label: "Έναρξη" },
    { key: "end_date", label: "Λήξη" },
    { key: "client", label: "Πελάτης" },
    { key: "phone", label: "Σταθερό/Κινητό" },
    { key: "premium_gross", label: "Μικτά" },
    { key: "premium_net", label: "Καθαρά" },
    { key: "commission", label: "Προμήθεια Συνεργάτη" },
  ]);

  return csvResponse(csv, "paragogi.csv");
}
