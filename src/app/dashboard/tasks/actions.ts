"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { TaskPriority } from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { isCelebrationType } from "@/lib/celebrations";

export async function createTask(formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const title = formData.get("title") as string;
  const dueDate = formData.get("due_date") as string;
  const priority = (formData.get("priority") as TaskPriority) || "medium";
  const clientId = (formData.get("client_id") as string) || null;

  if (!title || !dueDate) return;

  await supabase.from("tasks").insert({
    title,
    due_date: dueDate,
    priority,
    client_id: clientId,
    assigned_to: agencyUser.id,
    created_by: agencyUser.id,
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function completeTask(taskId: string) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
}

export type SendWishState = { error: string } | { success: string } | undefined;

// Sending a name-day/birthday wish is a deliberate manual click on the
// reminder task (see CelebrationWishDialog) — the daily cron only ever
// creates the task, never the email, so this is the one place that email
// actually goes out.
export async function sendCelebrationWish(
  taskId: string,
  _prevState: SendWishState,
  formData: FormData,
): Promise<SendWishState> {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const subject = formData.get("subject") as string;
  const body = formData.get("body") as string;
  if (!subject || !body) {
    return { error: "Συμπλήρωσε θέμα και κείμενο." };
  }

  const { data: task } = await supabase
    .from("tasks")
    .select("id, task_type, client_id, due_date")
    .eq("id", taskId)
    .single();

  if (!task || !task.client_id || !isCelebrationType(task.task_type)) {
    return { error: "Η υπενθύμιση δεν αφορά γιορτή ή γενέθλια." };
  }

  const { data: client } = await supabase
    .from("clients")
    .select("email")
    .eq("id", task.client_id)
    .single();

  if (!client?.email) {
    return { error: "Ο πελάτης δεν έχει καταχωρημένο email." };
  }

  const result = await sendEmail({ to: client.email, subject, html: body });
  if (!result.ok) {
    return { error: "Σφάλμα αποστολής: " + result.error };
  }

  await supabase
    .from("client_celebrations_log")
    .update({ email_sent: true })
    .eq("client_id", task.client_id)
    .eq("celebration_type", task.task_type)
    .eq("celebration_date", task.due_date);

  await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");

  return { success: "Οι ευχές στάλθηκαν." };
}
