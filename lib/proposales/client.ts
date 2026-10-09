import "server-only";
import { z } from "zod";
import { getServerEnv } from "@/lib/env";
import {
  companySchema,
  contentItemSchema,
  errorResponseSchema,
  proposalSchema,
  proposalSearchResultSchema,
  type Company,
  type ContentItem,
  type Proposal,
  type ProposalSearchResult,
} from "./schemas";

// Read-only Proposales API client. Write operations are intentionally absent: they
// require explicit user approval and are added only where a step needs them.

const BASE_URL = "https://api.proposales.com";
const SEARCH_LIMIT_MAX = 25;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ProposalesErrorKind =
  | "unauthorized"
  | "not_found"
  | "bad_request"
  | "invalid_response"
  | "network"
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
  return "server";
}

async function request<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const { PROPOSALES_API_KEY } = getServerEnv();

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${PROPOSALES_API_KEY}`, Accept: "application/json" },
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
  companyId: number;
  includeArchived?: boolean;
}): Promise<ProposalSearchResult[]> {
  const params = new URLSearchParams({
    company_id: String(options.companyId),
    limit: String(SEARCH_LIMIT_MAX), // The API default is 1.
    exclude_revision_drafts: "true",
    include_archived: String(options.includeArchived ?? false),
  });
  const { data } = await request(
    `/v3/proposal-search?${params}`,
    dataList(proposalSearchResultSchema),
  );
  return data;
}

export async function getProposal(uuid: string): Promise<Proposal> {
  if (!UUID_PATTERN.test(uuid)) {
    throw new ProposalesApiError("Invalid proposal ID", "bad_request");
  }
  try {
    const { data } = await request(
      `/v3/proposals/${uuid}`,
      z.object({ data: proposalSchema }),
    );
    return data;
  } catch (error) {
    // The API answers an unknown proposal with 500 and an empty body instead of 404.
    if (error instanceof ProposalesApiError && error.status === 500) {
      throw new ProposalesApiError("Proposal not found or unavailable", "not_found", 500);
    }
    throw error;
  }
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
