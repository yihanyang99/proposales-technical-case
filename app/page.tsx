import Link from "next/link";
import { Suspense } from "react";
import { EventSummary } from "@/components/event-summary";
import { StatusBadge } from "@/components/status-badge";
import { Alert, cardStyles, Chip, ChipGroup, EmptyState, FieldLabel, LocalDate, Page, PageHeader, SearchInput, Skeleton } from "@/components/ui";
import { cn } from "@/lib/cn";
import { formatStatus } from "@/lib/format";
import { describeError } from "@/lib/proposales/errors";
import {
  countByStatus,
  filterProposals,
  parseProposalFilters,
  proposalListHref,
  type ProposalFilters,
  type ProposalSummary,
} from "@/lib/proposals/model";
import { listProposalSummaries } from "@/lib/proposals/service";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <Page>
      <PageHeader
        className="mb-6"
        title="Proposals"
        description="Pick a proposal to let AI find revenue opportunities in the hotel catalog."
      />
      <Suspense fallback={<ProposalListSkeleton />}>
        <ProposalList searchParams={searchParams} />
      </Suspense>
    </Page>
  );
}

async function ProposalList({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const filters = parseProposalFilters(await searchParams);

  let proposals: ProposalSummary[];
  let atLimit: boolean;
  try {
    ({ proposals, atLimit } = await listProposalSummaries());
  } catch (error) {
    return <Alert title="Could not load proposals">{describeError(error)}</Alert>;
  }

  const visible = filterProposals(proposals, filters);
  return (
    <section>
      <div className="mb-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <StatusChips proposals={proposals} filters={filters} />
        <SearchForm filters={filters} />
      </div>
      {visible.length === 0 ? (
        <EmptyState>
          {proposals.length > 0 ? (
            <>No proposals match your filters. <Link href="/" className="font-medium text-heading underline underline-offset-4">Clear filters</Link></>
          ) : (
            <>No proposals found in Proposales yet. Create one in Proposales, or seed test data with <code>npm run seed</code>.</>
          )}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {visible.map((proposal) => (
            <li key={proposal.uuid}>
              <Link
                href={`/proposals/${proposal.uuid}`}
                className={cn(cardStyles({ interactive: true }), "group flex items-center gap-4 px-5 py-4")}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-heading">{proposal.title}</p>
                  <p className="mt-1 truncate text-sm text-muted">
                    <EventSummary event={proposal.event} />
                  </p>
                </div>
                <StatusBadge status={proposal.status} />
                <LocalDate
                  epochMs={proposal.updatedAt}
                  title="Last updated"
                  className="hidden w-24 text-right text-sm text-muted sm:inline"
                />
                <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5">
                  <path d="m6 4 4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {atLimit && (
        <p className="mt-4 text-sm text-muted">
          Showing the {proposals.length} most recently updated proposals. Older proposals aren&apos;t available here.
        </p>
      )}
    </section>
  );
}

function SearchForm({ filters }: { filters: ProposalFilters }) {
  return (
    // Submits on Enter (implicit submission), so no separate button is needed.
    <form role="search" className="sm:w-72">
      <FieldLabel htmlFor="q">Search proposals by title</FieldLabel>
      <SearchInput id="q" name="q" defaultValue={filters.query} placeholder="Search by title" />
      {/* Keep the selected status when searching. */}
      {filters.status && <input type="hidden" name="status" value={filters.status} />}
    </form>
  );
}

function StatusChips({ proposals, filters }: { proposals: ProposalSummary[]; filters: ProposalFilters }) {
  const counts = countByStatus(proposals, filters.query);
  const total = counts.reduce((sum, { count }) => sum + count, 0);
  // Keep a selected status visible (and deselectable) even when nothing matches it.
  if (filters.status && !counts.some(({ status }) => status === filters.status)) {
    counts.push({ status: filters.status, count: 0 });
  }
  return (
    <ChipGroup label="Filter by status">
      <Chip href={proposalListHref({ ...filters, status: null })} selected={!filters.status} count={total}>
        All
      </Chip>
      {counts.map(({ status, count }) => (
        <Chip key={status} href={proposalListHref({ ...filters, status })} selected={filters.status === status} count={count}>
          {formatStatus(status)}
        </Chip>
      ))}
    </ChipGroup>
  );
}

function ProposalListSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading proposals" className="space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-9 w-40 rounded-full" />
        <Skeleton className="hidden h-9 w-72 rounded-full sm:block" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[4.5rem]" />
        ))}
      </div>
    </div>
  );
}
