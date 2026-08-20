"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { transferPortfolio } from "../../../actions";

export function TransferPortfolioCard({
  fromUserId,
  fromUserName,
  agents,
}: {
  fromUserId: string;
  fromUserName: string;
  agents: { id: string; full_name: string }[];
}) {
  const [target, setTarget] = useState("");
  const [pending, startTransition] = useTransition();
  const options = agents.filter((a) => a.id !== fromUserId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Μεταφορά χαρτοφυλακίου</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Μεταφέρει όλους τους πελάτες, τα συμβόλαια και τις ανοιχτές εκκρεμότητες του/της {fromUserName} σε
          άλλον συνεργάτη. Το ιστορικό παραγωγής/προμηθειών δεν αλλάζει.
        </p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="transfer-target">Παραλήπτης</Label>
          <select
            id="transfer-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-9 rounded-md border border-input bg-transparent px-2.5 text-sm"
          >
            <option value="">— Επίλεξε συνεργάτη —</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!target || pending}
          className="w-fit"
          onClick={() => {
            const targetName = options.find((a) => a.id === target)?.full_name ?? "";
            if (!window.confirm(`Μεταφορά ΟΛΟΥ του χαρτοφυλακίου του/της ${fromUserName} στον/στην ${targetName};`)) {
              return;
            }
            startTransition(async () => {
              const result = await transferPortfolio(fromUserId, target);
              if ("error" in result) toast.error(result.error);
              else toast.success(result.success);
            });
          }}
        >
          {pending ? "Μεταφορά..." : "Μεταφορά χαρτοφυλακίου"}
        </Button>
      </CardContent>
    </Card>
  );
}
