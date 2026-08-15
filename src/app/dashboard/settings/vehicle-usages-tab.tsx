import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function VehicleUsagesTab({ rows, onChanged }: { rows: LookupRow[]; onChanged?: () => void }) {
  return (
    <SimpleLookupTab
      columnLabel="Χρήση οχήματος"
      addLabel="Προσθήκη χρήσης"
      emptyLabel="Δεν υπάρχουν χρήσεις οχήματος."
      rows={rows}
      createAction={createLookupRow.bind(null, "vehicle_usages")}
      updateAction={updateLookupRow.bind(null, "vehicle_usages")}
      toggleAction={toggleLookupRowActive.bind(null, "vehicle_usages")}
      deleteAction={deleteLookupRow.bind(null, "vehicle_usages")}
      onChanged={onChanged}
    />
  );
}
