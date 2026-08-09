import { CommissionsSection, type Commission } from "../../../commissions/commissions-section";

export function CommissionsTab({
  policyId,
  carrierId,
  insuranceLineId,
  brokerOfficeId,
  commissions,
  isAdmin,
  premiumNet,
  payees,
}: {
  policyId: string;
  carrierId: string;
  insuranceLineId: string;
  brokerOfficeId: string | null;
  commissions: Commission[];
  isAdmin: boolean;
  premiumNet?: number | null;
  payees: { id: string; name: string }[];
}) {
  return (
    <CommissionsSection
      policyId={policyId}
      carrierId={carrierId}
      insuranceLineId={insuranceLineId}
      brokerOfficeId={brokerOfficeId}
      commissions={commissions}
      isAdmin={isAdmin}
      premiumNet={premiumNet}
      payees={payees}
    />
  );
}
