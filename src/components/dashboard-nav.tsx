"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Επισκόπηση" },
  { href: "/dashboard/clients", label: "Πελάτες" },
  { href: "/dashboard/policies", label: "Συμβόλαια" },
  { href: "/dashboard/claims", label: "Ζημιές" },
  { href: "/dashboard/commissions", label: "Προμήθειες" },
  { href: "/dashboard/tasks", label: "Υπενθυμίσεις" },
  { href: "/dashboard/reports", label: "Αναφορές" },
  { href: "/dashboard/settings", label: "Ρυθμίσεις" },
];

export function DashboardNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard" ? pathname === link.href : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
