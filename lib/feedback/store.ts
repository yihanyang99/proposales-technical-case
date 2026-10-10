import "server-only";
import { neon } from "@neondatabase/serverless";
import { getDatabaseUrl } from "@/lib/env";
import type { Decision, FeedbackRecord } from "./model";

export class FeedbackStoreError extends Error {
  constructor(
    message: string,
    readonly kind: "not_configured",
  ) {
    super(message);
    this.name = "FeedbackStoreError";
  }
}

export interface FeedbackStore {
  /** Inserts or replaces the decision for one suggestion. */
  save(record: FeedbackRecord): Promise<void>;
  /** Removes the decision for one suggestion (undo). */
  remove(proposalUuid: string, recommendationId: string): Promise<void>;
  listForProposal(proposalUuid: string): Promise<FeedbackRecord[]>;
}

/** One row per proposal and suggestion; created on first use. */
const CREATE_TABLE = `
  CREATE TABLE IF NOT EXISTS recommendation_feedback (
    proposal_uuid uuid NOT NULL,
    recommendation_id text NOT NULL,
    type text NOT NULL,
    product_id integer NOT NULL,
    suggested_quantity integer NOT NULL,
    confidence text NOT NULL,
    status text NOT NULL CHECK (status IN ('accepted', 'dismissed')),
    quantity integer,
    reason text,
    comment text,
    updated_at timestamptz NOT NULL,
    PRIMARY KEY (proposal_uuid, recommendation_id)
  )`;

type Row = {
  proposal_uuid: string;
  recommendation_id: string;
  type: FeedbackRecord["type"];
  product_id: number;
  suggested_quantity: number;
  confidence: FeedbackRecord["confidence"];
  status: Decision["status"];
  quantity: number | null;
  reason: string | null;
  comment: string | null;
  updated_at: Date | string;
};

function fromRow(row: Row): FeedbackRecord {
  const decision =
    row.status === "accepted"
      ? { status: "accepted" as const, quantity: row.quantity ?? row.suggested_quantity }
      : { status: "dismissed" as const, reason: row.reason as Extract<Decision, { status: "dismissed" }>["reason"], comment: row.comment };
  return {
    proposalUuid: row.proposal_uuid,
    recommendationId: row.recommendation_id,
    type: row.type,
    productId: row.product_id,
    suggestedQuantity: row.suggested_quantity,
    confidence: row.confidence,
    decision,
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function postgresStore(url: string): FeedbackStore {
  const sql = neon(url);
  let ready: Promise<unknown> | null = null;
  const ensureTable = () => {
    // Once per server instance; a failed attempt is retried on the next request.
    ready ??= sql.query(CREATE_TABLE).catch((error: unknown) => {
      ready = null;
      throw error;
    });
    return ready;
  };

  return {
    async save(record) {
      await ensureTable();
      const { decision } = record;
      const quantity = decision.status === "accepted" ? decision.quantity : null;
      const reason = decision.status === "dismissed" ? decision.reason : null;
      const comment = decision.status === "dismissed" ? decision.comment : null;
      await sql`
        INSERT INTO recommendation_feedback
          (proposal_uuid, recommendation_id, type, product_id, suggested_quantity, confidence, status, quantity, reason, comment, updated_at)
        VALUES
          (${record.proposalUuid}, ${record.recommendationId}, ${record.type}, ${record.productId}, ${record.suggestedQuantity},
           ${record.confidence}, ${decision.status}, ${quantity}, ${reason}, ${comment}, ${record.updatedAt})
        ON CONFLICT (proposal_uuid, recommendation_id) DO UPDATE SET
          type = EXCLUDED.type, product_id = EXCLUDED.product_id, suggested_quantity = EXCLUDED.suggested_quantity,
          confidence = EXCLUDED.confidence, status = EXCLUDED.status, quantity = EXCLUDED.quantity,
          reason = EXCLUDED.reason, comment = EXCLUDED.comment, updated_at = EXCLUDED.updated_at`;
    },
    async remove(proposalUuid, recommendationId) {
      await ensureTable();
      await sql`DELETE FROM recommendation_feedback WHERE proposal_uuid = ${proposalUuid} AND recommendation_id = ${recommendationId}`;
    },
    async listForProposal(proposalUuid) {
      await ensureTable();
      const rows = await sql`SELECT * FROM recommendation_feedback WHERE proposal_uuid = ${proposalUuid} ORDER BY updated_at`;
      return (rows as Row[]).map(fromRow);
    },
  };
}

/** Local development without a database: kept per server process, lost on restart. */
function memoryStore(): FeedbackStore {
  const globalForStore = globalThis as { feedbackRecords?: Map<string, FeedbackRecord> };
  const records = (globalForStore.feedbackRecords ??= new Map());
  const key = (proposalUuid: string, recommendationId: string) => `${proposalUuid}|${recommendationId}`;
  return {
    async save(record) {
      records.set(key(record.proposalUuid, record.recommendationId), record);
    },
    async remove(proposalUuid, recommendationId) {
      records.delete(key(proposalUuid, recommendationId));
    },
    async listForProposal(proposalUuid) {
      return [...records.values()].filter((record) => record.proposalUuid === proposalUuid);
    },
  };
}

let store: FeedbackStore | null = null;

/**
 * Postgres (Neon) when DATABASE_URL is set. Without it, an in-memory store in development, and an
 * error in production, so feedback is never silently lost on a deployment.
 */
export function getFeedbackStore(): FeedbackStore {
  if (store) return store;
  const url = getDatabaseUrl();
  if (url) return (store = postgresStore(url));
  if (process.env.NODE_ENV === "production") {
    throw new FeedbackStoreError("Feedback storage is not configured", "not_configured");
  }
  return (store = memoryStore());
}
