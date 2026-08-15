import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function SpecialtiesTab({ rows }: { rows: LookupRow[] }) {
  return (
    <SimpleLookupTab
      columnLabel="Ειδικότητα"
      addLabel="Προσθήκη ειδικότητας"
      emptyLabel="Δεν υπάρχουν ειδικότητες."
      rows={rows}
      createAction={createLookupRow.bind(null, "specialties")}
      updateAction={updateLookupRow.bind(null, "specialties")}
      toggleAction={toggleLookupRowActive.bind(null, "specialties")}
      deleteAction={deleteLookupRow.bind(null, "specialties")}
    />
  );
}
