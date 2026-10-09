import "server-only";
import { z } from "zod";

const serverEnvSchema = z.object({
  PROPOSALES_API_KEY: z.string().min(1, "PROPOSALES_API_KEY is not set"),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Validates server-only environment variables on first use, so builds without
 * secrets (e.g. CI) still succeed while API calls fail fast with a clear error.
 * Never import this module from client components.
 */
export function getServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid server environment: ${missing}`);
  }
  return result.data;
}
