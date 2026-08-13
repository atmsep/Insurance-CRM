"use client";

import { useEffect } from "react";
import { recordPolicyVisit } from "../../actions";

export function VisitTracker({ policyId }: { policyId: string }) {
  useEffect(() => {
    recordPolicyVisit(policyId);
  }, [policyId]);

  return null;
}
