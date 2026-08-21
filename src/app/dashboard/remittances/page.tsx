import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAgencyUser } from "@/lib/dal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Οι αποδόσεις ασφαλίστρων και προμηθειών ήταν δύο καρτέλες στην ίδια
// σελίδα, που φόρτωνε ΚΑΙ ΤΙΣ ΔΥΟ λίστες σε κάθε άνοιγμα. Χωρίστηκαν σε δύο
// σελίδες με αφετηρία εδώ, όπως οι Αναφορές.
export default async function RemittancesHubPage() {
  const agencyUser = await requireAgencyUser();
  if (agencyUser.role !== "owner" && agencyUser.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Αποδόσεις</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Link href="/dashboard/remittances/premiums" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Αποδόσεις Ασφαλίστρων</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Τι ασφάλιστρα οφείλονται στις εταιρείες και τι έχει ήδη αποδοθεί, με φίλτρα ανά συνεργάτη,
                εταιρεία, κλάδο και διάστημα. Δείχνει και τι από αυτά δεν έχει καν εισπραχθεί.
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/dashboard/remittances/commissions" className="block">
          <Card className="h-full transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="text-base">Αποδόσεις Προμηθειών</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Τι προμήθειες οφείλονται στους συνεργάτες και τι έχει ήδη αποδοθεί, με τα ίδια φίλτρα.
                Εμφανίζονται μόνο κινήσεις που φέρουν πραγματική εξερχόμενη προμήθεια.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
