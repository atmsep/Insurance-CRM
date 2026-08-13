"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard-nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="sm:hidden"
        aria-label="Μενού"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 flex w-64 flex-col bg-sidebar p-4 text-sidebar-foreground shadow-lg">
            <div className="mb-6 flex items-center justify-between">
              <p className="text-lg font-semibold">CRM Ασφαλιστικού</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Κλείσιμο"
                className="text-sidebar-foreground hover:bg-sidebar-foreground/10 hover:text-sidebar-foreground"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
            <DashboardNav onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
