import { Skeleton } from "@/components/ui/skeleton";
import { AgendaCardSkeleton, ListCardSkeleton, StatTileGridSkeleton } from "./_components/skeletons";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <AgendaCardSkeleton />
      <StatTileGridSkeleton />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ListCardSkeleton title="Συμβόλαια που λήγουν σύντομα" />
        <ListCardSkeleton title="Εκκρεμείς υπενθυμίσεις" />
      </div>
    </div>
  );
}
