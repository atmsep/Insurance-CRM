"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  ShieldAlert,
  MessageSquare,
  BellRing,
  Phone,
  BarChart3,
  Settings,
  Wallet,
  HandCoins,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavItem = NavLink | { group: string; links: NavLink[] };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Επισκόπηση", icon: LayoutDashboard },
  {
    group: "Παραγωγή",
    links: [
      { href: "/dashboard/policies", label: "Συμβόλαια", icon: FileText },
      { href: "/dashboard/clients", label: "Πελάτες", icon: Users },
    ],
  },
  { href: "/dashboard/cash-register", label: "Ταμείο", icon: Wallet },
  { href: "/dashboard/uncollected", label: "Ανείσπρακτα", icon: ReceiptText },
  {
    group: "Εξυπηρέτηση",
    links: [
      { href: "/dashboard/claims", label: "Ζημιές", icon: ShieldAlert },
      { href: "/dashboard/tickets", label: "Αιτήματα", icon: MessageSquare },
      { href: "/dashboard/tasks", label: "Υπενθυμίσεις", icon: BellRing },
      { href: "/dashboard/calls", label: "Κλήσεις", icon: Phone },
    ],
  },
  { href: "/dashboard/reports", label: "Αναφορές", icon: BarChart3 },
  { href: "/dashboard/remittances", label: "Αποδόσεις", icon: HandCoins },
  { href: "/dashboard/settings", label: "Ρυθμίσεις", icon: Settings },
];

export function DashboardNav({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  function isLinkActive(href: string) {
    return href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  }

  function renderLink(link: NavLink) {
    const isActive = isLinkActive(link.href);
    const Icon = link.icon;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onNavigate}
        title={collapsed ? link.label : undefined}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
            : "text-sidebar-foreground/75 hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="size-4 shrink-0" />
        {!collapsed && <span>{link.label}</span>}
      </Link>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) =>
        "group" in item ? (
          <div key={item.group} className="mt-3 flex flex-col gap-1 first:mt-0">
            {!collapsed && (
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/50">
                {item.group}
              </p>
            )}
            {item.links.map(renderLink)}
          </div>
        ) : (
          renderLink(item)
        ),
      )}
    </nav>
  );
}
