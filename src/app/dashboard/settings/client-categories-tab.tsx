import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function ClientCategoriesTab({ rows, onChanged }: { rows: LookupRow[]; onChanged?: () => void }) {
  return (
    <SimpleLookupTab
      columnLabel="Κατηγορία"
      addLabel="Προσθήκη κατηγορίας"
      emptyLabel="Δεν υπάρχουν κατηγορίες πελατών."
      rows={rows}
      createAction={createLookupRow.bind(null, "client_categories")}
      updateAction={updateLookupRow.bind(null, "client_categories")}
      toggleAction={toggleLookupRowActive.bind(null, "client_categories")}
      deleteAction={deleteLookupRow.bind(null, "client_categories")}
      onChanged={onChanged}
    />
  );
}
