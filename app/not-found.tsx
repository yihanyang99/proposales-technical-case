import Link from "next/link";
import { buttonStyles, Page, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

export default function NotFound() {
  return (
    <Page>
      <PageHeader title="Page not found" description="This page doesn't exist in Revenue Copilot." />
      <Link href="/" className={cn(buttonStyles(), "mt-6")}>
        All proposals
      </Link>
    </Page>
  );
}
