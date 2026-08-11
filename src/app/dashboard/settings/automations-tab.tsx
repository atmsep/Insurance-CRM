"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toggleAppSetting } from "./actions";

type AppSetting = { key: string; enabled: boolean };

const LABELS: Record<string, { title: string; description: string }> = {
  renewal_reminder_tasks: {
    title: "Εσωτερικές υπενθυμίσεις ανανέωσης",
    description: "Δημιουργεί καθημερινά υπενθύμιση στον συνεργάτη για συμβόλαια που λήγουν σε 30 ημέρες.",
  },
  renewal_reminder_emails: {
    title: "Email ειδοποίησης ανανέωσης στον πελάτη",
    description: "Στέλνει αυτόματα email στον πελάτη 30 και 7 ημέρες πριν τη λήξη του συμβολαίου του.",
  },
  celebration_tasks: {
    title: "Εσωτερικές υπενθυμίσεις γιορτής/γενεθλίων",
    description: "Δημιουργεί καθημερινά υπενθύμιση στον συνεργάτη όταν πελάτης γιορτάζει ή έχει γενέθλια.",
  },
  celebration_emails: {
    title: "Email ευχών γιορτής/γενεθλίων στον πελάτη",
    description: "Στέλνει αυτόματα email με ευχές στον πελάτη τη μέρα της γιορτής ή των γενεθλίων του.",
  },
};

export function AutomationsTab({ settings }: { settings: AppSetting[] }) {
  const [pending, startTransition] = useTransition();

  return (
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
          {settings.length ? (
            settings.map((setting) => {
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
  );
}
