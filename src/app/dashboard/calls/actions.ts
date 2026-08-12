"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

// Same optional-notes update as clients/actions.ts's updateIncomingCallNotes
// (per-client tab), just revalidating the all-calls list page instead of a
// specific client page — the list also has to cover unmatched calls, which
// have no client page to revalidate.
export async function updateCallNotes(callId: string, formData: FormData) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const notes = (formData.get("notes") as string) || null;

  await supabase.from("incoming_calls").update({ notes }).eq("id", callId);

  revalidatePath("/dashboard/calls");
}
