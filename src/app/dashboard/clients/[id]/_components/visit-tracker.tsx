"use client";

import { useEffect } from "react";
import { recordClientVisit } from "../../actions";

export function VisitTracker({ clientId }: { clientId: string }) {
  useEffect(() => {
    recordClientVisit(clientId);
  }, [clientId]);

  return null;
}
