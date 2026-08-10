export type StatusBadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info";

export function policyStatusVariant(status: string): StatusBadgeVariant {
  if (status === "active") return "success";
  if (status === "pending_renewal") return "warning";
  return "outline";
}

export function claimStatusVariant(status: string): StatusBadgeVariant {
  if (status === "approved" || status === "paid") return "success";
  if (status === "rejected") return "destructive";
  if (status === "reported" || status === "under_review") return "info";
  return "outline";
}

export function commissionStatusVariant(status: string): StatusBadgeVariant {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  if (status === "invoiced") return "info";
  return "outline";
}

export function installmentStatusVariant(status: string): StatusBadgeVariant {
  if (status === "paid") return "success";
  if (status === "overdue") return "destructive";
  if (status === "pending" || status === "partially_paid") return "warning";
  return "outline";
}

export function taskPriorityVariant(priority: string): StatusBadgeVariant {
  if (priority === "urgent") return "destructive";
  if (priority === "high") return "warning";
  return "outline";
}

export function ticketStatusVariant(status: string): StatusBadgeVariant {
  if (status === "open") return "info";
  if (status === "in_progress") return "warning";
  if (status === "resolved") return "success";
  return "outline";
}

export function referralRewardStatusVariant(status: string): StatusBadgeVariant {
  if (status === "paid") return "success";
  if (status === "pending") return "warning";
  return "outline";
}
