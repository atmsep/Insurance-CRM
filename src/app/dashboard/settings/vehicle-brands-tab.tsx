import { SimpleLookupTab, type LookupRow } from "./simple-lookup-tab";
import { createLookupRow, updateLookupRow, toggleLookupRowActive, deleteLookupRow } from "./lookup-actions";

export function VehicleBrandsTab({ rows, onChanged }: { rows: LookupRow[]; onChanged?: () => void }) {
  return (
    <SimpleLookupTab
      columnLabel="Μάρκα"
      addLabel="Προσθήκη μάρκας"
      emptyLabel="Δεν υπάρχουν μάρκες οχημάτων."
      rows={rows}
      createAction={createLookupRow.bind(null, "vehicle_brands")}
      updateAction={updateLookupRow.bind(null, "vehicle_brands")}
      toggleAction={toggleLookupRowActive.bind(null, "vehicle_brands")}
      deleteAction={deleteLookupRow.bind(null, "vehicle_brands")}
      onChanged={onChanged}
    />
  );
}
