// Links into the Proposales web app. Pure, so pages and client components can use them.

const APP_URL = "https://next.proposales.com";

/** The proposal in the Proposales editor, where the salesperson finishes and sends it. */
export function proposalEditorUrl(uuid: string): string {
  return `${APP_URL}/proposals/${encodeURIComponent(uuid)}/edit`;
}
