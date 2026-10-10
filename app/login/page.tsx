import type { Metadata } from "next";
import { Suspense } from "react";
import { BrandMark } from "@/components/brand-mark";
import { Card, Page, Skeleton } from "@/components/ui";
import { safeNextPath } from "@/lib/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Revenue Copilot" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Page className="flex items-start justify-center pt-24 sm:pt-32">
      {/* data-hide-header: no header here, its only link would lead back to the login (see globals.css). */}
      <Card className="w-full max-w-sm p-8" data-hide-header>
        <BrandMark className="size-10" />
        <h1 className="mt-6 text-2xl font-medium tracking-[-0.01em] text-heading">Sign in to Revenue Copilot</h1>
        <p className="mt-2 text-sm text-muted">AI revenue opportunities for your Proposales proposals. Enter the password you received.</p>
        <Suspense fallback={<Skeleton className="mt-8 h-[6.75rem] rounded-xl" />}>
          <LoginFields searchParams={searchParams} />
        </Suspense>
      </Card>
    </Page>
  );
}

async function LoginFields({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { next } = await searchParams;
  return <LoginForm next={safeNextPath(next)} />;
}
