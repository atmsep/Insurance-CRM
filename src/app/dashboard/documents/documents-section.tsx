"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uploadDocument, deleteDocument, type EntityType, type UploadDocumentState } from "./actions";
import type { DocumentWithUrl } from "./get-documents";

function formatSize(bytes: number | null) {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR", { timeZone: "Europe/Athens" });
}

export function DocumentsSection({
  entityType,
  entityId,
  documents,
}: {
  entityType: EntityType;
  entityId: string;
  documents: DocumentWithUrl[];
}) {
  const boundUpload = uploadDocument.bind(null, entityType, entityId);
  const [state, formAction, pending] = useActionState<UploadDocumentState, FormData>(
    boundUpload,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Έγγραφα</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αρχείο</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Μέγεθος</TableHead>
              <TableHead>Ημ/νία</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.length ? (
              documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell>
                    {doc.url ? (
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline"
                      >
                        {doc.file_name}
                      </a>
                    ) : (
                      doc.file_name
                    )}
                  </TableCell>
                  <TableCell>{doc.document_type ?? "—"}</TableCell>
                  <TableCell>{formatSize(doc.file_size_bytes)}</TableCell>
                  <TableCell>{formatDate(doc.uploaded_at)}</TableCell>
                  <TableCell>
                    <form
                      action={deleteDocument.bind(
                        null,
                        entityType,
                        entityId,
                        doc.id,
                        doc.storage_path,
                      )}
                    >
                      <Button type="submit" size="sm" variant="outline">
                        Διαγραφή
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Δεν υπάρχουν έγγραφα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor={`file-${entityId}`}>Αρχείο</Label>
            <Input id={`file-${entityId}`} name="file" type="file" required className="w-64" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`document_type-${entityId}`}>Τύπος εγγράφου</Label>
            <Input
              id={`document_type-${entityId}`}
              name="document_type"
              placeholder="π.χ. Ταυτότητα, Συμβόλαιο"
              className="w-56"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? "Ανέβασμα..." : "Ανέβασμα εγγράφου"}
          </Button>
          {state?.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
