import { Skeleton } from "@/components/ui/skeleton";
import { StatTileGridSkeleton, TableCardSkeleton } from "../_components/skeletons";

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <StatTileGridSkeleton count={6} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <TableCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
