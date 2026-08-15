"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type LookupRow = { id: string; name: string; is_active: boolean };

export function SimpleLookupTab({
  columnLabel,
  addLabel,
  emptyLabel,
  rows,
  createAction,
  updateAction,
  toggleAction,
  deleteAction,
  onChanged,
}: {
  columnLabel: string;
  addLabel: string;
  emptyLabel: string;
  rows: LookupRow[];
  createAction: (formData: FormData) => void;
  updateAction: (id: string, formData: FormData) => Promise<{ error?: string }>;
  toggleAction: (id: string, isActive: boolean) => void;
  deleteAction: (id: string) => Promise<{ error?: string }>;
  // Rows are fetched once by the parent and held in local state (not
  // server-rendered props), so a successful mutation needs an explicit
  // nudge to refetch — same pattern as the Κινήσεις "Απόδειξη" dialog.
  onChanged?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("el");
    if (!q) return rows;
    return rows.filter((r) => r.name.toLocaleLowerCase("el").includes(q));
  }, [filter, rows]);

  function handleCreate(formData: FormData) {
    createAction(formData);
    onChanged?.();
  }

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateAction(id, formData);
      if (result?.error) toast.error(result.error);
      else {
        setEditingId(null);
        onChanged?.();
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleAction(id, isActive);
      onChanged?.();
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Διαγραφή "${name}";`)) return;
    startTransition(async () => {
      const result = await deleteAction(id);
      if (result?.error) toast.error(result.error);
      else onChanged?.();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {rows.length > 15 && (
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder={`Αναζήτηση (${rows.length})...`}
          className="w-64"
        />
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{columnLabel}</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length ? (
              filteredRows.map((row) =>
                editingId === row.id ? (
                  <TableRow key={row.id}>
                    <TableCell colSpan={2}>
                      <form
                        id={`edit-${row.id}`}
                        action={(formData) => handleUpdate(row.id, formData)}
                      >
                        <Input name="name" defaultValue={row.name} required autoFocus className="h-8 w-56" />
                      </form>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" type="submit" form={`edit-${row.id}`} disabled={pending}>
                          Αποθήκευση
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => setEditingId(null)}
                        >
                          Άκυρο
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={row.id}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>
                      <Badge variant={row.is_active ? "default" : "outline"}>
                        {row.is_active ? "Ενεργό" : "Ανενεργό"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => setEditingId(row.id)}
                        >
                          Επεξεργασία
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleToggle(row.id, !row.is_active)}
                        >
                          {row.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => handleDelete(row.id, row.name)}
                        >
                          Διαγραφή
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ),
              )
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  {rows.length ? "Καμία αντιστοιχία." : emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`new-${columnLabel}`}>{columnLabel}</Label>
          <Input id={`new-${columnLabel}`} name="name" required className="w-56" />
        </div>
        <Button type="submit">{addLabel}</Button>
      </form>
    </div>
  );
}
