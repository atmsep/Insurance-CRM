"use client";

import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { toggleClientActive } from "../../actions";
import { CLIENT_TYPE_LABELS } from "../../client-labels";

export function ClientHeader({
  clientId,
  clientCode,
  name,
  clientType,
  afm,
  isActive,
}: {
  clientId: string;
  clientCode: number;
  name: string;
  clientType: string;
  afm: string | null;
  isActive: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-semibold">{name}</h1>
        <p className="text-sm text-muted-foreground">
          #{clientCode} · {CLIENT_TYPE_LABELS[clientType]} · ΑΦΜ {afm ?? "—"}{" "}
          <Badge variant={isActive ? "success" : "outline"} className="ml-2">
            {isActive ? "Ενεργός" : "Ανενεργός"}
          </Badge>
        </p>
      </div>
      <div className="flex items-center gap-2">
        <PrintButton />
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await toggleClientActive(clientId, !isActive);
              if (result?.error) toast.error(result.error);
            })
          }
        >
          {isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
        </Button>
        <Button
          nativeButton={false}
          render={<Link href={`/dashboard/policies/new?client_id=${clientId}`}>Νέο συμβόλαιο</Link>}
        />
      </div>
    </div>
  );
}
