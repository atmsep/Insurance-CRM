export type ProductionFilters = {
  document?: string;
  policyNumber?: string;
  risk?: string;
  clientName?: string;
  agentIds?: string[];
  carrierId?: string;
  lineId?: string;
  kinds?: string[];
  status?: string;
  issueFrom?: string;
  issueTo?: string;
  startFrom?: string;
  startTo?: string;
  sort?: string;
  dir?: "asc" | "desc";
};

type SearchParamsInput = Record<string, string | undefined>;

export function parseProductionFilters(sp: SearchParamsInput): ProductionFilters {
  return {
    document: sp.document || undefined,
    policyNumber: sp.policy_number || undefined,
    risk: sp.risk || undefined,
    clientName: sp.client || undefined,
    agentIds: sp.agent ? sp.agent.split(",").filter(Boolean) : undefined,
    carrierId: sp.carrier || undefined,
    lineId: sp.line || undefined,
    kinds: sp.kind ? sp.kind.split(",").filter(Boolean) : undefined,
    status: sp.status || undefined,
    issueFrom: sp.issue_from || undefined,
    issueTo: sp.issue_to || undefined,
    startFrom: sp.start_from || undefined,
    startTo: sp.start_to || undefined,
    sort: sp.sort || undefined,
    dir: sp.dir === "asc" || sp.dir === "desc" ? sp.dir : undefined,
  };
}

type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  in(column: string, values: unknown[]): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
};

// Base "table" is the production_entries view (migration 0089) — fully
// denormalized (no embedded/nested columns), so every filter targets a
// flat column directly instead of PostgREST's dot-path embedded-filter
// syntax the old policy_movements-backed query needed.
export function applyProductionFilters<T extends FilterableQuery<T>>(query: T, filters: ProductionFilters): T {
  let q = query;
  if (filters.document) q = q.ilike("document_number", `%${filters.document}%`);
  if (filters.policyNumber) q = q.ilike("policy_number", `%${filters.policyNumber}%`);
  if (filters.risk) q = q.ilike("risk_label", `%${filters.risk}%`);
  if (filters.clientName) q = q.ilike("client_name", `%${filters.clientName}%`);
  if (filters.agentIds?.length) q = q.in("outgoing_agent_id", filters.agentIds);
  if (filters.carrierId) q = q.eq("carrier_id", filters.carrierId);
  if (filters.lineId) q = q.eq("insurance_line_id", filters.lineId);
  if (filters.kinds?.length) q = q.in("kind", filters.kinds);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.issueFrom) q = q.gte("issue_date", filters.issueFrom);
  if (filters.issueTo) q = q.lte("issue_date", filters.issueTo);
  if (filters.startFrom) q = q.gte("start_date", filters.startFrom);
  if (filters.startTo) q = q.lte("start_date", filters.startTo);
  return q;
}

export { PER_PAGE_OPTIONS, parsePerPage } from "../../policies/filters";
