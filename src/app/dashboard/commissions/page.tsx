import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { COMMISSION_STATUS_LABELS } from "./commission-labels";
import { CommissionsTable } from "./_components/commissions-table";
import { TableCardSkeleton } from "../_components/skeletons";

const DIRECTION_TABS: { value: string | undefined; label: string }[] = [
  { value: undefined, label: "Όλες" },
  { value: "incoming", label: "Εισερχόμενες" },
  { value: "outgoing", label: "Εξερχόμενες" },
];

export default async function CommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; direction?: string }>;
}) {
  const { status, direction } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Προμήθειες</h1>

      <div className="flex flex-wrap gap-2">
        {DIRECTION_TABS.map((tab) => {
          const isActive = (direction ?? undefined) === tab.value;
          const href = tab.value
            ? `/dashboard/commissions?direction=${tab.value}`
            : "/dashboard/commissions";
          return (
            <Button
              key={tab.label}
              size="sm"
              variant={isActive ? "default" : "outline"}
              nativeButton={false}
              render={<Link href={href}>{tab.label}</Link>}
            />
          );
        })}
      </div>

      <form className="flex flex-wrap items-end gap-3">
        {direction && <input type="hidden" name="direction" value={direction} />}
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
        >
          <option value="">Όλες οι καταστάσεις</option>
          {Object.entries(COMMISSION_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          Φίλτρο
        </Button>
      </form>

      <Suspense key={`${status ?? ""}-${direction ?? ""}`} fallback={<TableCardSkeleton columns={8} />}>
        <CommissionsTable status={status} direction={direction} />
      </Suspense>
    </div>
  );
}
