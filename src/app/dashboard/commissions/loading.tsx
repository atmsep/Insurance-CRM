import { Skeleton } from "@/components/ui/skeleton";
import { TableCardSkeleton } from "../_components/skeletons";

export default function CommissionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-8 w-28" />
      </div>
      <Skeleton className="h-8 w-64" />
      <TableCardSkeleton columns={8} />
    </div>
  );
}
