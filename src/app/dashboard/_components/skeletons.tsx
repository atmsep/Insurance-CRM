import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// Shared loading placeholders for Suspense fallbacks / route loading.tsx
// files across the dashboard. Kept structurally close to the real
// Card/CardHeader/CardContent shapes they stand in for, so nothing jumps
// when the real content swaps in.

export function StatTileSkeleton() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-2 h-8 w-14" />
      </CardContent>
    </Card>
  );
}

export function StatTileGridSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <StatTileSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListCardSkeleton({ title, rows = 4 }: { title?: string; rows?: number }) {
  return (
    <Card>
      <CardHeader>
        {title ? <CardTitle className="text-base">{title}</CardTitle> : <Skeleton className="h-5 w-40" />}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AgendaCardSkeleton() {
  return <ListCardSkeleton title="Σήμερα" rows={3} />;
}

export function TableCardSkeleton({
  title,
  columns = 3,
  rows = 5,
}: {
  title?: string;
  columns?: number;
  rows?: number;
}) {
  return (
    <Card>
      <CardHeader>
        {title ? <CardTitle className="text-base">{title}</CardTitle> : <Skeleton className="h-5 w-40" />}
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex gap-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-20" />
            ))}
          </div>
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex gap-4">
              {Array.from({ length: columns }).map((_, c) => (
                <Skeleton key={c} className="h-4 w-20" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <TableCardSkeleton />
    </div>
  );
}
