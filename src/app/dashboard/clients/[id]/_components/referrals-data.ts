export type Reward = {
  calc_type: "percent" | "fixed";
  rate_percent: number | null;
  fixed_amount: number | null;
  reward_amount: number;
  status: string;
  notes: string | null;
  source: "auto" | "manual";
};

// One row per reward-eligible event. A policy that already has real
// policy_movements (new business/renewal — see createMovementForPolicy)
// shows one row per movement, each earning its own reward; a policy that
// pre-dates the movements feature and hasn't been renewed since falls back
// to the one flat row it always had, keyed by policy_id.
export type ReferredPolicy = {
  id: string; // unique per row: the movement id when there is one, else the policy id
  policyId: string;
  movementId: string | null;
  policy_number: string;
  status: string;
  premium_net: number | null;
  renewal_number: number;
  periodLabel: string | null;
  referral_rewards: Reward | null;
};

export type ReferredClient = {
  id: string;
  client_code: number;
  client_type: string;
  is_active: boolean;
  created_at: string;
  client_individuals: { first_name: string; last_name: string } | null;
  client_legal_entities: { company_name: string } | null;
  policies: ReferredPolicy[];
};

export type RawReferredPolicy = {
  id: string;
  policy_number: string;
  status: string;
  premium_net: number | null;
  renewal_number: number;
  referral_rewards: Reward[] | null;
  policy_movements:
    | {
        id: string;
        kind: string;
        start_date: string;
        premium_net: number | null;
        referral_rewards: Reward[] | null;
      }[]
    | null;
};

// PostgREST embeds referral_rewards as an array everywhere now (migration
// 0082 dropped the old unique(policy_id), so it can no longer infer a
// to-one relationship) — even though at most one row is possible per key
// in practice. Flattening here is the one place that assumption is made
// explicit, instead of every call site re-guessing the shape.
export function flattenReferredPolicies(policies: RawReferredPolicy[]): ReferredPolicy[] {
  return policies.flatMap((p) => {
    const movements = (p.policy_movements ?? [])
      .filter((m) => m.kind === "policy" || m.kind === "renewal")
      .slice()
      .sort((a, b) => a.start_date.localeCompare(b.start_date));

    if (movements.length === 0) {
      const row: ReferredPolicy = {
        id: p.id,
        policyId: p.id,
        movementId: null,
        policy_number: p.policy_number,
        status: p.status,
        premium_net: p.premium_net,
        renewal_number: p.renewal_number,
        periodLabel: null,
        referral_rewards: p.referral_rewards?.[0] ?? null,
      };
      return [row];
    }

    return movements.map(
      (m, index): ReferredPolicy => ({
        id: m.id,
        policyId: p.id,
        movementId: m.id,
        policy_number: p.policy_number,
        status: p.status,
        premium_net: m.premium_net,
        renewal_number: p.renewal_number,
        periodLabel: m.kind === "renewal" ? `Ανανέωση #${index + 1}` : null,
        referral_rewards: m.referral_rewards?.[0] ?? null,
      }),
    );
  });
}
