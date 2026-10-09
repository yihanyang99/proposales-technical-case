import { cn } from "@/lib/cn";

export function LevelBars({ level, max = 3, className }: { level: number; max?: number; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${max * 5 - 1} 12`} className={cn("h-3 w-auto", className)}>
      {Array.from({ length: max }, (_, i) => {
        const height = 4 + (8 * i) / Math.max(1, max - 1);
        return (
          <rect
            key={i}
            x={i * 5}
            y={12 - height}
            width="3"
            height={height}
            rx="1"
            className={i < level ? "fill-heading" : "fill-badge"}
          />
        );
      })}
    </svg>
  );
}
