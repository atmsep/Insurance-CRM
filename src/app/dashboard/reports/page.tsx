import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireAgencyUser } from "@/lib/dal";
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

      <Suspense fallback={<StatTileGridSkeleton count={5} />}>
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
