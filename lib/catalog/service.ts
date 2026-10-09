import "server-only";
import { listContent } from "@/lib/proposales/client";
import { joinCatalog, type Catalog } from "./model";
import { rateCard } from "./rate-card";

/** The company's active products, priced from the rate card. Archived products are excluded. */
export async function getCatalog(companyId: number, language: string): Promise<Catalog> {
  return joinCatalog(await listContent({ companyId }), rateCard, language);
}
