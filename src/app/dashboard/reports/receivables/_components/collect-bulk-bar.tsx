"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBulkSelection } from "@/components/bulk-selection";
import { BulkActionsShell } from "@/components/bulk-actions-shell";
import { bulkCollectInstallments } from "../actions";

export function CollectBulkBar({
  paymentMethods,
  today,
}: {
  paymentMethods: { id: string; name: string }[];
  today: string;
}) {
  const { clear } = useBulkSelection();
  const [pending, startTransition] = useTransition();
  // Προεπιλογή η σημερινή ημερομηνία, αλλά αλλάζει: μαζική τακτοποίηση
  // παλιών οφειλών με σημερινή ημερομηνία φουσκώνει το Ταμείο της ημέρας.
  const [paidDate, setPaidDate] = useState(today);
  const [methodId, setMethodId] = useState("");
  const [receipt, setReceipt] = useState("");

  return (
    <BulkActionsShell>
      {(ids) => (
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk-paid-date" className="text-xs">Ημερομηνία</Label>
            <Input
              id="bulk-paid-date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              className="h-8 w-36 text-xs"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk-method" className="text-xs">Τρόπος</Label>
            <select
              id="bulk-method"
              value={methodId}
              onChange={(e) => setMethodId(e.target.value)}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              <option value="">—</option>
              {paymentMethods.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="bulk-receipt" className="text-xs">Απόδειξη</Label>
            <Input
              id="bulk-receipt"
              value={receipt}
              onChange={(e) => setReceipt(e.target.value)}
              placeholder="κενό = αυτόματη"
              className="h-8 w-36 text-xs"
            />
          </div>
          <Button
            size="sm"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Είσπραξη ${ids.length} δόσεων με ημερομηνία ${paidDate};`)) return;
              startTransition(async () => {
                const r = await bulkCollectInstallments(ids, {
                  paidDate,
                  paymentMethodId: methodId || undefined,
                  receiptNumber: receipt || undefined,
                });
                if ("error" in r) {
                  toast.error(r.error);
                  return;
                }
                const parts = [`${r.collected} εισπράχθηκαν (${r.amount.toFixed(2)} €)`];
                if (r.closed) parts.push(`${r.closed} έκλεισαν με μηδενικό υπόλοιπο`);
                if (r.skipped) parts.push(`${r.skipped} παραλείφθηκαν`);
                toast.success(parts.join(" · "));
                clear();
              });
            }}
          >
            {pending ? "Καταχώρηση..." : "Είσπραξη επιλεγμένων"}
          </Button>
        </div>
      )}
    </BulkActionsShell>
  );
}
