import { describe, expect, it } from "vitest";
import { proposalEditorUrl } from "./links";

describe("proposalEditorUrl", () => {
  it("links to the proposal in the Proposales editor", () => {
    expect(proposalEditorUrl("cbaf3a00-c3c5-44b7-87ee-de682c6263a1")).toBe(
      "https://next.proposales.com/proposals/cbaf3a00-c3c5-44b7-87ee-de682c6263a1/edit",
    );
  });
});
