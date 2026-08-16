"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ColumnFilter, type SortDirection } from "../clients/[id]/_components/column-filter";
import {
  updateAgencyUserRole,
  toggleAgencyUserActive,
  inviteAgencyUser,
  createAgencyUserDirect,
  type ActionState,
} from "./actions";

type AgencyUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Ιδιοκτήτης",
  admin: "Διαχειριστής",
  agent: "Συνεργάτης",
  viewer: "Παρατηρητής",
};

function RoleSelect({ name, defaultValue }: { name: string; defaultValue: string }) {
  return (
    <Select name={name} defaultValue={defaultValue}>
      <SelectTrigger className="w-40">
        <SelectValue>{(v: string) => ROLE_LABELS[v] ?? v}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(ROLE_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ActionMessage({ state }: { state: ActionState }) {
  if (!state) return null;
  if ("error" in state) return <p className="mt-2 text-sm text-destructive">{state.error}</p>;
  return <p className="mt-2 text-sm text-success">{state.success}</p>;
}

type Column = {
  key: string;
  label: string;
  getValue: (u: AgencyUser) => string;
  getSortKey: (u: AgencyUser) => string | number;
};

const COLUMNS: Column[] = [
  { key: "full_name", label: "Όνομα", getValue: (u) => u.full_name, getSortKey: (u) => u.full_name },
  { key: "email", label: "Email", getValue: (u) => u.email, getSortKey: (u) => u.email },
  { key: "role", label: "Ρόλος", getValue: (u) => ROLE_LABELS[u.role] ?? u.role, getSortKey: (u) => ROLE_LABELS[u.role] ?? u.role },
  {
    key: "status",
    label: "Κατάσταση",
    getValue: (u) => (u.is_active ? "Ενεργός" : "Ανενεργός"),
    getSortKey: (u) => (u.is_active ? 1 : 0),
  },
];

export function TeamTab({
  users,
  currentUserId,
}: {
  users: AgencyUser[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"direct" | "invite">("direct");
  const [filters, setFilters] = useState<Record<string, Set<string> | null>>({});
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(null);
  const [directState, directAction, directPending] = useActionState<ActionState, FormData>(
    createAgencyUserDirect,
    undefined,
  );
  const [inviteState, inviteAction, invitePending] = useActionState<ActionState, FormData>(
    inviteAgencyUser,
    undefined,
  );

  const optionsByColumn = useMemo(() => {
    const map = new Map<string, { value: string; sortKey: string | number }[]>();
    for (const col of COLUMNS) {
      const seen = new Map<string, string | number>();
      for (const u of users) {
        const value = col.getValue(u);
        if (!seen.has(value)) seen.set(value, col.getSortKey(u));
      }
      map.set(
        col.key,
        [...seen.entries()].map(([value, sortKey]) => ({ value, sortKey })),
      );
    }
    return map;
  }, [users]);

  const visibleUsers = useMemo(() => {
    const filtered = users.filter((u) =>
      COLUMNS.every((col) => {
        const active = filters[col.key];
        return !active || active.has(col.getValue(u));
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
  }, [users, filters, sort]);

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Νέος συνεργάτης</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={mode === "direct" ? "default" : "outline"}
              onClick={() => setMode("direct")}
            >
              Άμεση καταχώρηση
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "invite" ? "default" : "outline"}
              onClick={() => setMode("invite")}
            >
              Πρόσκληση με email
            </Button>
          </div>

          {mode === "direct" ? (
            <>
              <p className="text-xs text-muted-foreground">
                Ο λογαριασμός δημιουργείται αμέσως με τον κωδικό που ορίζεις — χωρίς email πρόσκλησης.
              </p>
              <form action={directAction} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="direct_full_name">Ονοματεπώνυμο</Label>
                  <Input id="direct_full_name" name="full_name" required className="w-56" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="direct_email">Email</Label>
                  <Input id="direct_email" name="email" type="email" required className="w-64" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="direct_password">Κωδικός</Label>
                  <Input
                    id="direct_password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    className="w-48"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ρόλος</Label>
                  <RoleSelect name="role" defaultValue="agent" />
                </div>
                <Button type="submit" disabled={directPending}>
                  {directPending ? "Καταχώρηση..." : "Καταχώρηση συνεργάτη"}
                </Button>
              </form>
              <ActionMessage state={directState} />
            </>
          ) : (
            <>
              <form action={inviteAction} className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite_full_name">Ονοματεπώνυμο</Label>
                  <Input id="invite_full_name" name="full_name" required className="w-56" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="invite_email">Email</Label>
                  <Input id="invite_email" name="email" type="email" required className="w-64" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Ρόλος</Label>
                  <RoleSelect name="role" defaultValue="agent" />
                </div>
                <Button type="submit" disabled={invitePending}>
                  {invitePending ? "Αποστολή..." : "Αποστολή πρόσκλησης"}
                </Button>
              </form>
              <ActionMessage state={inviteState} />
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border">
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
            {visibleUsers.map((user) => {
              return (
                <TableRow key={user.id}>
                  <TableCell>
                    <Link href={`/dashboard/settings/team/${user.id}`} className="hover:underline">
                      {user.full_name}
                    </Link>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Select
                      value={user.role}
                      disabled={pending || user.id === currentUserId}
                      onValueChange={(value) => {
                        if (value) startTransition(() => updateAgencyUserRole(user.id, value));
                      }}
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue>
                          {(value: string) => ROLE_LABELS[value] ?? value}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(ROLE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.is_active ? "default" : "outline"}>
                      {user.is_active ? "Ενεργός" : "Ανενεργός"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {user.id !== currentUserId && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() => toggleAgencyUserActive(user.id, !user.is_active))
                        }
                      >
                        {user.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
