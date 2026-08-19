import { createAdminClient } from "@/lib/supabase/admin";
import { parseProductionFilters, applyProductionFilters } from "./filters";

// production_entries (migration 0089) is a fully denormalized view — real
// policy_movements rows unioned with synthetic rows for legacy policies
// terms that predate the movements table — so every column here is a
// plain, 0-hop column. No embedding, so no PGRST201-ambiguity or
// embedded-order risk to design around.
export const PRODUCTION_EXPORT_SELECT =
  "id, is_real, kind, document_number, issue_date, start_date, end_date, premium_net, premium_gross, " +
  "agent_name, policy_number, risk_label, carrier_name, line_name, client_name, phone_mobile, phone_landline";

export type ProductionExportRow = {
  id: string;
  is_real: boolean;
  kind: string;
  document_number: string | null;
  issue_date: string;
  start_date: string;
  end_date: string;
  premium_net: number | null;
  premium_gross: number;
  agent_name: string | null;
  policy_number: string;
  risk_label: string | null;
  carrier_name: string | null;
  line_name: string | null;
  client_name: string | null;
  phone_mobile: string | null;
  phone_landline: string | null;
};

// The hosted project's PostgREST caps any single response at 1000 rows
// (db-max-rows) regardless of .limit() — confirmed live: an unfiltered
// export silently came back truncated to exactly 1000 rows, sorted
// newest-issue-date-first, so EVERY expired policy (by definition older
// than anything still active) was cut off entirely. Fetching in chunks of
// 1000 via .range() and concatenating sidesteps the cap correctly. Needs
// a deterministic tiebreaker (id) alongside issue_date — plain date
// columns have huge numbers of ties (many policies issued the same day),
// and OFFSET/LIMIT across repeated queries isn't guaranteed stable for
// tied rows without one, which could otherwise skip or duplicate rows
// across chunk boundaries. Shared by the CSV export route and the print
// view — both need the whole filtered set, not one paginated screenful.
const CHUNK_SIZE = 1000;
const MAX_EXPORT_ROWS = 30000;

export async function fetchAllProductionEntries(
  admin: ReturnType<typeof createAdminClient>,
  filters: ReturnType<typeof parseProductionFilters>,
): Promise<ProductionExportRow[]> {
  const rows: ProductionExportRow[] = [];
  for (let offset = 0; offset < MAX_EXPORT_ROWS; offset += CHUNK_SIZE) {
    let query = admin
      .from("production_entries")
      .select(PRODUCTION_EXPORT_SELECT)
      .order("issue_date", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, offset + CHUNK_SIZE - 1);
    query = applyProductionFilters(query, filters);

    const { data, error } = await query;
    if (error) break;
    const batch = (data ?? []) as unknown as ProductionExportRow[];
    rows.push(...batch);
    if (batch.length < CHUNK_SIZE) break;
  }
  return rows;
}
