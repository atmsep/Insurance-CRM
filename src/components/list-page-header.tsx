import Link from "next/link";
import type { ReactNode } from "react";

export function ListPageHeader({
  title,
  filterBanner,
  actions,
}: {
  title: string;
  filterBanner?: { label: string; clearHref: string };
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {filterBanner && (
          <p className="text-sm text-muted-foreground">
            {filterBanner.label} ·{" "}
            <Link href={filterBanner.clearHref} className="hover:underline">
              Καθαρισμός φίλτρου
            </Link>
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
