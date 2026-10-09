import "server-only";
import { getProposal, SEARCH_LIMIT_MAX, searchProposals } from "@/lib/proposales/client";
import { toProposalDetail, toProposalSummary, type ProposalDetail, type ProposalSummary } from "./model";

// Server-side entry points for the UI: fetch from Proposales and normalize.

/**
 * Most recently updated proposals. `atLimit` is true when the API returned its maximum, which
 * means older proposals may exist that the search API cannot return (it has no pagination).
 */
export async function listProposalSummaries(): Promise<{ proposals: ProposalSummary[]; atLimit: boolean }> {
  const results = await searchProposals({});
  return { proposals: results.map(toProposalSummary), atLimit: results.length >= SEARCH_LIMIT_MAX };
}

export async function getProposalDetail(uuid: string): Promise<ProposalDetail> {
  return toProposalDetail(await getProposal(uuid));
}
