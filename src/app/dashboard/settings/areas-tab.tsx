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
import { createArea, updateArea, toggleAreaActive, deleteArea } from "./lookup-actions";

export type Area = { id: string; postal_code: string | null; city: string; region: string | null; is_active: boolean };

export function AreasTab({ areas, onChanged }: { areas: Area[]; onChanged?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filteredAreas = useMemo(() => {
    const q = filter.trim().toLocaleLowerCase("el");
    if (!q) return areas;
    return areas.filter(
      (a) =>
        a.city.toLocaleLowerCase("el").includes(q) ||
        a.postal_code?.includes(q) ||
        a.region?.toLocaleLowerCase("el").includes(q),
    );
  }, [filter, areas]);

  function handleCreate(formData: FormData) {
    createArea(formData);
    onChanged?.();
  }

  function handleUpdate(id: string, formData: FormData) {
    startTransition(async () => {
      const result = await updateArea(id, formData);
      if (result?.error) toast.error(result.error);
      else {
        setEditingId(null);
        onChanged?.();
      }
    });
  }

  function handleToggle(id: string, isActive: boolean) {
    startTransition(async () => {
      await toggleAreaActive(id, isActive);
      onChanged?.();
    });
  }

  function handleDelete(id: string, city: string) {
    if (!window.confirm(`Διαγραφή "${city}";`)) return;
    startTransition(async () => {
      const result = await deleteArea(id);
      if (result?.error) toast.error(result.error);
      else onChanged?.();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Αναζήτηση ΤΚ/πόλης/περιφέρειας (${areas.length})...`}
        className="w-72"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ΤΚ</TableHead>
              <TableHead>Πόλη</TableHead>
              <TableHead>Περιφέρεια</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAreas.length ? (
              filteredAreas.map((area) =>
                editingId === area.id ? (
                  <TableRow key={area.id}>
                    <TableCell colSpan={3}>
                      <form
                        id={`edit-area-${area.id}`}
                        action={(formData) => handleUpdate(area.id, formData)}
                        className="flex flex-wrap gap-2"
                      >
                        <Input name="postal_code" defaultValue={area.postal_code ?? ""} placeholder="ΤΚ" className="h-8 w-24" />
                        <Input
                          name="city"
                          defaultValue={area.city}
                          placeholder="Πόλη"
                          required
                          autoFocus
                          className="h-8 w-40"
                        />
                        <Input name="region" defaultValue={area.region ?? ""} placeholder="Περιφέρεια" className="h-8 w-40" />
                      </form>
                    </TableCell>
                    <TableCell />
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" type="submit" form={`edit-area-${area.id}`} disabled={pending}>
                          Αποθήκευση
                        </Button>
                        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setEditingId(null)}>
                          Άκυρο
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={area.id}>
                    <TableCell>{area.postal_code ?? "—"}</TableCell>
                    <TableCell>{area.city}</TableCell>
                    <TableCell>{area.region ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={area.is_active ? "default" : "outline"}>
                        {area.is_active ? "Ενεργή" : "Ανενεργή"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditingId(area.id)}>
                          Επεξεργασία
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => handleToggle(area.id, !area.is_active)}
                        >
                          {area.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => handleDelete(area.id, area.city)}
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
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  {areas.length ? "Καμία αντιστοιχία." : "Δεν υπάρχουν περιοχές."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={handleCreate} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="area_postal_code">ΤΚ</Label>
          <Input id="area_postal_code" name="postal_code" className="w-24" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="area_city">Πόλη</Label>
          <Input id="area_city" name="city" required className="w-48" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="area_region">Περιφέρεια</Label>
          <Input id="area_region" name="region" className="w-48" />
        </div>
        <Button type="submit">Προσθήκη περιοχής</Button>
      </form>
    </div>
  );
}
