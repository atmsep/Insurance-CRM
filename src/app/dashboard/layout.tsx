import { Suspense } from "react";
import { requireAgencyUser } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";
import { Sidebar } from "@/components/sidebar";
import { BackButton } from "@/components/back-button";
import { MobileNav } from "@/components/mobile-nav";
import { ToastListener } from "@/components/toast-listener";
import { IncomingCallListener } from "@/components/incoming-call-listener";
import { GlobalSearch } from "@/components/global-search";
import { QuickCreateMenu } from "@/components/quick-create-menu";
import { NotificationBell } from "@/components/notification-bell";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  owner: "Ιδιοκτήτης",
  admin: "Διαχειριστής",
  agent: "Συνεργάτης",
  viewer: "Παρατηρητής",
};

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const agencyUser = await requireAgencyUser();

  return (
    <div className="flex min-h-screen flex-1">
      <Suspense fallback={null}>
        <ToastListener />
      </Suspense>
      <IncomingCallListener enabled={agencyUser.role === "owner" || agencyUser.role === "admin"} />
      <KeyboardShortcuts />
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <MobileNav />
            <BackButton />
            <div className="hidden text-sm sm:block">
              <p className="font-medium">{agencyUser.full_name}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[agencyUser.role] ?? agencyUser.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <NotificationBell />
            <QuickCreateMenu />
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Αποσύνδεση
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
