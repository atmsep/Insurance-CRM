"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DashboardNav } from "@/components/dashboard-nav";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "no-print hidden shrink-0 flex-col justify-between border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground sm:flex",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div>
        <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && <p className="px-2 text-lg font-semibold">CRM Ασφαλιστικού</p>}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Ανάπτυξη μενού" : "Σύμπτυξη μενού"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>
        <DashboardNav collapsed={collapsed} />
      </div>
    </aside>
  );
}
