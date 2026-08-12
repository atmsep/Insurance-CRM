"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toggleAgencyUserActive } from "../../../actions";

export function AgentStatusToggle({
  userId,
  isActive,
  isSelf,
}: {
  userId: string;
  isActive: boolean;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Badge variant={isActive ? "default" : "outline"}>{isActive ? "Ενεργός" : "Ανενεργός"}</Badge>
      {!isSelf && (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => startTransition(() => toggleAgencyUserActive(userId, !isActive))}
        >
          {isActive ? "Απενεργοποίηση" : "Ενεργοποίηση"}
        </Button>
      )}
    </div>
  );
}
