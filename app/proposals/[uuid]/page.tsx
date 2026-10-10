import Link from "next/link";
import { Suspense } from "react";
import { CatalogSection } from "@/components/catalog-section";
import { EventSummary } from "@/components/event-summary";
import { RecommendationsPanel } from "@/components/recommendations-panel";
import { StatusBadge } from "@/components/status-badge";
import {
  Alert,
  buttonStyles,
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
import { cn } from "@/lib/cn";
import { formatMoney, formatPercent } from "@/lib/format";
import { describeError, isNotFound } from "@/lib/proposales/errors";
import { proposalEditorUrl } from "@/lib/proposales/links";
import { sumLineItems, type LineItem, type ProposalDetail } from "@/lib/proposals/model";
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
        aside={
          <>
            <StatusBadge status={proposal.status} />
            <a
              href={proposalEditorUrl(proposal.uuid)}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonStyles({ variant: "soft", size: "sm" }), "sm:ml-auto")}
            >
              Open in Proposales
              <svg aria-hidden="true" viewBox="0 0 16 16" className="-mr-1 size-3.5">
                <path d="M6 4h6v6M12 4l-7.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </>
        }
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
      <RecommendationsPanel
        proposalUuid={proposal.uuid}
        isDraft={proposal.status === "draft"}
        currency={proposal.currency}
        vatIncluded={proposal.vatIncluded}
      />
      <Suspense fallback={<Skeleton className="h-[5.25rem]" />}>
        <CatalogSection
          companyId={proposal.companyId}
          language={proposal.language}
          lineItems={proposal.lineItems}
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
  const basis = `Unit prices and amounts ${proposal.vatIncluded ? "include" : "exclude"} VAT.`;
  const included = proposal.lineItems.filter((item) => !item.optional);
  const optional = proposal.lineItems.filter((item) => item.optional);
  const lineItems = (
    <section>
      <SectionTitle>Line items</SectionTitle>
      {included.length === 0 ? (
        <EmptyState>No items are included yet; the customer can only pick optional extras.</EmptyState>
      ) : (
        <ItemsTable
          items={included}
          vatIncluded={proposal.vatIncluded}
          note={basis}
          totals={{ exclVat: proposal.totalExclVat, inclVat: proposal.totalInclVat }}
          currency={proposal.currency}
        />
      )}
    </section>
  );
  if (optional.length === 0) return lineItems;

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-3">
      {lineItems}
      <section>
        <SectionTitle>Optional extras</SectionTitle>
        <ItemsTable
          items={optional}
          vatIncluded={proposal.vatIncluded}
          note="Total if the customer picks them all."
          totals={sumLineItems(optional)}
          currency={proposal.currency}
        />
      </section>
    </div>
  );
}

function ItemsTable({
  items,
  vatIncluded,
  note,
  totals,
  currency,
}: {
  items: LineItem[];
  vatIncluded: boolean;
  note: string;
  totals: { exclVat: number | null; inclVat: number | null };
  currency: string | null;
}) {
  return (
    // Fixed layout, so both tables share the same column widths whatever their content; long names wrap.
    // On phones the unit price moves under the item name, so Item, Qty and Amount fit without scrolling.
    <Table className="table-fixed" footer={<Totals note={note} rows={totalsRows({ ...totals, currency })} />}>
      <colgroup>
        <col />
        <col className="w-16 sm:w-20" />
        <col className="hidden w-28 sm:table-column" />
        <col className="w-32" />
      </colgroup>
      <TableHead>
        <tr>
          <TableHeaderCell>Item</TableHeaderCell>
          <TableHeaderCell align="right" className="whitespace-nowrap">Qty</TableHeaderCell>
          <TableHeaderCell align="right" className="hidden whitespace-nowrap sm:table-cell">Unit price</TableHeaderCell>
          <TableHeaderCell align="right" className="whitespace-nowrap">Amount</TableHeaderCell>
        </tr>
      </TableHead>
      <tbody>
        {items.map((item) => {
          const unitPrice = formatMoney(vatIncluded ? item.unitPriceInclVat : item.unitPriceExclVat, item.currency);
          return (
            <tr key={item.id} className="align-top">
              <TableCell>
                <span className="font-medium text-heading">{item.title}</span>
                {item.kind === "package" && <span className="ml-2 text-xs text-muted">(package)</span>}
                <span className="mt-0.5 block text-xs text-muted">
                  <span className="sm:hidden">
                    {unitPrice}
                    {item.vatRate !== null && " · "}
                  </span>
                  {item.vatRate !== null && `${formatPercent(item.vatRate)} VAT`}
                </span>
              </TableCell>
              <TableCell numeric>{item.quantity ?? "–"}</TableCell>
              <TableCell numeric className="hidden sm:table-cell">{unitPrice}</TableCell>
              <TableCell numeric>{formatMoney(vatIncluded ? item.totalInclVat : item.totalExclVat, item.currency)}</TableCell>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Subtotal / VAT / Total from the API totals. VAT is derived only when both totals exist. */
function totalsRows({ exclVat, inclVat, currency }: { exclVat: number | null; inclVat: number | null; currency: string | null }): TotalsRow[] {
  if (exclVat === null || inclVat === null) {
    return [{ label: "Total", value: formatMoney(inclVat ?? exclVat, currency), emphasis: true }];
  }
  return [
    { label: "Subtotal (excl. VAT)", value: formatMoney(exclVat, currency) },
    { label: "VAT", value: formatMoney(inclVat - exclVat, currency) },
    { label: "Total (incl. VAT)", value: formatMoney(inclVat, currency), emphasis: true },
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
