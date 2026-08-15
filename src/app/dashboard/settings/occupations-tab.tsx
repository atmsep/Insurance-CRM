import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function OccupationsTab({ rows }: { rows: LookupRow[] }) {
  return (
    <SimpleLookupTab
      columnLabel="Επάγγελμα"
      addLabel="Προσθήκη επαγγέλματος"
      emptyLabel="Δεν υπάρχουν επαγγέλματα."
      rows={rows}
      createAction={createLookupRow.bind(null, "occupations")}
      updateAction={updateLookupRow.bind(null, "occupations")}
      toggleAction={toggleLookupRowActive.bind(null, "occupations")}
      deleteAction={deleteLookupRow.bind(null, "occupations")}
    />
  );
}
