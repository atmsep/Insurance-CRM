export type ClientNameFields = {
  client_type?: string;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
};

// When client_type isn't part of the query, individual is assumed whenever
// client_individuals is present — matching every call site's prior behavior
// before this helper existed.
export function resolveClientName(client: ClientNameFields | null | undefined): string {
  if (!client) return "—";
  const isIndividual = client.client_type ? client.client_type === "individual" : true;
  if (isIndividual && client.client_individuals) {
    return `${client.client_individuals.last_name} ${client.client_individuals.first_name}`;
  }
  return client.client_legal_entities?.company_name ?? "—";
}
