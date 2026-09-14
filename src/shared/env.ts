import z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["dev", "production"]).default("dev"),
  PORT: z.coerce.number().default(3333),
  PLANTS_BUCKET: z.string().optional(),
  DETECTIONS_TABLE: z.string().optional(),
  USERS_TABLE: z.string().optional(),
  USAGE_TABLE: z.string().optional(),
  DAILY_IDENTIFY_LIMIT: z.coerce.number().int().min(1).default(5),
  USER_POOL_ID: z.string().optional(),
  USER_POOL_CLIENT_ID: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
  // Optional so the rest of the API boots without them; the gateways fall
  // back to fixtures and say so, rather than failing at import.
  PLANTNET_API_KEY: z.string().optional(),
  PLANTNET_PROJECT: z.string().default("all"),
  OPENAI_API_KEY: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error(`Invalid environment variable`, z.treeifyError(_env.error));

  throw new Error("Invalid environment variable");
}

export const env = _env.data;
