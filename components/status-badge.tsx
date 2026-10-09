import { Badge, type Tone } from "@/components/ui";
import type { ProposalStatus } from "@/lib/proposales/schemas";

const TONE: Record<NonNullable<ProposalStatus>, Tone> = {
  draft: "neutral",
  active: "strong",
  accepted: "success",
  rejected: "failure",
  expired: "failure",
  withdrawn: "neutral",
  replaced: "neutral",
  template: "neutral",
};

export function StatusBadge({ status }: { status: ProposalStatus }) {
  if (!status) return null;
  return <Badge tone={TONE[status]} className="capitalize">{status}</Badge>;
}
