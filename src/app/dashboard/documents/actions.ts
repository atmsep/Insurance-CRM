"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@/lib/supabase/server";
import { requireAgencyUser } from "@/lib/dal";

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
) {
  await requireAgencyUser();
  const supabase = await createSupabaseClient();

  await supabase.storage.from("documents").remove([storagePath]);
  await supabase.from("documents").delete().eq("id", documentId);

  revalidatePath(pathFor(entityType, entityId));
}
