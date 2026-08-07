"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword, type ActionState } from "./actions";

export function ProfileTab({ fullName, email }: { fullName: string; email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updatePassword,
    undefined,
  );

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm">
        <p>
          <span className="text-muted-foreground">Όνομα: </span>
          {fullName}
        </p>
        <p>
          <span className="text-muted-foreground">Email: </span>
          {email}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_password">Νέος κωδικός</Label>
          <Input id="new_password" name="new_password" type="password" required minLength={8} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm_password">Επιβεβαίωση κωδικού</Label>
          <Input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            minLength={8}
          />
        </div>
        {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
        {state && "success" in state && (
          <p className="text-sm text-emerald-600 dark:text-emerald-500">{state.success}</p>
        )}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Αποθήκευση..." : "Αλλαγή κωδικού"}
        </Button>
      </form>
    </div>
  );
}
