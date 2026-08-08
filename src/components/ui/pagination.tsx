import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  totalPages,
  basePath,
  searchParams,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  searchParams: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "page") params.set(key, value);
    }
    if (targetPage > 1) params.set("page", String(targetPage));
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }

  const pages: number[] = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, page + 2);
  for (let p = windowStart; p <= windowEnd; p++) pages.push(p);

  return (
    <div className="flex items-center gap-1.5">
      <PageLink href={hrefFor(page - 1)} disabled={page <= 1}>
        ← Προηγούμενο
      </PageLink>
      {windowStart > 1 && <span className="px-1 text-sm text-muted-foreground">…</span>}
      {pages.map((p) => (
        <PageLink key={p} href={hrefFor(p)} active={p === page}>
          {p}
        </PageLink>
      ))}
      {windowEnd < totalPages && <span className="px-1 text-sm text-muted-foreground">…</span>}
      <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages}>
        Επόμενο →
      </PageLink>
    </div>
  );
}

function PageLink({
  href,
  active,
  disabled,
  children,
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md px-2.5 py-1 text-sm text-muted-foreground/50">{children}</span>
    );
  }
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1 text-sm hover:bg-muted",
        active ? "bg-primary text-primary-foreground hover:bg-primary" : "text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
