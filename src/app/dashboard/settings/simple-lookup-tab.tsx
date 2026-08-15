"use client";

import { useState, useTransition } from "react";
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
}: {
  columnLabel: string;
  addLabel: string;
  emptyLabel: string;
  rows: LookupRow[];
  createAction: (formData: FormData) => void;
  updateAction: (id: string, formData: FormData) => Promise<{ error?: string }>;
  toggleAction: (id: string, isActive: boolean) => void;
  deleteAction: (id: string) => Promise<{ error?: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateAction(id, formData);
      if (result?.error) toast.error(result.error);
      else setEditingId(null);
    });
  }

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Διαγραφή "${name}";`)) return;
    startTransition(async () => {
      const result = await deleteAction(id);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
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
            {rows.length ? (
              rows.map((row) =>
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
                          onClick={() => startTransition(() => toggleAction(row.id, !row.is_active))}
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
                  {emptyLabel}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createAction} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`new-${columnLabel}`}>{columnLabel}</Label>
          <Input id={`new-${columnLabel}`} name="name" required className="w-56" />
        </div>
        <Button type="submit">{addLabel}</Button>
      </form>
    </div>
  );
}
