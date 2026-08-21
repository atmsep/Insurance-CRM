import { RemittancesView } from "../_components/remittances-view";

export default async function CommissionRemittancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <RemittancesView kind="commission" searchParams={searchParams} />;
}
