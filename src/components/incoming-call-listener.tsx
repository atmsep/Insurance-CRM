"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

type IncomingCall = {
  phone_number: string;
  client_id: string | null;
  client_name: string | null;
};

export function IncomingCallListener() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incoming_calls" },
        (payload) => {
          const call = payload.new as IncomingCall;

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
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
