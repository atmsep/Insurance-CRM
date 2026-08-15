import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function ClaimCategoriesTab({ rows }: { rows: LookupRow[] }) {
  return (
    <SimpleLookupTab
      columnLabel="Κατηγορία ζημιάς"
      addLabel="Προσθήκη κατηγορίας"
      emptyLabel="Δεν υπάρχουν κατηγορίες ζημιών."
      rows={rows}
      createAction={createLookupRow.bind(null, "claim_categories")}
      updateAction={updateLookupRow.bind(null, "claim_categories")}
      toggleAction={toggleLookupRowActive.bind(null, "claim_categories")}
      deleteAction={deleteLookupRow.bind(null, "claim_categories")}
    />
  );
}
