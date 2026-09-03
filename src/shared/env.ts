import z from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["dev", "production"]).default("dev"),
  PORT: z.coerce.number().default(3333),
  // Injected by serverless.yml in deployed environments. Optional because
  // local dev runs against the mocked S3/DynamoDB services.
  PLANTS_BUCKET: z.string().optional(),
  DETECTIONS_TABLE: z.string().optional(),
});

const _env = envSchema.safeParse(process.env);

if (_env.success === false) {
  console.error(`Invalid environment variable`, z.treeifyError(_env.error));

  throw new Error("Invalid environment variable");
}

export const env = _env.data;
