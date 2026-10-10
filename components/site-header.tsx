import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";

/**
 * Floating glass header bar, modelled on the proposales.com navigation. Uses the same container
 * as <Page>, and the same inner padding as cards, so the logo lines up with the content below.
 */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-10 mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <div className="flex h-16 items-center rounded-xl bg-surface-glass px-5 backdrop-blur-xl backdrop-saturate-150">
        <Link href="/" className="flex items-center gap-2.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <BrandMark />
          <span className="font-medium tracking-[-0.01em] text-heading">Revenue Copilot</span>
          <span className="hidden text-sm text-muted sm:inline">for Proposales</span>
        </Link>
      </div>
    </header>
  );
}
