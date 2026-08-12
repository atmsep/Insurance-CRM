"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type IncomingCall = {
  id: string;
  phone_number: string;
  client_id: string | null;
  client_name: string | null;
  created_at: string;
};

// A pure postgres_changes subscription can silently go stale — laptop
// sleep, a flaky office network, a backgrounded tab the browser throttles
// — and Supabase Realtime never replays events a disconnected socket
// missed. This adds two layers under the live push so a missed call still
// surfaces instead of only ever showing up later in the Κλήσεις history:
//   1. Reconnect the channel on any CHANNEL_ERROR/TIMED_OUT/CLOSED status.
//   2. A "catch up" query — on tab focus/visibility and every 30s as a
//      backstop — for any call inserted since the last one we actually
//      processed, in case the socket died without reporting an error.
const CATCH_UP_INTERVAL_MS = 30_000;

export function IncomingCallListener({ enabled }: { enabled: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const supabase = createClient();
    const shownCallIds = new Set<string>();
    let lastSeenAt = new Date().toISOString();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function showCallToast(call: IncomingCall) {
      if (shownCallIds.has(call.id)) return;
      shownCallIds.add(call.id);

      if (call.client_id && call.client_name) {
        toast(`Κλήση από: ${call.client_name}`, {
          description: call.phone_number,
          action: {
            label: "Άνοιγμα καρτέλας",
            onClick: () => router.push(`/dashboard/clients/${call.client_id}`),
          },
          duration: 20000,
        });
      } else {
        toast("Άγνωστη κλήση", {
          description: call.phone_number,
          duration: 15000,
        });
      }
    }

    async function catchUp() {
      const { data } = await supabase
        .from("incoming_calls")
        .select("id, phone_number, client_id, client_name, created_at")
        .gt("created_at", lastSeenAt)
        .order("created_at", { ascending: true });

      for (const call of (data ?? []) as IncomingCall[]) {
        showCallToast(call);
        lastSeenAt = call.created_at;
      }
    }

    function subscribe() {
      if (disposed) return;
      channel = supabase
        .channel("incoming-calls")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "incoming_calls" },
          (payload) => {
            const call = payload.new as IncomingCall;
            showCallToast(call);
            lastSeenAt = call.created_at;
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            if (reconnectTimer) clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (channel) supabase.removeChannel(channel);
              subscribe();
            }, 3000);
          }
        });
    }

    subscribe();

    function handleFocusOrVisible() {
      if (document.visibilityState !== "visible") return;
      // The socket can be stale after a long background spell even without
      // ever reporting an error — force a clean resubscribe, then fetch
      // whatever landed while we weren't actively listening.
      if (channel) supabase.removeChannel(channel);
      subscribe();
      catchUp();
    }

    document.addEventListener("visibilitychange", handleFocusOrVisible);
    window.addEventListener("focus", handleFocusOrVisible);
    const pollTimer = setInterval(catchUp, CATCH_UP_INTERVAL_MS);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollTimer);
      document.removeEventListener("visibilitychange", handleFocusOrVisible);
      window.removeEventListener("focus", handleFocusOrVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [router, enabled]);

  return null;
}
