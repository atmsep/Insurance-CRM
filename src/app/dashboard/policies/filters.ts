export type PolicyFilters = {
  q?: string;
  client?: string;
  line?: string;
  carrier?: string;
  status?: string;
  risk?: string;
  expiring?: string;
  recentlyExpired?: string;
  agentId?: string;
  brokerOfficeId?: string;
  startFrom?: string;
  startTo?: string;
  endFrom?: string;
  endTo?: string;
  premiumFrom?: string;
  premiumTo?: string;
  issueFrom?: string;
  issueTo?: string;
  premiumNetFrom?: string;
  premiumNetTo?: string;
  sort?: string;
  dir?: string;
};

type SearchParamsInput = Record<string, string | undefined>;

export function parsePolicyFilters(sp: SearchParamsInput): PolicyFilters {
  return {
    q: sp.q || undefined,
    client: sp.client || undefined,
    line: sp.line || undefined,
    carrier: sp.carrier || undefined,
    status: sp.status || undefined,
    risk: sp.risk || undefined,
    expiring: sp.expiring || undefined,
    recentlyExpired: sp.recently_expired || undefined,
    agentId: sp.agent || undefined,
    brokerOfficeId: sp.broker_office || undefined,
    startFrom: sp.start_from || undefined,
    startTo: sp.start_to || undefined,
    endFrom: sp.end_from || undefined,
    endTo: sp.end_to || undefined,
    premiumFrom: sp.premium_from || undefined,
    premiumTo: sp.premium_to || undefined,
    issueFrom: sp.issue_from || undefined,
    issueTo: sp.issue_to || undefined,
    premiumNetFrom: sp.premium_net_from || undefined,
    premiumNetTo: sp.premium_net_to || undefined,
    sort: sp.sort || undefined,
    dir: sp.dir === "asc" || sp.dir === "desc" ? sp.dir : undefined,
  };
}

type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  in(column: string, values: unknown[]): T;
  not(column: string, operator: string, value: unknown): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
  lt(column: string, value: unknown): T;
};

// "expiring"/"recently_expired" are handled separately by the caller (they
// also drive sort order, which this function deliberately doesn't touch)
// — everything else here is a plain WHERE-style filter shared between the
// list page and the CSV export.
export function applyPolicyFilters<T extends FilterableQuery<T>>(query: T, filters: PolicyFilters): T {
  let q = query;
  if (filters.expiring) {
    const days = Number(filters.expiring) || 30;
    const until = new Date();
    until.setDate(until.getDate() + days);
    q = q.in("status", ["active", "pending_renewal"]).lte("end_date", until.toISOString().slice(0, 10));
  }
  if (filters.recentlyExpired) {
    const days = Number(filters.recentlyExpired) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);
    const today = new Date().toISOString().slice(0, 10);
    q = q
      .not("status", "in", "(cancelled,lapsed,draft)")
      .gte("end_date", since.toISOString().slice(0, 10))
      .lt("end_date", today);
  }
  if (filters.q) q = q.ilike("policy_number", `%${filters.q}%`);
  if (filters.client) q = q.ilike("clients.display_name", `%${filters.client}%`);
  if (filters.line) q = q.eq("insurance_line_id", filters.line);
  if (filters.carrier) q = q.eq("carrier_id", filters.carrier);
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.risk) q = q.ilike("risk_label", `%${filters.risk}%`);
  if (filters.agentId) q = q.eq("assigned_agent_id", filters.agentId);
  if (filters.brokerOfficeId) q = q.eq("broker_office_id", filters.brokerOfficeId);
  if (filters.startFrom) q = q.gte("start_date", filters.startFrom);
  if (filters.startTo) q = q.lte("start_date", filters.startTo);
  if (filters.endFrom) q = q.gte("end_date", filters.endFrom);
  if (filters.endTo) q = q.lte("end_date", filters.endTo);
  if (filters.premiumFrom) q = q.gte("premium_gross", Number(filters.premiumFrom));
  if (filters.premiumTo) q = q.lte("premium_gross", Number(filters.premiumTo));
  if (filters.issueFrom) q = q.gte("issue_date", filters.issueFrom);
  if (filters.issueTo) q = q.lte("issue_date", filters.issueTo);
  if (filters.premiumNetFrom) q = q.gte("premium_net", Number(filters.premiumNetFrom));
  if (filters.premiumNetTo) q = q.lte("premium_net", Number(filters.premiumNetTo));
  return q;
}

export const PER_PAGE_OPTIONS = [20, 40, 100] as const;

export function parsePerPage(value: string | undefined): number {
  const n = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : 20;
}
