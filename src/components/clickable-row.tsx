"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Clicks that land on a checkbox, link, button, or form control inside the
// row must not also trigger the row's own click behavior (bulk-select,
// QuickView trigger, the row's own detail link, etc.) — everything else in
// the row responds to single/double click. Select dropdowns (status/
// assignee, etc.) render their option list in a portal outside the row's
// DOM subtree, but React still bubbles the click there up to this handler —
// role='option'/'listbox' catches those clicks too (closest() walks the
// clicked element's own ancestors, so it matches regardless of where in the
// DOM the portal landed).
const INTERACTIVE_SELECTOR =
  "a, button, input, select, textarea, [role='checkbox'], [role='combobox'], [role='option'], [role='listbox']";

// One click just highlights the row (a lightweight, purely visual "marked"
// state — no navigation, no side effect) — two clicks in quick succession
// navigate to the full record, which is what a single click used to do.
// The browser fires a plain "click" event twice on the way to a
// "dblclick", so a naive onClick would always mark-then-immediately-
// navigate on a double click too — the timeout below defers the mark just
// long enough to let a following dblclick cancel it instead.
const DOUBLE_CLICK_WINDOW_MS = 220;

export function ClickableRow({
  href,
  className,
  ...props
}: { href: string } & ComponentProps<typeof TableRow>) {
  const router = useRouter();
  const [marked, setMarked] = useState(false);
  const pendingClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  function isInteractiveTarget(event: MouseEvent<HTMLTableRowElement>) {
    return (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR) != null;
  }

  function handleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (isInteractiveTarget(event)) return;
    if (pendingClick.current) return;
    pendingClick.current = setTimeout(() => {
      pendingClick.current = null;
      setMarked((m) => !m);
    }, DOUBLE_CLICK_WINDOW_MS);
  }

  function handleDoubleClick(event: MouseEvent<HTMLTableRowElement>) {
    if (isInteractiveTarget(event)) return;
    if (pendingClick.current) {
      clearTimeout(pendingClick.current);
      pendingClick.current = null;
    }
    router.push(href);
  }

  return (
    <TableRow
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      data-state={marked ? "selected" : undefined}
      className={cn("cursor-pointer hover:bg-muted/50", className)}
      {...props}
    />
  );
}
