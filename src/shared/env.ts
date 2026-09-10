import z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["dev", "production"]).default("dev"),
  PORT: z.coerce.number().default(3333),
  PLANTS_BUCKET: z.string().optional(),
  DETECTIONS_TABLE: z.string().optional(),
  USERS_TABLE: z.string().optional(),
  USER_POOL_ID: z.string().optional(),
  USER_POOL_CLIENT_ID: z.string().optional(),
  AWS_REGION: z.string().default("us-east-1"),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error(`Invalid environment variable`, z.treeifyError(_env.error));

  throw new Error("Invalid environment variable");
}

export const env = _env.data;
