"use client";

import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Clicks that land on a checkbox, link, button, or form control inside the
// row must not also trigger row navigation (bulk-select, QuickView trigger,
// the row's own detail link, etc.) — everything else in the row navigates.
// Select dropdowns (status/assignee, etc.) render their option list in a
// portal outside the row's DOM subtree, but React still bubbles the click
// there up to this handler — role='option'/'listbox' catches those clicks
// too (closest() walks the clicked element's own ancestors, so it matches
// regardless of where in the DOM the portal landed).
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, [role='checkbox'], [role='combobox'], [role='option'], [role='listbox']";

export function ClickableRow({
  href,
  className,
  ...props
}: { href: string } & ComponentProps<typeof TableRow>) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return;
    router.push(href);
  }

  return (
    <TableRow onClick={handleClick} className={cn("cursor-pointer hover:bg-muted/50", className)} {...props} />
  );
}
