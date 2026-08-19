import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import { POLICY_MOVEMENT_KIND_LABELS } from "../../../policies/movement-labels";
import { parseProductionFilters } from "../filters";
import { getOutgoingCommissionsByMovement } from "../commissions";
import { fetchAllProductionEntries } from "../data";

export async function GET(request: Request) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { searchParams: sp } = new URL(request.url);
  const filters = parseProductionFilters(Object.fromEntries(sp.entries()));

  const rows = await fetchAllProductionEntries(admin, filters);

  const commissionByMovement = await getOutgoingCommissionsByMovement(
    admin,
    rows.map((r) => ({ id: r.id, isReal: r.is_real })),
  );

  const csvRows = rows.map((r) => ({
    agent: r.agent_name ?? "",
    policy_number: r.policy_number,
    document: r.document_number ?? "",
    carrier: r.carrier_name ?? "",
    kind: POLICY_MOVEMENT_KIND_LABELS[r.kind] ?? r.kind,
    line: r.line_name ?? "",
    risk: r.risk_label ?? "",
    issue_date: r.issue_date,
    start_date: r.start_date,
    end_date: r.end_date,
    client: r.client_name ?? "",
    phone: [r.phone_mobile, r.phone_landline].filter(Boolean).join(" / "),
    premium_gross: r.premium_gross,
    premium_net: r.premium_net ?? "",
    commission: commissionByMovement.get(r.id) ?? "",
  }));

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
