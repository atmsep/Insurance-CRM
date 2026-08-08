"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import type { TaskPriority } from "@/lib/database.types";

export async function createTask(formData: FormData) {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const title = formData.get("title") as string;
  const dueDate = formData.get("due_date") as string;
  const priority = (formData.get("priority") as TaskPriority) || "medium";

  if (!title || !dueDate) return;

  await supabase.from("tasks").insert({
    title,
    due_date: dueDate,
    priority,
    assigned_to: agencyUser.id,
    created_by: agencyUser.id,
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard/tasks/calendar");
  revalidatePath("/dashboard");
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
