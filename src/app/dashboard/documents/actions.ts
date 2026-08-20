"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";

export type EntityType = "client" | "policy" | "claim";
export type UploadDocumentState = { error: string } | undefined;

function pathFor(entityType: EntityType, entityId: string) {
  return entityType === "client"
    ? `/dashboard/clients/${entityId}`
    : entityType === "policy"
      ? `/dashboard/policies/${entityId}`
      : `/dashboard/claims/${entityId}`;
}

function columnFor(entityType: EntityType) {
  return entityType === "client"
    ? "client_id"
    : entityType === "policy"
      ? "policy_id"
      : "claim_id";
}

export async function uploadDocument(
  entityType: EntityType,
  entityId: string,
  _prevState: UploadDocumentState,
  formData: FormData,
): Promise<UploadDocumentState> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "Επίλεξε ένα αρχείο." };
  }
  // Supabase Storage default object cap is 50MB anyway — fail with a clear
  // message well before that instead of a cryptic storage error.
  const MAX_BYTES = 25 * 1024 * 1024;
  if (file.size > MAX_BYTES) {
    return { error: "Το αρχείο ξεπερνά τα 25MB — συμπίεσέ το ή χώρισέ το." };
  }

  const documentType = (formData.get("document_type") as string) || null;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${entityType}/${entityId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(storagePath, file, { contentType: file.type || undefined });

  if (uploadError) {
    return { error: "Σφάλμα κατά το ανέβασμα: " + uploadError.message };
  }

  const { error: insertError } = await supabase.from("documents").insert({
    file_name: file.name,
    storage_path: storagePath,
    mime_type: file.type || null,
    file_size_bytes: file.size,
    document_type: documentType,
    uploaded_by: agencyUser.id,
    [columnFor(entityType)]: entityId,
  });

  if (insertError) {
    await supabase.storage.from("documents").remove([storagePath]);
    return { error: "Σφάλμα κατά την καταχώρηση: " + insertError.message };
  }

  revalidatePath(pathFor(entityType, entityId));
}

export async function deleteDocument(
  entityType: EntityType,
  entityId: string,
  documentId: string,
  storagePath: string,
): Promise<{ error: string } | undefined> {
  const agencyUser = await requireAgencyUser();
  const supabase = await createSupabaseClient();

  // Deletion is permanent (file + record) — allowed only to whoever
  // uploaded it, or an admin. Logged either way, so a vanished έγγραφο is
  // always traceable to who removed it and when.
  const { data: doc } = await supabase
    .from("documents")
    .select("file_name, uploaded_by")
    .eq("id", documentId)
    .maybeSingle();
  if (!doc) return { error: "Δεν βρέθηκε το έγγραφο." };
  const isAdmin = agencyUser.role === "owner" || agencyUser.role === "admin";
  if (!isAdmin && doc.uploaded_by !== agencyUser.id) {
    return { error: "Μόνο όποιος ανέβασε το έγγραφο (ή διαχειριστής) μπορεί να το διαγράψει." };
  }

  const { error: dbError } = await supabase.from("documents").delete().eq("id", documentId);
  if (dbError) return { error: "Σφάλμα κατά τη διαγραφή: " + dbError.message };
  await supabase.storage.from("documents").remove([storagePath]);

  await logActivity(supabase, {
    entityType,
    entityId,
    action: "document_deleted",
    description: `Διαγράφηκε το έγγραφο "${doc.file_name}".`,
    actorId: agencyUser.id,
  });

  revalidatePath(pathFor(entityType, entityId));
}
