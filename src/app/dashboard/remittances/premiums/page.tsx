import { RemittancesView } from "../_components/remittances-view";

export default async function PremiumRemittancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <RemittancesView kind="premium" searchParams={searchParams} />;
}
