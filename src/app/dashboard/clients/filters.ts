export type ClientFilters = {
  code?: string;
  name?: string;
  afm?: string;
  phone?: string;
  city?: string;
  email?: string;
  region?: string;
  postalCode?: string;
  agentId?: string;
  clientType?: string;
  dobFrom?: string;
  dobTo?: string;
  showInactive: boolean;
};

type SearchParamsInput = Record<string, string | undefined>;

export function parseClientFilters(sp: SearchParamsInput): ClientFilters {
  return {
    code: sp.code || undefined,
    name: sp.name || undefined,
    afm: sp.afm || undefined,
    phone: sp.phone || undefined,
    city: sp.city || undefined,
    email: sp.email || undefined,
    region: sp.region || undefined,
    postalCode: sp.postal_code || undefined,
    agentId: sp.agent || undefined,
    clientType: sp.client_type || undefined,
    dobFrom: sp.dob_from || undefined,
    dobTo: sp.dob_to || undefined,
    showInactive: sp.show_inactive === "1",
  };
}

// date_of_birth lives on client_individuals, not clients — filtering on it
// requires the caller to join with `client_individuals!inner(...)` instead
// of the default left join, otherwise legal-entity clients (which correctly
// have no client_individuals row) would silently vanish from every result.
export function needsIndividualJoin(filters: ClientFilters): boolean {
  return Boolean(filters.dobFrom || filters.dobTo);
}

type FilterableQuery<T> = {
  eq(column: string, value: unknown): T;
  ilike(column: string, pattern: string): T;
  gte(column: string, value: unknown): T;
  lte(column: string, value: unknown): T;
};

export function applyClientFilters<T extends FilterableQuery<T>>(query: T, filters: ClientFilters): T {
  let q = query;
  if (!filters.showInactive) q = q.eq("is_active", true);
  if (filters.code) {
    const code = Number(filters.code.replace(/^#/, "").trim());
    if (!Number.isNaN(code)) q = q.eq("client_code", code);
  }
  if (filters.name) q = q.ilike("display_name", `%${filters.name}%`);
  if (filters.afm) q = q.ilike("afm", `%${filters.afm}%`);
  if (filters.phone) q = q.ilike("phone_mobile", `%${filters.phone}%`);
  if (filters.city) q = q.ilike("address_city", `%${filters.city}%`);
  if (filters.email) q = q.ilike("email", `%${filters.email}%`);
  if (filters.region) q = q.ilike("address_region", `%${filters.region}%`);
  if (filters.postalCode) q = q.ilike("address_postal_code", `%${filters.postalCode}%`);
  if (filters.agentId) q = q.eq("assigned_agent_id", filters.agentId);
  if (filters.clientType) q = q.eq("client_type", filters.clientType);
  if (filters.dobFrom) q = q.gte("client_individuals.date_of_birth", filters.dobFrom);
  if (filters.dobTo) q = q.lte("client_individuals.date_of_birth", filters.dobTo);
  return q;
}

export const PER_PAGE_OPTIONS = [20, 40, 100] as const;

export function parsePerPage(value: string | undefined): number {
  const n = Number(value);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(n) ? n : 20;
}
