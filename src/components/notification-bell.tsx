"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/date";
import {
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from "@/app/dashboard/notifications/actions";

// Polls every 60s (same lightweight approach as the incoming-call
// listener) — an agency has a handful of users, so this is far cheaper
// than holding a realtime channel open per tab.
const POLL_MS = 60_000;

export function NotificationBell() {
  const router = useRouter();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await getMyNotifications();
        if (cancelled) return;
        setRows(result.rows);
        setUnread(result.unread);
      } catch {
        // A failed poll is not worth surfacing — the next tick retries.
      }
    }
    void load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void getMyNotifications().then((r) => { setRows(r.rows); setUnread(r.unread); });
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="relative" aria-label="Ειδοποιήσεις">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-medium">Ειδοποιήσεις</span>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() =>
                startTransition(async () => {
                  await markAllNotificationsRead();
                  setUnread(0);
                  setRows((prev) => prev.map((r) => ({ ...r, read_at: r.read_at ?? new Date().toISOString() })));
                })
              }
            >
              Όλα ως διαβασμένα
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {rows.length ? (
            rows.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left last:border-0 hover:bg-muted/50 ${
                  n.read_at ? "opacity-60" : ""
                }`}
                onClick={() => {
                  startTransition(async () => {
                    if (!n.read_at) {
                      await markNotificationRead(n.id);
                      setUnread((u) => Math.max(0, u - 1));
                      setRows((prev) =>
                        prev.map((r) => (r.id === n.id ? { ...r, read_at: new Date().toISOString() } : r)),
                      );
                    }
                    if (n.link) {
                      setOpen(false);
                      router.push(n.link);
                    }
                  });
                }}
              >
                <span className="text-sm font-medium">{n.title}</span>
                {n.body && <span className="text-xs text-muted-foreground">{n.body}</span>}
                <span className="text-[11px] text-muted-foreground">{formatDateTime(n.created_at)}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Καμία ειδοποίηση.</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
