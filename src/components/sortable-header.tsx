"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowDownWideNarrowIcon, ArrowUpNarrowWideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Cycles a header's sort state through none -> asc -> desc -> none by
// writing `sort`/`dir` into the URL, alongside whatever filter params
// already live there (Advanced-search sheet, inline header filters,
// pagination). Resets `page` back to 1 since the row order changed under
// the current page. Server pages read `sort`/`dir` back out of
// searchParams and translate them into `.order()`.
export function SortableHeader({ sortKey, label }: { sortKey: string; label: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active = searchParams.get("sort") === sortKey;
  const dir = active ? searchParams.get("dir") : null;
  const nextDir = dir === "asc" ? "desc" : dir === "desc" ? null : "asc";

  function handleClick() {
    const params = new URLSearchParams(searchParams.toString());
    if (nextDir === null) {
      params.delete("sort");
      params.delete("dir");
    } else {
      params.set("sort", sortKey);
      params.set("dir", nextDir);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left font-medium text-foreground outline-none hover:text-primary focus-visible:text-primary",
        active && "text-primary",
      )}
    >
      <span>{label}</span>
      {dir === "asc" ? (
        <ArrowUpNarrowWideIcon className="size-3.5 shrink-0" />
      ) : dir === "desc" ? (
        <ArrowDownWideNarrowIcon className="size-3.5 shrink-0" />
      ) : null}
    </button>
  );
}
