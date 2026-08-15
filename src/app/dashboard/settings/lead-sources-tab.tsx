import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function LeadSourcesTab({ rows, onChanged }: { rows: LookupRow[]; onChanged?: () => void }) {
  return (
    <SimpleLookupTab
      columnLabel="Πηγή"
      addLabel="Προσθήκη πηγής"
      emptyLabel="Δεν υπάρχουν πηγές προέλευσης."
      rows={rows}
      createAction={createLookupRow.bind(null, "lead_sources")}
      updateAction={updateLookupRow.bind(null, "lead_sources")}
      toggleAction={toggleLookupRowActive.bind(null, "lead_sources")}
      deleteAction={deleteLookupRow.bind(null, "lead_sources")}
      onChanged={onChanged}
    />
  );
}
