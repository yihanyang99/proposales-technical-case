import "server-only";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import {
  companySchema,
  contentItemSchema,
  errorResponseSchema,
  proposalForUpdateSchema,
  proposalMutationResponseSchema,
  proposalSchema,
  proposalSearchResultSchema,
  type ProposalForUpdate,
  type Company,
  type ContentItem,
  type Proposal,
  type ProposalSearchResult,
} from "./schemas";

// Proposales API client. Reads, plus two writes for "Update draft in Proposales": adding a
// draft's blocks and creating an upgrade supplement product. Writes are only called after the
// salesperson has confirmed the update; nothing is ever sent or published.

const BASE_URL = "https://api.proposales.com";
/** Maximum proposals per search (spec: 1–25, no pagination). */
export const SEARCH_LIMIT_MAX = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposalesErrorKind =
  | "unauthorized"
  | "not_found"
  | "bad_request"
  | "invalid_response"
  | "network"
  | "conflict"
  | "server";

export class ProposalesApiError extends Error {
  constructor(
    message: string,
    readonly kind: ProposalesErrorKind,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProposalesApiError";
  }
}

function kindForStatus(status: number): ProposalesErrorKind {
  if (status === 400) return "bad_request";
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  return "server";
}

async function request<T>(path: string, schema: z.ZodType<T>, write?: { method: "PATCH" | "POST"; body: unknown }): Promise<T> {
  const { PROPOSALES_API_KEY } = getServerEnv();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: write?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${PROPOSALES_API_KEY}`,
        Accept: "application/json",
        ...(write && { "Content-Type": "application/json" }),
      },
      body: write && JSON.stringify(write.body),
      cache: "no-store",
    });
  } catch {
    throw new ProposalesApiError("Could not reach the Proposales API", "network");
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const apiError = errorResponseSchema.safeParse(body);
    const message = apiError.success ? apiError.data.error.message : response.statusText;
    throw new ProposalesApiError(
      `Proposales API error (${response.status}): ${message}`,
      kindForStatus(response.status),
      response.status,
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    // Report only the paths that failed, never the response content (may contain PII).
    const paths = parsed.error.issues.map((issue) => issue.path.join(".") || "(root)");
    throw new ProposalesApiError(
      `Unexpected Proposales API response for ${path.split("?")[0]} at: ${paths.slice(0, 5).join(", ")}`,
      "invalid_response",
      response.status,
    );
  }
  return parsed.data;
}

const dataList = <T extends z.ZodType>(item: T) => z.object({ data: z.array(item) });

export async function listCompanies(): Promise<Company[]> {
  const { data } = await request("/v3/companies", dataList(companySchema));
  return data;
}

/** Returns up to 25 proposals, most recently updated first. The API has no pagination. */
export async function searchProposals(options: {
  /** Optional: without it, the API searches every company the token can access. */
  companyId?: number;
  includeArchived?: boolean;
  /** Exact matches on keys of the proposal `data` metadata, sent as filter[key]=value. */
  dataFilters?: Record<string, string>;
}): Promise<ProposalSearchResult[]> {
  const params = new URLSearchParams({
    limit: String(SEARCH_LIMIT_MAX), // The API default is 1.
    exclude_revision_drafts: "true",
    include_archived: String(options.includeArchived ?? false),
  });
  if (options.companyId) params.set("company_id", String(options.companyId));
  for (const [key, value] of Object.entries(options.dataFilters ?? {})) {
    params.set(`filter[${key}]`, value);
  }
  const { data } = await request(
    `/v3/proposal-search?${params}`,
    dataList(proposalSearchResultSchema),
  );
  return data;
}

async function fetchProposal<T>(uuid: string, schema: z.ZodType<T>): Promise<T> {
  if (!UUID_PATTERN.test(uuid)) {
    throw new ProposalesApiError("Invalid proposal ID", "bad_request");
  }
  try {
    const { data } = await request(`/v3/proposals/${uuid}`, z.object({ data: schema }));
    return data;
  } catch (error) {
    // The API answers an unknown proposal with 500 and an empty body instead of 404.
    if (error instanceof ProposalesApiError && error.status === 500) {
      throw new ProposalesApiError("Proposal not found or unavailable", "not_found", 500);
    }
    throw error;
  }
}

export function getProposal(uuid: string): Promise<Proposal> {
  return fetchProposal(uuid, proposalSchema);
}

/** The proposal with its blocks exactly as stored, as the basis for a draft update. */
export function getProposalForUpdate(uuid: string): Promise<ProposalForUpdate> {
  return fetchProposal(uuid, proposalForUpdateSchema);
}

/**
 * Replaces a draft's full, ordered block list (`PATCH /v3/proposals/{uuid}`). Only drafts and
 * templates can be updated; nothing is sent to the customer.
 */
export async function updateProposalDraftBlocks(uuid: string, companyId: number, blocks: unknown[]): Promise<void> {
  if (!UUID_PATTERN.test(uuid)) {
    throw new ProposalesApiError("Invalid proposal ID", "bad_request");
  }
  await request(`/v3/proposals/${uuid}`, proposalMutationResponseSchema, {
    method: "PATCH",
    body: { company_id: companyId, blocks },
  });
}

export async function listContent(options: {
  companyId: number;
  productIds?: number[];
}): Promise<ContentItem[]> {
  const params = new URLSearchParams({ company_id: String(options.companyId) });
  if (options.productIds?.length) params.set("product_id", options.productIds.join(","));
  const { data } = await request(`/v3/content?${params}`, dataList(contentItemSchema));
  return data;
}

/** Creates one product in the content library and returns its variation id, used as a block's `content_id` (`POST /v3/content`). */
export async function createContent(input: { companyId: number; language: string; title: string; description: string }): Promise<number> {
  const { data } = await request("/v3/content", z.object({ data: z.object({ variation_id: z.number().int() }) }), {
    method: "POST",
    body: { company_id: input.companyId, language: input.language, title: input.title, description: input.description },
  });
  return data.variation_id;
}
