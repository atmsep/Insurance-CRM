import { Skeleton } from "@/components/ui/skeleton";
import { ListCardSkeleton } from "../_components/skeletons";

export default function InstallmentsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-40" />
      <ListCardSkeleton rows={6} />
    </div>
  );
}
