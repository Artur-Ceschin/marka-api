import z from "zod";

const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const identifyRequestSchema = z.object({
  image: z.object({}),
  location: locationSchema.optional(),
});

const plantDataSchema = z.object({
  species: z.string().min(1),
  confidence: z.number().min(0).max(1),
  endemic: z.boolean(),
  plantType: z.enum([
    "trees",
    "shrubs",
    "herbs",
    "climbers",
    "creepers",
    "ferns",
    "mosses",
    "fungi",
  ]),
});

const identifyResponseSchema = z.object({
  success: z.boolean(),
  plant: plantDataSchema.array(),
  timestamp: z.string(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.string().optional(),
});

const optionsSchema = z
  .object({
    location: locationSchema,
  })
  .strict();

export {
  locationSchema,
  identifyRequestSchema,
  plantDataSchema,
  identifyResponseSchema,
  errorResponseSchema,
  optionsSchema,
};
