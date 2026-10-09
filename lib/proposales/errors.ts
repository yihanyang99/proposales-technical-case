import { ProposalesApiError } from "./client";

/** Maps known API failures to messages a salesperson can act on. Never exposes response bodies. */
export function describeError(error: unknown): string {
  if (error instanceof ProposalesApiError) {
    switch (error.kind) {
      case "unauthorized":
        return "Revenue Copilot is not authorized to read from Proposales. Check the API key configuration.";
      case "network":
        return "Proposales could not be reached. Check your connection and try again.";
      case "invalid_response":
        return "Proposales returned data in an unexpected format.";
      default:
        return "Proposales returned an error. Please try again.";
    }
  }
  return "Something went wrong while loading data.";
}

/** True when a proposal lookup failed because it does not exist or the ID is invalid. */
export function isNotFound(error: unknown): boolean {
  return error instanceof ProposalesApiError && (error.kind === "not_found" || error.kind === "bad_request");
}
