"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { TaskPriority } from "@/lib/database.types";
import { sendEmail } from "@/lib/email";
import { isCelebrationType } from "@/lib/celebrations";
import { logActivity } from "@/lib/activity-log";
import { notify } from "@/lib/notifications";

export async function createTask(formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const title = formData.get("title") as string;
  const dueDate = formData.get("due_date") as string;
  const priority = (formData.get("priority") as TaskPriority) || "medium";
  const clientId = (formData.get("client_id") as string) || null;
  // Optional assignment to a colleague — the daily "πάρε τον πελάτη Χ" that
  // one person books for another. Defaults to self, exactly as before.
  const assignedTo = (formData.get("assigned_to") as string) || agencyUser.id;

  if (!title || !dueDate) return;

  const { error } = await supabase.from("tasks").insert({
    title,
    due_date: dueDate,
    priority,
    client_id: clientId,
    assigned_to: assignedTo,
    created_by: agencyUser.id,
  });
  if (error) return;

  await notify(supabase, {
    recipientId: assignedTo,
    actorId: agencyUser.id,
    kind: "task_assigned",
    title: "Σου ανατέθηκε υπενθύμιση",
    body: `${title} — έως ${dueDate}`,
    link: "/dashboard/tasks",
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
  if (clientId) revalidatePath(`/dashboard/clients/${clientId}`);
}

export async function completeTask(taskId: string) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  // Only the person the task belongs to (assignee or creator) — or an
  // admin — may close it; anyone else's click is a silent no-op instead of
  // marking someone else's reminder as done.
  const { data: task } = await supabase
    .from("tasks")
    .select("assigned_to, created_by")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return;
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  if (!isAdmin && task.assigned_to !== agencyUser.id && task.created_by !== agencyUser.id) {
    return;
  }

  const { error } = await supabase
    .from("tasks")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId);
  if (error) return;

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
}

// Shared permission rule for touching an existing υπενθύμιση: its assignee,
// its creator, or an admin — same boundary completeTask already enforces.
async function canTouchTask(
  supabase: Awaited<ReturnType<typeof createSupabaseClient>>,
  agencyUser: { id: string; role: string },
  taskId: string,
): Promise<{ ok: boolean }> {
  const { data: task } = await supabase
    .from("tasks")
    .select("assigned_to, created_by")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return { ok: false };
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  return { ok: isAdmin || task.assigned_to === agencyUser.id || task.created_by === agencyUser.id };
}

// Επεξεργασία υπενθύμισης — τίτλος, ημερομηνία (μετάθεση), προτεραιότητα
// και ανάθεση σε άλλον συνεργάτη.
export async function updateTask(
  taskId: string,
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const allowed = await canTouchTask(supabase, agencyUser, taskId);
  if (!allowed.ok) return { error: "Δεν έχεις δικαίωμα σε αυτή την υπενθύμιση." };

  const title = (formData.get("title") as string) || "";
  const dueDate = (formData.get("due_date") as string) || "";
  const priority = ((formData.get("priority") as string) || "medium") as TaskPriority;
  const assignedTo = (formData.get("assigned_to") as string) || null;
  if (!title.trim() || !dueDate) return { error: "Συμπλήρωσε τίτλο και ημερομηνία." };

  const { error } = await supabase
    .from("tasks")
    .update({
      title: title.trim(),
      due_date: dueDate,
      priority,
      ...(assignedTo ? { assigned_to: assignedTo } : {}),
    })
    .eq("id", taskId);
  if (error) return { error: "Σφάλμα: " + error.message };

  // Only tell someone when the task actually became theirs.
  if (assignedTo && assignedTo !== agencyUser.id) {
    await notify(supabase, {
      recipientId: assignedTo,
      actorId: agencyUser.id,
      kind: "task_assigned",
      title: "Σου ανατέθηκε υπενθύμιση",
      body: `${title.trim()} — έως ${dueDate}`,
      link: "/dashboard/tasks",
    });
  }

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
}

export async function deleteTask(taskId: string): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const allowed = await canTouchTask(supabase, agencyUser, taskId);
  if (!allowed.ok) return { error: "Δεν έχεις δικαίωμα σε αυτή την υπενθύμιση." };

  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { error: "Σφάλμα κατά τη διαγραφή: " + error.message };

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
  const agencyUser = await requireAgencyUser();
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

  await logActivity(supabase, {
    entityType: "client",
    entityId: task.client_id,
    action: "email_sent",
    description: `Στάλθηκαν ευχές στο ${client.email} — «${subject}».`,
    actorId: agencyUser.id,
  });

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
