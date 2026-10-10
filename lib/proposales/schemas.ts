import { z } from "zod";

// Response schemas for the Proposales API (spec 2026.09.02, see docs/API_FINDINGS.md).
// They validate only the fields this app uses; unknown keys are stripped. Fields where the
// live API deviates from the spec (nulls, empty strings) are deliberately lenient.

export const taxModeSchema = z.enum(["standard", "simplified", "tax-free", "none"]);

export const proposalStatusSchema = z
  .enum(["accepted", "replaced", "active", "draft", "expired", "rejected", "template", "withdrawn"])
  .nullable();

/** Text keyed by language code, e.g. { en: "Meeting room" }. */
export const localizedTextSchema = z.record(z.string(), z.string());

export const companySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  currency: z.string().length(3),
  tax_mode: taxModeSchema,
  timezone: z.string().nullish(), // Required in the spec, but null live.
});

export const contentItemSchema = z.object({
  product_id: z.number().int(),
  variation_id: z.number().int(),
  title: localizedTextSchema,
  description: localizedTextSchema,
  deactivated_at: z.number().int().nullish(),
});

export const proposalSearchResultSchema = z.object({
  uuid: z.string(),
  series_uuid: z.string(),
  company_id: z.number().int(),
  title: z.string(),
  version: z.number().int().nullable(),
  status: proposalStatusSchema,
  data: z.record(z.string(), z.unknown()),
  updated_at: z.number().int(),
});

const multiProductSubrowSchema = z.object({
  id: z.string(),
  content_id: z.number().int().nullish(),
  label: z.string().nullish(),
  quantity: z.number().nullish(),
  value: z.number().nullish(),
  valueWithTax: z.number().nullish(),
  tax_rate: z.number().nullish(),
  included: z.boolean().nullish(),
});

const multiProductRowSchema = z.object({
  uuid: z.string().nullish(),
  dateFrom: z.string().nullish(),
  dateTo: z.string().nullish(),
  label: z.string().nullish(),
  quantity: z.number().nullish(),
  occupancy: z.number().nullish(),
  subrows: z.array(multiProductSubrowSchema).nullish(),
  unitValueWithDiscountWithoutTax: z.number().nullish(),
  unitValueWithDiscountWithTax: z.number().nullish(),
});

const packageSplitSchema = z.object({
  type: z.string(),
  value_with_tax: z.number().nullish(),
  value_without_tax: z.number().nullish(),
  vat: z.number().nullish(),
});

export const proposalBlockSchema = z.object({
  uuid: z.string(),
  type: z.string(),
  content_id: z.number().int().nullish(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  currency: z.string().nullish(),
  quantity: z.number().nullish(),
  optional: z.boolean().nullish(),
  optional_picked: z.boolean().nullish(),
  recurring: z.boolean().nullish(),
  unit_value_with_discount_with_tax: z.number().nullish(),
  unit_value_with_discount_without_tax: z.number().nullish(),
  unit_value_without_discount_with_tax: z.number().nullish(),
  unit_value_without_discount_without_tax: z.number().nullish(),
  package_split: z.array(packageSplitSchema).nullish(),
  multi_product_enabled: z.boolean().nullish(),
  multi_product_data: z.array(multiProductRowSchema).nullish(),
});

/**
 * Customer PII (recipient_*, contact_*, signatures) is intentionally not part of this
 * schema, so it is stripped at the boundary and never reaches logs, UI state or the LLM.
 */
export const proposalSchema = z.object({
  uuid: z.string(),
  series_uuid: z.string().nullish(),
  company_id: z.number().int(),
  title: z.string().nullish(),
  description_md: z.string().nullish(),
  language: z.string(),
  status: proposalStatusSchema,
  version: z.number().int().nullish(),
  currency: z.string().nullish(),
  tax_options: z
    .object({ mode: taxModeSchema.nullish(), tax_included: z.boolean().nullish() })
    .nullish(),
  value_with_tax: z.number().nullish(),
  value_without_tax: z.number().nullish(),
  data: z.record(z.string(), z.unknown()),
  blocks: z.array(proposalBlockSchema),
  updated_at: z.number().int().nullish(),
});

/**
 * Write path only: a block exactly as the API returned it, unknown fields included. A draft
 * update replaces the full block list, so existing blocks must be re-sent without losing data.
 */
export const rawBlockSchema = z.looseObject({ uuid: z.string(), type: z.string() });
export type RawBlock = z.infer<typeof rawBlockSchema>;

/** Write path only: what a draft update needs. Customer PII is stripped like everywhere else. */
export const proposalForUpdateSchema = z.object({
  uuid: z.string(),
  company_id: z.number().int(),
  language: z.string(),
  status: proposalStatusSchema,
  currency: z.string().nullish(),
  blocks: z.array(rawBlockSchema),
});
export type ProposalForUpdate = z.infer<typeof proposalForUpdateSchema>;

export const proposalMutationResponseSchema = z.object({
  proposal: z.object({ uuid: z.string(), url: z.string() }),
});

export const errorResponseSchema = z.object({
  error: z.object({ message: z.string(), code: z.string().optional() }),
});

export type Company = z.infer<typeof companySchema>;
export type ContentItem = z.infer<typeof contentItemSchema>;
export type ProposalSearchResult = z.infer<typeof proposalSearchResultSchema>;
export type ProposalBlock = z.infer<typeof proposalBlockSchema>;
export type Proposal = z.infer<typeof proposalSchema>;
export type ProposalStatus = z.infer<typeof proposalStatusSchema>;
