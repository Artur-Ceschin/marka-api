import z from "zod";

const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const detectRequestSchema = z.object({
  image: z.instanceof(File),
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

const detectResponseSchema = z.object({
  success: z.boolean(),
  plant: plantDataSchema.array(),
  timestamp: z.iso.datetime(),
});

const errorResponseSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.string().optional(),
});

export {
  locationSchema,
  detectRequestSchema,
  plantDataSchema,
  detectResponseSchema,
  errorResponseSchema,
};
