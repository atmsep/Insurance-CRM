import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function CollectionCentersTab({ rows, onChanged }: { rows: LookupRow[]; onChanged?: () => void }) {
  return (
    <SimpleLookupTab
      columnLabel="Κέντρο είσπραξης"
      addLabel="Προσθήκη κέντρου"
      emptyLabel="Δεν υπάρχουν κέντρα είσπραξης."
      rows={rows}
      createAction={createLookupRow.bind(null, "collection_centers")}
      updateAction={updateLookupRow.bind(null, "collection_centers")}
      toggleAction={toggleLookupRowActive.bind(null, "collection_centers")}
      deleteAction={deleteLookupRow.bind(null, "collection_centers")}
      onChanged={onChanged}
    />
  );
}
