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

const aiEnvSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is not set"),
  OPENAI_MODEL: z.string().min(1).default("gpt-5-mini"),
});

export type AiEnv = { model: string };

/** Live model calls by default; "mock" returns deterministic fake suggestions without calling OpenAI. */
export function getRecommendationsMode(): "live" | "mock" {
  return z.enum(["live", "mock"]).catch("live").parse(process.env.RECOMMENDATIONS_MODE);
}

/** OpenAI configuration, validated when a recommendation is requested. */
export function getAiEnv(): AiEnv {
  const env = aiEnvSchema.parse(process.env);
  return { model: env.OPENAI_MODEL };
}

/** Postgres connection string for feedback storage (Neon); null when not configured. */
export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!/^postgres(ql)?:\/\//.test(url)) throw new Error("Invalid server environment: DATABASE_URL");
  return url;
}
