"use client";

import { useEffect } from "react";

// Used on dedicated "print view" pages reached by clicking Εκτύπωση in a
// new tab — the print dialog is the whole point of landing here, so it
// opens immediately rather than waiting for the user to find Ctrl+P.
export function AutoPrint() {
  useEffect(() => {
    window.print();
  }, []);
  return null;
}
