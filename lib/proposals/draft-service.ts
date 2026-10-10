import "server-only";
import { pickLocalized } from "@/lib/catalog/model";
import { getCatalog } from "@/lib/catalog/service";
import { createContent, getProposalForUpdate, listContent, updateProposalDraftBlocks } from "@/lib/proposales/client";
import { proposalBlockSchema, type ProposalForUpdate } from "@/lib/proposales/schemas";
import { buildDraftBlocks, planDraftChanges, type DraftChange, type DraftItem, type DraftPlanError } from "./draft-update";
import { toLineItem, type LineItem } from "./model";

async function load(proposalUuid: string, items: DraftItem[]) {
  const proposal = await getProposalForUpdate(proposalUuid);
  const lineItems = proposal.blocks
    .map((block) => proposalBlockSchema.safeParse(block))
    .flatMap((parsed) => (parsed.success ? [toLineItem(parsed.data)] : []))
    .filter((line): line is LineItem => line !== null);
  const catalog = await getCatalog(proposal.company_id, proposal.language);
  const plan = planDraftChanges(items, {
    status: proposal.status ?? "",
    currency: proposal.currency ?? null,
    catalog: catalog.products,
    lineItems,
  });
  return { proposal, plan };
}

/** Finds existing upgrade supplements in the content library by their title. */
async function findSupplements(proposal: ProposalForUpdate, changes: DraftChange[]): Promise<Map<string, number>> {
  const titles = new Set(changes.filter((change) => change.upgrade).map((change) => change.title));
  if (titles.size === 0) return new Map();
  const content = await listContent({ companyId: proposal.company_id });
  const found = new Map<string, number>();
  for (const item of content) {
    const title = pickLocalized(item.title, proposal.language);
    if (title && titles.has(title) && !item.deactivated_at && !found.has(title)) found.set(title, item.variation_id);
  }
  return found;
}

/**
 * Adds the confirmed opportunities to the draft as optional blocks. Works on a fresh copy of the
 * proposal and re-checks every item and price, so nothing from the browser is trusted. Creates a
 * missing upgrade supplement first.
 */
export async function applyDraftUpdate(proposalUuid: string, items: DraftItem[]): Promise<{ ok: true } | { ok: false; error: DraftPlanError }> {
  const { proposal, plan } = await load(proposalUuid, items);
  if ("error" in plan) return { ok: false, error: plan.error };

  const supplements = await findSupplements(proposal, plan.changes);
  const resolved: (DraftChange & { contentId: number })[] = [];
  for (const change of plan.changes) {
    if (change.contentId !== null) {
      resolved.push({ ...change, contentId: change.contentId });
      continue;
    }
    let contentId = supplements.get(change.title);
    if (contentId === undefined && change.upgrade) {
      contentId = await createContent({
        companyId: proposal.company_id,
        language: proposal.language,
        title: change.title,
        description: `Upgrade from ${change.upgrade.from.title} to ${change.upgrade.to.title}. Priced at the difference per unit.`,
      });
      supplements.set(change.title, contentId);
    }
    if (contentId === undefined) return { ok: false, error: "unknown_product" };
    resolved.push({ ...change, contentId });
  }

  const blocks = buildDraftBlocks(proposal.blocks, resolved, proposal.currency ?? "");
  await updateProposalDraftBlocks(proposal.uuid, proposal.company_id, blocks);
  return { ok: true };
}
