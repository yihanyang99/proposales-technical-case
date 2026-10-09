"use client";

import { Button, Page, PageHeader } from "@/components/ui";

// Fallback for unexpected errors. Expected API failures are handled inline by the pages.
export default function Error({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <Page>
      <PageHeader title="Something went wrong" description="An unexpected error occurred while loading this page." />
      <Button className="mt-6" onClick={() => retry()}>Try again</Button>
    </Page>
  );
}
