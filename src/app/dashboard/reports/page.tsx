import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTileGridSkeleton, TableCardSkeleton } from "../_components/skeletons";
import {
  ClaimsByStatusTable,
  PoliciesByLineTable,
  PoliciesByStatusTable,
  ReferralBreakdownTable,
  ReportsStatsRow,
} from "./_components/cards";

export default async function ReportsPage() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Αναφορές</h1>

      <Link href="/dashboard/reports/production" className="block">
        <Card className="transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">Παραγωγή Αναλυτικά</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Αναλυτική λίστα κινήσεων (νέα συμβόλαια, ανανεώσεις, πρόσθετες πράξεις, ακυρώσεις) με φίλτρα ανά
              συνεργάτη, εταιρεία, κλάδο και ημερομηνίες.
            </p>
          </CardContent>
        </Card>
      </Link>

      <Suspense fallback={<StatTileGridSkeleton count={1} />}>
        <ReportsStatsRow />
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Suspense fallback={<TableCardSkeleton title="Συμβόλαια ανά κατάσταση" />}>
          <PoliciesByStatusTable />
        </Suspense>
        <Suspense fallback={<TableCardSkeleton title="Ασφάλιστρο ανά κλάδο" />}>
          <PoliciesByLineTable />
        </Suspense>
        <Suspense fallback={<TableCardSkeleton title="Ζημιές ανά κατάσταση" />}>
          <ClaimsByStatusTable />
        </Suspense>
        <Suspense fallback={<TableCardSkeleton title="Πελάτες ανά πηγή σύστασης" />}>
          <ReferralBreakdownTable />
        </Suspense>
      </div>
    </div>
  );
}
