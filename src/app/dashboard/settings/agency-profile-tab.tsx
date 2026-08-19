"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAgencyProfile, type ActionState } from "./actions";
import type { AgencyProfile } from "@/lib/agency-profile";

export function AgencyProfileTab({ profile }: { profile: AgencyProfile }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateAgencyProfile,
    undefined,
  );

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <p className="text-sm text-muted-foreground">
        Εμφανίζονται σε κάθε εκτύπωση καρτέλας πελάτη/συμβολαίου και κάτω από κάθε email που στέλνεται
        (χειροκίνητα ή αυτόματα).
      </p>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Επωνυμία</Label>
          <Input id="name" name="name" defaultValue={profile.name ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="address">Διεύθυνση</Label>
          <Input id="address" name="address" defaultValue={profile.address ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Τηλέφωνο</Label>
          <Input id="phone" name="phone" defaultValue={profile.phone ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={profile.email ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="logo">Λογότυπο</Label>
          {profile.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="Τρέχον λογότυπο" className="h-12 w-fit object-contain" />
          )}
          <Input id="logo" name="logo" type="file" accept="image/*" />
        </div>

        {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
        {state && "success" in state && <p className="text-sm text-success">{state.success}</p>}

        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Αποθήκευση..." : "Αποθήκευση"}
        </Button>
      </form>
    </div>
  );
}
