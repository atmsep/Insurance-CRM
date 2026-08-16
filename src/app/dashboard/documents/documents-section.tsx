"use client";

import { useActionState, useMemo, useState } from "react";
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
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";
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

type Column = {
  key: string;
  label: string;
  getValue: (d: DocumentWithUrl) => string;
  getSortKey: (d: DocumentWithUrl) => string | number;
};

const COLUMNS: Column[] = [
  { key: "file_name", label: "Αρχείο", getValue: (d) => d.file_name, getSortKey: (d) => d.file_name },
  {
    key: "document_type",
    label: "Τύπος",
    getValue: (d) => d.document_type ?? "—",
    getSortKey: (d) => d.document_type ?? "",
  },
  {
    key: "file_size_bytes",
    label: "Μέγεθος",
    getValue: (d) => formatSize(d.file_size_bytes),
    getSortKey: (d) => d.file_size_bytes ?? 0,
  },
  {
    key: "uploaded_at",
    label: "Ημ/νία",
    getValue: (d) => formatDate(d.uploaded_at),
    getSortKey: (d) => d.uploaded_at,
  },
];

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
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const d of documents) {
        const value = col.getValue(d);
        if (!seen.has(value)) seen.set(value, col.getSortKey(d));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [documents]);

  const visibleDocuments = useMemo(() => {
    const filtered = documents.filter((d) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(d));
      }),
    );
    if (!sort) return filtered;
    const col = COLUMNS.find((c) => c.key === sort.key);
    if (!col) return filtered;
    const sign = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const ka = col.getSortKey(a);
      const kb = col.getSortKey(b);
      return ka < kb ? -sign : ka > kb ? sign : 0;
    });
  }, [documents, filters, sort]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Έγγραφα</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((col) => (
                <TableHead key={col.key}>
                  <ColumnFilter
                    label={col.label}
                    options={optionsByColumn.get(col.key) ?? []}
                    active={filters[col.key] ?? null}
                    onChange={(next) => setFilters((f) => ({ ...f, [col.key]: next }))}
                    sortDirection={sort?.key === col.key ? sort.direction : null}
                    onSort={(direction) => setSort(direction ? { key: col.key, direction } : null)}
                  />
                </TableHead>
              ))}
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleDocuments.length ? (
              visibleDocuments.map((doc) => (
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
                  {documents.length ? "Καμία εγγραφή δεν ταιριάζει με τα φίλτρα." : "Δεν υπάρχουν έγγραφα."}
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
