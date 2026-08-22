"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openReceiptWindow } from "./open-receipt";

// Επανεκτύπωση από τα «Αποδοθέντα». Παραμένει <a> με πραγματικό href (ώστε
// να δουλεύει «άνοιγμα σε νέα καρτέλα» με το μεσαίο κλικ και να φαίνεται ο
// προορισμός), αλλά το απλό κλικ ανοίγει ξεχωριστό παράθυρο αντί για
// καρτέλα — ίδια συμπεριφορά με την απόδοση.
export function ReceiptPrintLink({ href }: { href: string }) {
  return (
    <Button
      size="sm"
      variant="ghost"
      nativeButton={false}
      render={
        <a
          href={href}
          target="_blank"
          title="Απόδειξη"
          onClick={(e) => {
            // Ctrl/Cmd/μεσαίο κλικ: άσε τον φυλλομετρητή να κάνει τη δουλειά του.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            openReceiptWindow(href);
          }}
        >
          <Printer className="size-4" />
        </a>
      }
    />
  );
}
