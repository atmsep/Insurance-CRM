"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { keys: "Ctrl/⌘ + K ή /", label: "Αναζήτηση" },
  { keys: "c", label: "Νέος πελάτης" },
  { keys: "p", label: "Νέο συμβόλαιο" },
  { keys: "t", label: "Υπενθυμίσεις" },
  { keys: "?", label: "Αυτή η βοήθεια" },
];

function isTypingTarget(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function KeyboardShortcuts() {
  const [helpOpen, setHelpOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === "c") {
        router.push("/dashboard/clients/new");
      } else if (e.key === "p") {
        router.push("/dashboard/policies/new");
      } else if (e.key === "t") {
        router.push("/dashboard/tasks");
      } else if (e.key === "Escape") {
        setHelpOpen(false);
      }
    }
    document.addEventListener("keydown", onKeydown);
    return () => document.removeEventListener("keydown", onKeydown);
  }, [router]);

  if (!helpOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => setHelpOpen(false)} aria-hidden="true" />
      <div className="fixed inset-x-4 top-24 z-50 mx-auto max-w-sm rounded-lg border bg-popover p-4 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-semibold">Συντομεύσεις πληκτρολογίου</p>
          <Button type="button" variant="ghost" size="sm" aria-label="Κλείσιμο" onClick={() => setHelpOpen(false)}>
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{s.label}</span>
              <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
