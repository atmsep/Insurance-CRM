"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function CancelPaymentForm({
  id,
  cancelAction,
}: {
  id: string;
  cancelAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Ακύρωση
      </Button>
    );
  }

  return (
    <form action={cancelAction} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor={`cancellation_reason_${id}`} className="text-xs">
          Αιτιολογία
        </Label>
        <Input
          id={`cancellation_reason_${id}`}
          name="cancellation_reason"
          required
          className="h-7 w-40 text-xs"
        />
      </div>
      <Button type="submit" size="sm" variant="destructive">
        Επιβεβαίωση
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Άκυρο
      </Button>
    </form>
  );
}
