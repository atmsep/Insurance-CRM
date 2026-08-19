"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminSetUserPassword, type ActionState } from "../../../actions";

export function SetPasswordCard({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    adminSetUserPassword.bind(null, userId),
    undefined,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ορισμός νέου κωδικού</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-user-password">Νέος κωδικός</Label>
            <Input
              id="new-user-password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="confirm-user-password">Επιβεβαίωση</Label>
            <Input
              id="confirm-user-password"
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
          {state && "success" in state && <p className="text-sm text-emerald-600">{state.success}</p>}
          <Button type="submit" variant="secondary" size="sm" disabled={pending} className="w-fit">
            {pending ? "Αποθήκευση..." : "Ορισμός κωδικού"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
