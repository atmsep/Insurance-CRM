"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { updateAgencyUserRole, toggleAgencyUserActive } from "./actions";

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

export function TeamTab({
  users,
  currentUserId,
}: {
  users: AgencyUser[];
  currentUserId: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Για να προστεθεί νέος συνεργάτης χρειάζεται ξεχωριστή ρύθμιση (invite flow) — πες μου αν
        θες να το φτιάξουμε.
      </p>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Ρόλος</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
