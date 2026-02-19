import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_APP_ENV: z.string().optional(),
});

const telemetryEnvSchema = z.object({
  AXIOM_TOKEN: z.string().min(1),
  AXIOM_DATASET: z.string().min(1),
  NEXT_PUBLIC_APP_ENV: z.string().optional(),
});

let cachedPublicEnv: z.infer<typeof publicEnvSchema> | null = null;

export const getPublicEnv = () => {
  if (cachedPublicEnv) return cachedPublicEnv;
  cachedPublicEnv = publicEnvSchema.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });
  return cachedPublicEnv;
};

export const getTelemetryEnv = () => {
  const parsed = telemetryEnvSchema.safeParse({
    AXIOM_TOKEN: process.env.AXIOM_TOKEN,
    AXIOM_DATASET: process.env.AXIOM_DATASET,
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
  });

  if (!parsed.success) {
    return null;
  }
  return parsed.data;
};

