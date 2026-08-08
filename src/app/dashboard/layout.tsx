import { Suspense } from "react";
import { requireAgencyUser } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { BackButton } from "@/components/back-button";
import { MobileNav } from "@/components/mobile-nav";
import { ToastListener } from "@/components/toast-listener";
import { GlobalSearch } from "@/components/global-search";
import { QuickCreateMenu } from "@/components/quick-create-menu";
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
      <KeyboardShortcuts />
      <aside className="no-print hidden w-56 shrink-0 flex-col justify-between border-r bg-muted/20 p-4 sm:flex">
        <div>
          <p className="mb-6 px-2 text-lg font-semibold">CRM Ασφαλιστικού</p>
          <DashboardNav />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="no-print flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <MobileNav />
            <BackButton />
            <div className="text-sm">
              <p className="font-medium">{agencyUser.full_name}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[agencyUser.role] ?? agencyUser.role}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
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
