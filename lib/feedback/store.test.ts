import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedbackRecord } from "./model";

const record = (recommendationId: string, proposalUuid = "8838745d-74e2-4f66-8864-116f1731f6ab"): FeedbackRecord => ({
  proposalUuid,
  recommendationId,
  type: "cross_sell",
  productId: 190481,
  suggestedQuantity: 80,
  confidence: "high",
  decision: { status: "accepted", quantity: 80 },
  updatedAt: "2026-10-10T08:00:00.000Z",
});

async function freshStore() {
  vi.resetModules();
  delete (globalThis as { feedbackRecords?: unknown }).feedbackRecords;
  const { getFeedbackStore } = await import("./store");
  return getFeedbackStore();
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getFeedbackStore without DATABASE_URL", () => {
  it("keeps one decision per suggestion in memory during development", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "development");
    const store = await freshStore();

    await store.save(record("cross_sell:190481:"));
    await store.save({ ...record("cross_sell:190481:"), decision: { status: "accepted", quantity: 60 } });
    await store.save(record("cross_sell:190490:", "e36a4098-597e-417d-b972-72c64275d1b0"));
    expect(await store.listForProposal("8838745d-74e2-4f66-8864-116f1731f6ab")).toEqual([
      { ...record("cross_sell:190481:"), decision: { status: "accepted", quantity: 60 } },
    ]);

    await store.remove("8838745d-74e2-4f66-8864-116f1731f6ab", "cross_sell:190481:");
    expect(await store.listForProposal("8838745d-74e2-4f66-8864-116f1731f6ab")).toEqual([]);
  });

  it("refuses to run in production, so feedback is never silently lost", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(freshStore()).rejects.toMatchObject({ kind: "not_configured" });
  });
});
