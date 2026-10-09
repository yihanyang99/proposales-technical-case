import type { ProductCategory } from "@/lib/catalog/rate-card";
import { cn } from "@/lib/cn";

const PATHS: Record<ProductCategory | "unknown", string> = {
  accommodation: "M4 6v13M4 15h16v4M20 15v-3a2 2 0 0 0-2-2h-8v5",
  meeting_room: "M3 5h18M5 5v9h14V5M12 14v2M9 20l3-4 3 4",
  food_and_beverage: "M5 8h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V8zM16 9.5h1.5a2 2 0 0 1 0 4H16",
  package: "M3 7.5 12 3l9 4.5-9 4.5-9-4.5zM3 7.5v9L12 21l9-4.5v-9M12 12v9",
  other: "M3.5 12.5V4.5a1 1 0 0 1 1-1h8l8 8-9 9-8-8zM8 8h.01",
  unknown: "M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.9-.9 1.5v.7M12 17h.01",
};

export function CategoryIcon({ category, className }: { category: ProductCategory | null; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={cn("size-5 shrink-0 text-heading", className)}>
      <path
        d={PATHS[category ?? "unknown"]}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
