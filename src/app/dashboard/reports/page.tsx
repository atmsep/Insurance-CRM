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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Link href="/dashboard/reports/production" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
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

        <Link href="/dashboard/reports/production-summary" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Παραγωγή Συγκεντρωτικά</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ομαδοποιημένη παραγωγή (ανά συνεργάτη, κλάδο ή εταιρεία) με σύνολα Μικτών, Καθαρών, εξερχόμενης
                προμήθειας και διαφοράς.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/reports/commission-statement" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Εκκαθάριση Προμηθειών</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Εκτυπώσιμη κατάσταση προμηθειών ανά συνεργάτη και περίοδο, με κατάσταση απόδοσης, σύνολα και
                υπογραφές.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/reports/receivables" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Καθυστερούμενες Οφειλές</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Ανοιχτές οφειλές ανά πελάτη με ηλικία καθυστέρησης (1–30, 31–60, 61–90, 90+ ημέρες) και σύνολα —
                η λίστα για τηλέφωνα οφειλών.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

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
