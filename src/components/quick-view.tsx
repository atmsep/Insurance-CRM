"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";

export function QuickViewField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

// A row-level "peek" without leaving the list — the sheet reuses whatever
// fields the list already fetched for that row, so it needs no extra query.
export function QuickView({
  title,
  fullHref,
  children,
}: {
  title: string;
  fullHref: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Γρήγορη προβολή"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Eye className="size-4" />
      </Button>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">{children}</div>
        <SheetFooter>
          <Button nativeButton={false} render={<Link href={fullHref}>Άνοιγμα πλήρους καρτέλας</Link>} />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
