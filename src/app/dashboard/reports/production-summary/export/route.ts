import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvResponse } from "@/lib/csv";
import { parseProductionFilters, parseGroupBy, GROUP_BY_LABELS } from "../filters";
import type { GroupedRow } from "../_components/grouped-table";

export async function GET(request: Request) {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  const admin = createAdminClient();
  const { searchParams: sp } = new URL(request.url);
  const filters = parseProductionFilters(Object.fromEntries(sp.entries()));
  const groupBy = parseGroupBy(sp.get("group_by") ?? undefined);
  const labels = GROUP_BY_LABELS[groupBy];

  const { data, error } = await admin.rpc("production_entries_grouped", {
    p_group_by: groupBy,
    p_document: filters.document ?? null,
    p_policy_number: filters.policyNumber ?? null,
    p_risk: filters.risk ?? null,
    p_client_name: filters.clientName ?? null,
    p_agent_ids: filters.agentIds ?? null,
    p_carrier_id: filters.carrierId ?? null,
    p_line_id: filters.lineId ?? null,
    p_kinds: filters.kinds ?? null,
    p_issue_from: filters.issueFrom ?? null,
    p_issue_to: filters.issueTo ?? null,
    p_start_from: filters.startFrom ?? null,
    p_start_to: filters.startTo ?? null,
    p_status: filters.status ?? null,
  });
  // Σφάλμα ποτέ σιωπηλό: χωρίς αυτό ένα timeout κατέβαζε ΑΔΕΙΟ αρχείο
  // που έμοιαζε με έγκυρη εξαγωγή «καμίας παραγωγής».
  if (error) {
    return new Response("Η εξαγωγή απέτυχε — στένεψε τα φίλτρα και δοκίμασε ξανά.", { status: 503 });
  }
  const rows = (data ?? []) as unknown as GroupedRow[];

  const csvRows = rows.map((r) => ({
    outer: r.outer_key,
    inner: r.inner_key,
    row_count: r.row_count,
    premium_gross: r.premium_gross_sum,
    premium_net: r.premium_net_sum,
    commission: r.commission_sum,
    diff: r.premium_gross_sum - r.commission_sum,
  }));

  const csv = toCsv(csvRows, [
    { key: "outer", label: labels.outer },
    { key: "inner", label: labels.inner },
    { key: "row_count", label: "Σύνολα" },
    { key: "premium_gross", label: "Μικτά" },
    { key: "premium_net", label: "Καθαρά" },
    { key: "commission", label: "Εξ.Προμήθεια" },
    { key: "diff", label: "Διαφορά" },
  ]);

  return csvResponse(csv, "paragogi-sygkentrotika.csv");
}
