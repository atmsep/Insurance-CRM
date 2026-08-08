import { requireAgencyUser } from "@/lib/dal";
import { signOut } from "@/lib/actions/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { BackButton } from "@/components/back-button";
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
      <aside className="hidden w-56 shrink-0 flex-col justify-between border-r bg-muted/20 p-4 sm:flex">
        <div>
          <p className="mb-6 px-2 text-lg font-semibold">CRM Ασφαλιστικού</p>
          <DashboardNav />
        </div>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <BackButton />
            <div className="text-sm">
              <p className="font-medium">{agencyUser.full_name}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[agencyUser.role] ?? agencyUser.role}
              </p>
            </div>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Αποσύνδεση
            </Button>
          </form>
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
