import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function BanksTab({ rows }: { rows: LookupRow[] }) {
  return (
    <SimpleLookupTab
      columnLabel="Τράπεζα"
      addLabel="Προσθήκη τράπεζας"
      emptyLabel="Δεν υπάρχουν τράπεζες."
      rows={rows}
      createAction={createLookupRow.bind(null, "banks")}
      updateAction={updateLookupRow.bind(null, "banks")}
      toggleAction={toggleLookupRowActive.bind(null, "banks")}
      deleteAction={deleteLookupRow.bind(null, "banks")}
    />
  );
}
