"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useAgendaFilter } from "./agenda-filter-context";

function FilterCheckbox({
  id,
  label,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-1.5 text-sm">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onCheckedChange(v === true)} />
      {label}
    </label>
  );
}

export function AgendaFilterCheckboxes() {
  const { showNameDay, setShowNameDay, showBirthday, setShowBirthday, showReminders, setShowReminders } =
    useAgendaFilter();

  return (
    <div className="flex flex-wrap items-center gap-4">
      <FilterCheckbox id="filter-name-day" label="Γιορτή" checked={showNameDay} onCheckedChange={setShowNameDay} />
      <FilterCheckbox id="filter-birthday" label="Γενέθλια" checked={showBirthday} onCheckedChange={setShowBirthday} />
      <FilterCheckbox
        id="filter-reminders"
        label="Υπενθυμίσεις"
        checked={showReminders}
        onCheckedChange={setShowReminders}
      />
    </div>
  );
}
