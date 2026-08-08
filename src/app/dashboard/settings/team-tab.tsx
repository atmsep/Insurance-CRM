"use client";

import { useActionState, useTransition } from "react";
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
import {
  updateAgencyUserRole,
  toggleAgencyUserActive,
  updateAgencyUserCreditLimit,
  inviteAgencyUser,
  type ActionState,
} from "./actions";

type AgencyUser = {
  id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
  credit_limit: number | null;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Ιδιοκτήτης",
  admin: "Διαχειριστής",
  agent: "Συνεργάτης",
  viewer: "Παρατηρητής",
};

export function TeamTab({
  users,
  currentUserId,
  outstandingByAgent,
}: {
  users: AgencyUser[];
  currentUserId: string;
  outstandingByAgent: Record<string, number>;
}) {
  const [pending, startTransition] = useTransition();
  const [inviteState, inviteAction, invitePending] = useActionState<ActionState, FormData>(
    inviteAgencyUser,
    undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Πρόσκληση νέου συνεργάτη</CardTitle>
        </CardHeader>
        <CardContent>
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
              <Select name="role" defaultValue="agent">
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
            </div>
            <Button type="submit" disabled={invitePending}>
              {invitePending ? "Αποστολή..." : "Αποστολή πρόσκλησης"}
            </Button>
          </form>
          {inviteState && "error" in inviteState && (
            <p className="mt-2 text-sm text-destructive">{inviteState.error}</p>
          )}
          {inviteState && "success" in inviteState && (
            <p className="mt-2 text-sm text-success">
              {inviteState.success}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ρόλος</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead>Ανεξόφλητο υπόλοιπο</TableHead>
              <TableHead>Πλαφόν (€)</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => {
              const outstanding = outstandingByAgent[user.id] ?? 0;
              const overLimit = user.credit_limit != null && outstanding > user.credit_limit;
              const updateCreditLimitAction = updateAgencyUserCreditLimit.bind(null, user.id);

              return (
                <TableRow key={user.id}>
                  <TableCell>{user.full_name}</TableCell>
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
                    <span className={overLimit ? "font-medium text-destructive" : ""}>
                      {outstanding.toFixed(2)} €
                    </span>
                    {overLimit && (
                      <Badge variant="destructive" className="ml-2">
                        Υπέρβαση πλαφόν
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <form action={updateCreditLimitAction} className="flex items-center gap-2">
                      <Input
                        name="credit_limit"
                        type="number"
                        step="0.01"
                        defaultValue={user.credit_limit ?? ""}
                        placeholder="Χωρίς όριο"
                        className="w-28"
                      />
                      <Button type="submit" size="sm" variant="outline">
                        Αποθ.
                      </Button>
                    </form>
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
