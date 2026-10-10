import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProposal, ProposalesApiError, searchProposals } from "./client";

const UUID = "8838745d-74e2-4f66-8864-116f1731f6ab";

function respond(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === undefined ? "" : JSON.stringify(body), { status })),
  );
}

async function errorOf(promise: Promise<unknown>): Promise<ProposalesApiError> {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(ProposalesApiError);
  return error as ProposalesApiError;
}

beforeEach(() => {
  vi.stubEnv("PROPOSALES_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Proposales client error mapping", () => {
  it("maps 401 to unauthorized", async () => {
    respond(401, { error: { message: "Unauthorized" } });
    expect((await errorOf(searchProposals({}))).kind).toBe("unauthorized");
  });

  it("maps the API's 500-with-empty-body for an unknown proposal to not_found", async () => {
    respond(500, undefined);
    expect((await errorOf(getProposal(UUID))).kind).toBe("not_found");
  });

  it("rejects a malformed proposal id without calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await errorOf(getProposal("not-a-uuid"))).kind).toBe("bad_request");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports an unexpected response shape without leaking its content", async () => {
    respond(200, { data: [{ title: "Secret customer name", unexpected: true }] });
    const error = await errorOf(searchProposals({}));
    expect(error.kind).toBe("invalid_response");
    expect(error.message).not.toContain("Secret customer name");
  });

  it("maps a failed request to network", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("fetch failed"))));
    expect((await errorOf(searchProposals({}))).kind).toBe("network");
  });

  it("sends the bearer token and always asks for the maximum of 25 results", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await searchProposals({});
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("limit=25");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key");
  });
});
