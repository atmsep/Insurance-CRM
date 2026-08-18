export type RemittanceFilters = {
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
};

type SearchParamsInput = Record<string, string | undefined>;

export function parseRemittanceFilters(sp: SearchParamsInput): RemittanceFilters {
  return {
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
  };
}

type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  in(column: string, values: unknown[]): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
};

// Unlike production_entries (a flat view), the base table here is
// policy_movements itself with policies/clients embedded — every
// policy-level filter is a dot-path through the embed instead of a plain
// column. Confirmed live that PostgREST supports filtering (not just
// selecting) two hops deep through !inner embeds on this schema
// (policies.clients.display_name) before relying on it here.
export function applyRemittanceFilters<T extends FilterableQuery<T>>(query: T, filters: RemittanceFilters): T {
  let q = query;
  if (filters.policyNumber) q = q.ilike("policies.policy_number", `%${filters.policyNumber}%`);
  if (filters.risk) q = q.ilike("policies.risk_label", `%${filters.risk}%`);
  if (filters.clientName) q = q.ilike("policies.clients.display_name", `%${filters.clientName}%`);
  if (filters.agentIds?.length) q = q.in("policies.assigned_agent_id", filters.agentIds);
  if (filters.carrierId) q = q.eq("policies.carrier_id", filters.carrierId);
  if (filters.lineId) q = q.eq("policies.insurance_line_id", filters.lineId);
  if (filters.kinds?.length) q = q.in("kind", filters.kinds);
  if (filters.status) q = q.eq("policies.status", filters.status);
  if (filters.issueFrom) q = q.gte("issue_date", filters.issueFrom);
  if (filters.issueTo) q = q.lte("issue_date", filters.issueTo);
  if (filters.startFrom) q = q.gte("start_date", filters.startFrom);
  if (filters.startTo) q = q.lte("start_date", filters.startTo);
  return q;
}
