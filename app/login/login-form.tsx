"use client";

import { useActionState } from "react";
import { Button, FieldLabel, Input, Spinner } from "@/components/ui";
import { signIn, type SignInState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="mt-8 space-y-3">
      <input type="hidden" name="next" value={next} />
      <FieldLabel htmlFor="password">Password</FieldLabel>
      <Input
        id="password"
        name="password"
        type="password"
        variant="soft"
        autoComplete="current-password"
        placeholder="Password"
        required
        autoFocus
        aria-invalid={state.error ? true : undefined}
        aria-describedby={state.error ? "password-error" : undefined}
      />
      {state.error && (
        <p id="password-error" role="alert" className="px-1 text-sm text-failure">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending && <Spinner />}
        Sign in
      </Button>
    </form>
  );
}
