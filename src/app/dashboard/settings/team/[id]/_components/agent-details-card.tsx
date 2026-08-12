"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormValues } from "@/hooks/use-form-values";

const ROLE_LABELS: Record<string, string> = {
  owner: "Ιδιοκτήτης",
  admin: "Διαχειριστής",
  agent: "Συνεργάτης",
  viewer: "Παρατηρητής",
};

function ViewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
  );
}

type Agent = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  hire_date: string | null;
  credit_limit: number | null;
};

export function AgentDetailsCard({
  agent,
  isSelf,
  updateAction,
}: {
  agent: Agent;
  isSelf: boolean;
  updateAction: (formData: FormData) => Promise<{ error: string } | undefined>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { field } = useFormValues({
    full_name: agent.full_name,
    email: agent.email,
    phone: agent.phone ?? "",
    hire_date: agent.hire_date ?? "",
    credit_limit: agent.credit_limit != null ? String(agent.credit_limit) : "",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Στοιχεία συνεργάτη</CardTitle>
        <CardAction>
          <Button variant="outline" size="sm" onClick={() => setIsEditing((v) => !v)}>
            {isEditing ? "Ακύρωση" : "Επεξεργασία"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <form
            action={async (formData) => {
              setIsSaving(true);
              const result = await updateAction(formData);
              setIsSaving(false);
              if (result?.error) {
                toast.error(result.error);
              } else {
                toast.success("Οι αλλαγές αποθηκεύτηκαν.");
                setIsEditing(false);
              }
            }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="full_name">Ονοματεπώνυμο</Label>
                <Input id="full_name" name="full_name" required {...field("full_name")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required {...field("email")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Τηλέφωνο</Label>
                <Input id="phone" name="phone" {...field("phone")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="hire_date">Ημερομηνία πρόσληψης</Label>
                <Input id="hire_date" name="hire_date" type="date" {...field("hire_date")} />
              </div>
              <div className="flex flex-col gap-2">
                <Label>Ρόλος</Label>
                {isSelf ? (
                  <>
                    <p className="flex h-8 items-center text-sm">{ROLE_LABELS[agent.role] ?? agent.role}</p>
                    <input type="hidden" name="role" value={agent.role} />
                    <p className="text-xs text-muted-foreground">Δεν μπορείς να αλλάξεις τον δικό σου ρόλο.</p>
                  </>
                ) : (
                  <Select name="role" defaultValue={agent.role}>
                    <SelectTrigger className="w-full">
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
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="credit_limit">Πλαφόν ανεξόφλητου (€)</Label>
                <Input
                  id="credit_limit"
                  name="credit_limit"
                  type="number"
                  step="0.01"
                  placeholder="Χωρίς όριο"
                  {...field("credit_limit")}
                />
              </div>
            </div>
            <Button type="submit" disabled={isSaving} className="w-fit">
              {isSaving ? "Αποθήκευση..." : "Αποθήκευση"}
            </Button>
          </form>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ViewField label="Ονοματεπώνυμο" value={agent.full_name} />
            <ViewField label="Email" value={agent.email} />
            <ViewField label="Τηλέφωνο" value={agent.phone} />
            <ViewField label="Ημερομηνία πρόσληψης" value={agent.hire_date} />
            <ViewField label="Ρόλος" value={ROLE_LABELS[agent.role] ?? agent.role} />
            <ViewField
              label="Πλαφόν ανεξόφλητου"
              value={agent.credit_limit != null ? `${agent.credit_limit.toFixed(2)} €` : undefined}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
