import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function CurrenciesTab({ rows }: { rows: LookupRow[] }) {
  return (
    <SimpleLookupTab
      columnLabel="Νόμισμα"
      addLabel="Προσθήκη νομίσματος"
      emptyLabel="Δεν υπάρχουν νομίσματα."
      rows={rows}
      createAction={createLookupRow.bind(null, "currencies")}
      updateAction={updateLookupRow.bind(null, "currencies")}
      toggleAction={toggleLookupRowActive.bind(null, "currencies")}
      deleteAction={deleteLookupRow.bind(null, "currencies")}
    />
  );
}
