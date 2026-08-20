"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

export type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

// RLS already scopes every row to the caller — no extra filter needed here
// beyond ordering and the small cap the bell menu shows.
export async function getMyNotifications(): Promise<{ rows: NotificationRow[]; unread: number }> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const [{ data }, { count }] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, link, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return { rows: (data ?? []) as NotificationRow[], unread: count ?? 0 };
}

export async function markNotificationRead(notificationId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null);
  revalidatePath("/dashboard");
}

export async function markAllNotificationsRead() {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  revalidatePath("/dashboard");
}
