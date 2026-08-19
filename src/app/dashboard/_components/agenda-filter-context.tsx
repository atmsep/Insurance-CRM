"use client";

import { createContext, useContext, useState } from "react";

export type AgendaFilterState = {
  showNameDay: boolean;
  showBirthday: boolean;
  showReminders: boolean;
};

type AgendaFilterContextValue = AgendaFilterState & {
  setShowNameDay: (value: boolean) => void;
  setShowBirthday: (value: boolean) => void;
  setShowReminders: (value: boolean) => void;
};

const AgendaFilterContext = createContext<AgendaFilterContextValue | null>(null);

// Purely a client-side "declutter today's view" toggle — resets on reload
// by design, no need to persist it anywhere. Lives in context (rather than
// being passed as a prop) so the checkboxes next to the page title and the
// agenda list inside its own Suspense-loaded card can share state despite
// sitting in different branches of the tree.
export function AgendaFilterProvider({ children }: { children: React.ReactNode }) {
  const [showNameDay, setShowNameDay] = useState(true);
  const [showBirthday, setShowBirthday] = useState(true);
  const [showReminders, setShowReminders] = useState(true);

  return (
    <AgendaFilterContext.Provider
      value={{ showNameDay, setShowNameDay, showBirthday, setShowBirthday, showReminders, setShowReminders }}
    >
      {children}
    </AgendaFilterContext.Provider>
  );
}

export function useAgendaFilter() {
  const ctx = useContext(AgendaFilterContext);
  if (!ctx) throw new Error("useAgendaFilter must be used within an AgendaFilterProvider");
  return ctx;
}
