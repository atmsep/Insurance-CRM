"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLookupRows,
  getAreas,
  getInsuranceLinesFull,
  type SimpleLookupTable,
} from "./lookup-actions";
import type { LookupRow } from "./simple-lookup-tab";
import type { Area } from "./areas-tab";
import type { InsuranceLine } from "./insurance-lines-tab";
import { BanksTab } from "./banks-tab";
import { ClientCategoriesTab } from "./client-categories-tab";
import { LeadSourcesTab } from "./lead-sources-tab";
import { SpecialtiesTab } from "./specialties-tab";
import { VehicleBrandsTab } from "./vehicle-brands-tab";
import { VehicleUsagesTab } from "./vehicle-usages-tab";
import { CurrenciesTab } from "./currencies-tab";
import { CollectionCentersTab } from "./collection-centers-tab";
import { OccupationsTab } from "./occupations-tab";
import { ClaimCategoriesTab } from "./claim-categories-tab";
import { AreasTab } from "./areas-tab";
import { InsuranceLinesTab } from "./insurance-lines-tab";

const SIMPLE_TABS: { value: string; label: string; table: SimpleLookupTable }[] = [
  { value: "banks", label: "Τράπεζες", table: "banks" },
  { value: "client-categories", label: "Κατηγορίες Πελατών", table: "client_categories" },
  { value: "lead-sources", label: "Πηγές Προέλευσης", table: "lead_sources" },
  { value: "specialties", label: "Ειδικότητες", table: "specialties" },
  { value: "vehicle-brands", label: "Μάρκες Οχημάτων", table: "vehicle_brands" },
  { value: "vehicle-usages", label: "Χρήσεις Οχήματος", table: "vehicle_usages" },
  { value: "currencies", label: "Νομίσματα", table: "currencies" },
  { value: "collection-centers", label: "Κέντρα Είσπραξης", table: "collection_centers" },
  { value: "occupations", label: "Επαγγέλματα", table: "occupations" },
  { value: "claim-categories", label: "Κατηγορίες Ζημιών", table: "claim_categories" },
];

type Loaded =
  | { kind: "simple"; rows: LookupRow[] }
  | { kind: "areas"; rows: Area[] }
  | { kind: "insurance-lines"; rows: InsuranceLine[] };

// Each sub-tab used to be fetched eagerly by the settings page's own
// Promise.all — harmless for the small tables, but occupations (630 rows)
// and areas (1429 rows) made the whole Ρυθμίσεις page slow to load even
// when nobody opened this tab. Fetching lazily per sub-tab, only on first
// activation, keeps the rest of Settings fast.
export function ParametricTablesTab() {
  const [active, setActive] = useState("banks");
  const [dataByTab, setDataByTab] = useState<Record<string, Loaded>>({});

  async function load(value: string) {
    let entry: Loaded | null = null;
    if (value === "areas") {
      entry = { kind: "areas", rows: await getAreas() };
    } else if (value === "insurance-lines") {
      entry = { kind: "insurance-lines", rows: await getInsuranceLinesFull() };
    } else {
      const tab = SIMPLE_TABS.find((t) => t.value === value);
      if (tab) entry = { kind: "simple", rows: await getLookupRows(tab.table) };
    }
    if (entry) {
      const resolved = entry;
      setDataByTab((d) => ({ ...d, [value]: resolved }));
    }
  }

  useEffect(() => {
    let cancelled = false;
    getLookupRows("banks").then((rows) => {
      if (!cancelled) setDataByTab((d) => ({ ...d, banks: { kind: "simple", rows } }));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function handleValueChange(value: string) {
    setActive(value);
    if (!dataByTab[value]) load(value);
  }

  function refetch(value: string) {
    load(value);
  }

  function renderContent(value: string) {
    const loaded = dataByTab[value];
    if (!loaded) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      );
    }

    if (value === "areas" && loaded.kind === "areas") {
      return <AreasTab areas={loaded.rows} onChanged={() => refetch("areas")} />;
    }
    if (value === "insurance-lines" && loaded.kind === "insurance-lines") {
      return <InsuranceLinesTab lines={loaded.rows} onChanged={() => refetch("insurance-lines")} />;
    }
    if (loaded.kind !== "simple") return null;

    switch (value) {
      case "banks":
        return <BanksTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "client-categories":
        return <ClientCategoriesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "lead-sources":
        return <LeadSourcesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "specialties":
        return <SpecialtiesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "vehicle-brands":
        return <VehicleBrandsTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "vehicle-usages":
        return <VehicleUsagesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "currencies":
        return <CurrenciesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "collection-centers":
        return <CollectionCentersTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "occupations":
        return <OccupationsTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      case "claim-categories":
        return <ClaimCategoriesTab rows={loaded.rows} onChanged={() => refetch(value)} />;
      default:
        return null;
    }
  }

  return (
    <Tabs value={active} onValueChange={(v) => v && handleValueChange(v)}>
      <TabsList className="flex-wrap">
        {SIMPLE_TABS.map((t) => (
          <TabsTrigger key={t.value} value={t.value}>
            {t.label}
          </TabsTrigger>
        ))}
        <TabsTrigger value="areas">Περιοχές</TabsTrigger>
        <TabsTrigger value="insurance-lines">Κλάδοι Ασφάλισης</TabsTrigger>
      </TabsList>
      {[...SIMPLE_TABS.map((t) => t.value), "areas", "insurance-lines"].map((value) => (
        <TabsContent key={value} value={value} className="pt-4">
          {active === value ? renderContent(value) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
