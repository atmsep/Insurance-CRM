"use client";

import { useActionState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleAppSetting, updateRenewalReminderDays, type ActionState } from "./actions";

type AppSetting = { key: string; enabled: boolean; value: number | null };

const NUMERIC_KEYS = new Set(["renewal_reminder_days_primary", "renewal_reminder_days_final"]);

const LABELS: Record<string, { title: string; description: string }> = {
  renewal_reminder_tasks: {
    title: "Εσωτερικές υπενθυμίσεις ανανέωσης",
    description: "Δημιουργεί καθημερινά υπενθύμιση στον συνεργάτη για συμβόλαια που πλησιάζουν στη λήξη.",
  },
  renewal_reminder_emails: {
    title: "Email ειδοποίησης ανανέωσης στον πελάτη",
    description: "Στέλνει αυτόματα email στον πελάτη πριν τη λήξη του συμβολαίου του.",
  },
  celebration_tasks: {
    title: "Υπενθυμίσεις γιορτής/γενεθλίων",
    description:
      "Δημιουργεί καθημερινά υπενθύμιση όταν πελάτης γιορτάζει ή έχει γενέθλια, στο ημερολόγιο και στις εργασίες ημέρας. Η αποστολή ευχών γίνεται χειροκίνητα με κλικ πάνω στην υπενθύμιση.",
  },
};

function RenewalReminderDaysForm({ primaryDays, finalDays }: { primaryDays: number; finalDays: number }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateRenewalReminderDays,
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Χρονισμός υπενθυμίσεων ανανέωσης</CardTitle>
        <CardDescription>
          Πόσες μέρες πριν τη λήξη ενός συμβολαίου να ξεκινούν οι υπενθυμίσεις ανανέωσης (εσωτερική εργασία,
          πρώτο και τελευταίο email στον πελάτη).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="primary_days">Πρώτη υπενθύμιση (μέρες πριν τη λήξη)</Label>
            <Input
              id="primary_days"
              name="primary_days"
              type="number"
              min={1}
              defaultValue={primaryDays}
              required
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="final_days">Τελευταία υπενθύμιση (μέρες πριν τη λήξη)</Label>
            <Input
              id="final_days"
              name="final_days"
              type="number"
              min={1}
              defaultValue={finalDays}
              required
              className="w-40"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Αποθήκευση..." : "Αποθήκευση"}
          </Button>
        </form>
        {state && "error" in state && <p className="mt-2 text-sm text-destructive">{state.error}</p>}
        {state && "success" in state && <p className="mt-2 text-sm text-success">{state.success}</p>}
      </CardContent>
    </Card>
  );
}

export function AutomationsTab({ settings }: { settings: AppSetting[] }) {
  const [pending, startTransition] = useTransition();

  const toggleSettings = settings.filter((s) => !NUMERIC_KEYS.has(s.key));
  const primaryDays = settings.find((s) => s.key === "renewal_reminder_days_primary")?.value ?? 30;
  const finalDays = settings.find((s) => s.key === "renewal_reminder_days_final")?.value ?? 7;

  return (
    <div className="flex flex-col gap-4">
      <RenewalReminderDaysForm primaryDays={primaryDays} finalDays={finalDays} />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Αυτοματισμός</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {toggleSettings.length ? (
              toggleSettings.map((setting) => {
                const label = LABELS[setting.key] ?? { title: setting.key, description: "" };
                return (
                  <TableRow key={setting.key}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{label.title}</span>
                        {label.description && (
                          <span className="text-xs text-muted-foreground">{label.description}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={setting.enabled ? "default" : "outline"}>
                        {setting.enabled ? "Ενεργό" : "Ανενεργό"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          startTransition(() => toggleAppSetting(setting.key, !setting.enabled))
                        }
                      >
                        {setting.enabled ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground">
                  Δεν υπάρχουν αυτοματισμοί.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
