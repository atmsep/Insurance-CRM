export { parseProductionFilters, type ProductionFilters } from "../production/filters";

export type GroupBy = "agent_line" | "line_carrier" | "line_agent" | "carrier_agent";

export const GROUP_BY_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: "agent_line", label: "Ανά Κλάδο/Συνεργάτη" },
  { id: "line_carrier", label: "Ανά Εταιρεία/Κλάδο" },
  { id: "line_agent", label: "Ανά Συνεργάτη/Κλάδο" },
  { id: "carrier_agent", label: "Ανά Συνεργάτη/Εταιρεία" },
];

// Column labels for the two group-key columns, per grouping — outer
// first, then inner, matching production_entries_grouped's own
// outer_key/inner_key semantics (migration 0092).
export const GROUP_BY_LABELS: Record<GroupBy, { outer: string; inner: string }> = {
  agent_line: { outer: "Συνεργάτης", inner: "Κλάδος" },
  line_carrier: { outer: "Κλάδος", inner: "Εταιρεία" },
  line_agent: { outer: "Κλάδος", inner: "Συνεργάτης" },
  carrier_agent: { outer: "Εταιρεία", inner: "Συνεργάτης" },
};

const DEFAULT_GROUP_BY: GroupBy = "agent_line";

export function parseGroupBy(value: string | undefined): GroupBy {
  return (GROUP_BY_OPTIONS.some((o) => o.id === value) ? value : DEFAULT_GROUP_BY) as GroupBy;
}
