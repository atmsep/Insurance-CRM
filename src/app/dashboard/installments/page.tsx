import { Suspense } from "react";
import { InstallmentsWorklist } from "./_components/installments-worklist";
import { ListCardSkeleton } from "../_components/skeletons";

export default function InstallmentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Ανείσπρακτα</h1>

      <Suspense fallback={<ListCardSkeleton rows={6} />}>
        <InstallmentsWorklist />
      </Suspense>
    </div>
  );
}
