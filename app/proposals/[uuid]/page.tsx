import Link from "next/link";
import { Suspense } from "react";
import { CatalogSection } from "@/components/catalog-section";
import { EventSummary } from "@/components/event-summary";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  EmptyState,
  Page,
  PageHeader,
  SectionTitle,
  Skeleton,
  Table,
  TableCell,
  TableHead,
  TableHeaderCell,
  Totals,
  type TotalsRow,
} from "@/components/ui";
import { formatMoney, formatPercent } from "@/lib/format";
import { describeError, isNotFound } from "@/lib/proposales/errors";
import type { ProposalDetail } from "@/lib/proposals/model";
import { getProposalDetail } from "@/lib/proposals/service";

export default function ProposalPage({ params }: PageProps<"/proposals/[uuid]">) {
  return (
    <Page>
      <Link href="/" className="text-sm text-muted transition-colors hover:text-heading">
        ← All proposals
      </Link>
      <Suspense fallback={<ProposalSkeleton />}>
        <ProposalView params={params} />
      </Suspense>
    </Page>
  );
}

async function ProposalView({ params }: { params: PageProps<"/proposals/[uuid]">["params"] }) {
  const { uuid } = await params;

  let proposal: ProposalDetail;
  try {
    proposal = await getProposalDetail(uuid);
  } catch (error) {
    // Rendered inline: the response is already streaming, so a 404 status is no longer possible.
    return isNotFound(error) ? (
      <Alert className="mt-6" title="Proposal not found">
        This proposal does not exist, or Revenue Copilot does not have access to it.
      </Alert>
    ) : (
      <Alert className="mt-6" title="Could not load this proposal">{describeError(error)}</Alert>
    );
  }

  return (
    <article className="mt-6 space-y-10">
      <PageHeader
        title={proposal.title}
        aside={<StatusBadge status={proposal.status} />}
        description={
          <>
            <p><EventSummary event={proposal.event} /></p>
            {proposal.description && (
              <p className="mt-2 max-w-2xl whitespace-pre-line text-sm text-body">{proposal.description}</p>
            )}
          </>
        }
      />
      <LineItemsTable proposal={proposal} />
      <RecommendationsPanel proposalUuid={proposal.uuid} />
      <Suspense fallback={<Skeleton className="h-72" />}>
        <CatalogSection
          companyId={proposal.companyId}
          language={proposal.language}
          inProposal={new Set(proposal.lineItems.map((item) => item.variationId).filter((id) => id !== null))}
        />
      </Suspense>
    </article>
  );
}

function LineItemsTable({ proposal }: { proposal: ProposalDetail }) {
  if (proposal.lineItems.length === 0) {
    return <EmptyState>This proposal has no product line items yet.</EmptyState>;
  }

  // Line prices follow the proposal's own VAT basis; the summary always breaks VAT out.
  const inclVat = proposal.vatIncluded;
  return (
    <section>
      <SectionTitle>Line items</SectionTitle>
      <Table
        footer={
          <Totals
            note={`Unit prices and amounts ${inclVat ? "include" : "exclude"} VAT.`}
            rows={totalsRows(proposal)}
          />
        }
      >
        <TableHead>
          <tr>
            <TableHeaderCell>Item</TableHeaderCell>
            <TableHeaderCell align="right">Qty</TableHeaderCell>
            <TableHeaderCell align="right">Unit price</TableHeaderCell>
            <TableHeaderCell align="right">VAT</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
          </tr>
        </TableHead>
        <tbody>
          {proposal.lineItems.map((item) => (
            <tr key={item.id}>
              <TableCell className="font-medium text-heading">
                {item.title}
                {item.kind === "package" && <span className="ml-2 text-xs font-normal text-muted">(package)</span>}
                {item.optional && <span className="ml-2 text-xs font-normal text-muted">(optional)</span>}
              </TableCell>
              <TableCell numeric>{item.quantity ?? "–"}</TableCell>
              <TableCell numeric>
                {formatMoney(inclVat ? item.unitPriceInclVat : item.unitPriceExclVat, item.currency)}
              </TableCell>
              <TableCell numeric>{formatPercent(item.vatRate)}</TableCell>
              <TableCell numeric>{formatMoney(inclVat ? item.totalInclVat : item.totalExclVat, item.currency)}</TableCell>
            </tr>
          ))}
        </tbody>
      </Table>
    </section>
  );
}

/** Subtotal / VAT / Total from the API totals. VAT is derived only when both totals exist. */
function totalsRows({ totalExclVat, totalInclVat, currency }: ProposalDetail): TotalsRow[] {
  if (totalExclVat === null || totalInclVat === null) {
    return [{ label: "Total", value: formatMoney(totalInclVat ?? totalExclVat, currency), emphasis: true }];
  }
  return [
    { label: "Subtotal (excl. VAT)", value: formatMoney(totalExclVat, currency) },
    { label: "VAT", value: formatMoney(totalInclVat - totalExclVat, currency) },
    { label: "Total (incl. VAT)", value: formatMoney(totalInclVat, currency), emphasis: true },
  ];
}

function ProposalSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading proposal" className="mt-6 space-y-4">
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-56" />
    </div>
  );
}
