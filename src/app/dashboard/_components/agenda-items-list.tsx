"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { CelebrationWishDialog } from "../tasks/celebration-wish-dialog";
import { useAgendaFilter } from "./agenda-filter-context";
import type { AgendaItem } from "./today-agenda-card";

export function AgendaItemsList({ items }: { items: AgendaItem[] }) {
  const { showNameDay, showBirthday, showReminders } = useAgendaFilter();

  const visibleItems = items.filter((item) => {
    if (item.kind === "task") return showReminders;
    return item.celebrationType === "name_day" ? showNameDay : showBirthday;
  });

  if (!visibleItems.length) {
    return <p className="text-sm text-muted-foreground">Δεν έχεις τίποτα προγραμματισμένο για σήμερα.</p>;
  }

  return (
    <>
      {visibleItems.map((item) =>
        item.kind === "celebration" ? (
          <CelebrationWishDialog
            key={item.key}
            taskId={item.taskId}
            clientEmail={item.clientEmail}
            initialSubject={item.subject}
            initialBody={item.body}
          >
            <div className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted">
              <span>
                {item.icon} {item.label}
              </span>
              <Badge variant="secondary">{item.celebrationLabel}</Badge>
            </div>
          </CelebrationWishDialog>
        ) : (
          <Link
            key={item.key}
            href={item.href}
            className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted"
          >
            <span>{item.label}</span>
            <Badge>Υπενθύμιση</Badge>
          </Link>
        ),
      )}
    </>
  );
}
