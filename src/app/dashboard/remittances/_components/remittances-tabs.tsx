"use client";

import { useState, type ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Applying the filters form is a full GET navigation (searchParams change),
// which would otherwise reset an uncontrolled Tabs back to its
// defaultValue every time — losing "Προμήθειες" if that's the tab you were
// on when you hit Εφαρμογή φίλτρων. Controlled instead, with the current
// tab mirrored into a hidden input inside the same filters form so it
// round-trips through the navigation as ?tab=... and the server can hand
// it straight back as defaultTab on the next render.
export function RemittancesTabs({
  defaultTab,
  premiumCount,
  commissionCount,
  premiumContent,
  commissionContent,
}: {
  defaultTab: string;
  premiumCount: number;
  commissionCount: number;
  premiumContent: ReactNode;
  commissionContent: ReactNode;
}) {
  const [tab, setTab] = useState(defaultTab);

  return (
    <Tabs value={tab} onValueChange={(value) => setTab(typeof value === "string" ? value : "premium")}>
      <input type="hidden" name="tab" value={tab} form="remittances-filters" />
      <TabsList>
        <TabsTrigger value="premium">Ασφάλιστρα ({premiumCount})</TabsTrigger>
        <TabsTrigger value="commission">Προμήθειες ({commissionCount})</TabsTrigger>
      </TabsList>

      <TabsContent value="premium" className="pt-4">
        {premiumContent}
      </TabsContent>

      <TabsContent value="commission" className="pt-4">
        {commissionContent}
      </TabsContent>
    </Tabs>
  );
}
