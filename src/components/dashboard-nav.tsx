"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string };
type NavItem = NavLink | { group: string; links: NavLink[] };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Επισκόπηση" },
  {
    group: "Παραγωγή",
    links: [
      { href: "/dashboard/policies", label: "Συμβόλαια" },
      { href: "/dashboard/clients", label: "Πελάτες" },
    ],
  },
  {
    group: "Τυπώνω - Πληρώνω",
    links: [
      { href: "/dashboard/installments", label: "Δόσεις" },
      { href: "/dashboard/commissions", label: "Προμήθειες" },
      { href: "/dashboard/cash-register", label: "Ταμείο" },
    ],
  },
  { href: "/dashboard/claims", label: "Ζημιές" },
  { href: "/dashboard/tickets", label: "Αιτήματα" },
  { href: "/dashboard/tasks", label: "Υπενθυμίσεις" },
  { href: "/dashboard/reports", label: "Αναφορές" },
  { href: "/dashboard/settings", label: "Ρυθμίσεις" },
];

export function DashboardNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isLinkActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  function renderLink(link: NavLink) {
    const isActive = isLinkActive(link.href);
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
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
  }

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) =>
        "group" in item ? (
          <div key={item.group} className="mt-3 flex flex-col gap-1 first:mt-0">
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground/70">
              {item.group}
            </p>
            {item.links.map(renderLink)}
          </div>
        ) : (
          renderLink(item)
        ),
      )}
    </nav>
  );
}
