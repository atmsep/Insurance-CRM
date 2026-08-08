"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PremiumFields({
  defaultGross,
  defaultNet,
  required,
}: {
  defaultGross?: number | string | null;
  defaultNet?: number | string | null;
  required?: boolean;
}) {
  const [gross, setGross] = useState(defaultGross != null ? String(defaultGross) : "");
  const [net, setNet] = useState(defaultNet != null ? String(defaultNet) : "");

  const grossNum = parseFloat(gross);
  const netNum = parseFloat(net);
  const hasBoth = !isNaN(grossNum) && !isNaN(netNum);
  const taxesFees = hasBoth ? grossNum - netNum : null;
  const percent = hasBoth && grossNum > 0 ? (taxesFees! / grossNum) * 100 : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor="premium_gross">Μικτό ασφάλιστρο (€)</Label>
        <Input
          id="premium_gross"
          name="premium_gross"
          type="number"
          step="0.01"
          required={required}
          value={gross}
          onChange={(e) => setGross(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="premium_net">Καθαρό ασφάλιστρο (€)</Label>
        <Input
          id="premium_net"
          name="premium_net"
          type="number"
          step="0.01"
          value={net}
          onChange={(e) => setNet(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="taxes_fees">Τέλη/Φόροι (€)</Label>
        <Input
          id="taxes_fees"
          name="taxes_fees"
          type="number"
          step="0.01"
          readOnly
          value={taxesFees != null ? taxesFees.toFixed(2) : ""}
          className="bg-muted"
        />
        <p className="text-xs text-muted-foreground">
          {percent != null ? `${percent.toFixed(1)}% του μικτού ασφαλίστρου` : "Μικτό − Καθαρό ασφάλιστρο"}
        </p>
      </div>
    </>
  );
}
