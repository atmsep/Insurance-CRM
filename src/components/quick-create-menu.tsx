"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const ITEMS = [
  { href: "/dashboard/clients/new", label: "Νέος πελάτης" },
  { href: "/dashboard/policies/new", label: "Νέο συμβόλαιο" },
  { href: "/dashboard/tasks", label: "Νέα εργασία" },
];

export function QuickCreateMenu() {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <Plus className="size-4" />
        <span className="hidden sm:inline">Γρήγορη δημιουργία</span>
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-md border bg-popover py-1 shadow-lg">
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
