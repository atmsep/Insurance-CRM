import { Suspense } from "react";
import { TodayAgendaCard } from "./_components/today-agenda-card";
import { AgendaFilterProvider } from "./_components/agenda-filter-context";
import { AgendaFilterCheckboxes } from "./_components/agenda-filter-checkboxes";
import {
  ActivePoliciesTile,
  ExpiringTile,
  OpenClaimsTile,
  OpenTicketsTile,
  PendingTasksTile,
  RecentlyExpiredTile,
  TodayCallsTile,
} from "./_components/stat-tiles";
import { ExpiringPoliciesCard } from "./_components/expiring-policies-card";
import { RecentlyExpiredPoliciesCard } from "./_components/recently-expired-policies-card";
import { UpcomingTasksCard } from "./_components/upcoming-tasks-card";
import {
  AgendaCardSkeleton,
  ListCardSkeleton,
  StatTileSkeleton,
} from "./_components/skeletons";

export default function DashboardPage() {
  return (
    <AgendaFilterProvider>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Επισκόπηση</h1>
          <AgendaFilterCheckboxes />
        </div>

        <Suspense fallback={<AgendaCardSkeleton />}>
          <TodayAgendaCard />
        </Suspense>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
          <Suspense fallback={<StatTileSkeleton />}>
            <ActivePoliciesTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <PendingTasksTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <ExpiringTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <RecentlyExpiredTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <OpenClaimsTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <OpenTicketsTile />
          </Suspense>
          <Suspense fallback={<StatTileSkeleton />}>
            <TodayCallsTile />
          </Suspense>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Suspense fallback={<ListCardSkeleton title="Συμβόλαια που λήγουν σύντομα" />}>
            <ExpiringPoliciesCard />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton title="Ληγμένα χωρίς ανανέωση" />}>
            <RecentlyExpiredPoliciesCard />
          </Suspense>
          <Suspense fallback={<ListCardSkeleton title="Εκκρεμείς υπενθυμίσεις" />}>
            <UpcomingTasksCard />
          </Suspense>
        </div>
      </div>
    </AgendaFilterProvider>
  );
}
