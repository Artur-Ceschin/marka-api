import z from "zod";

// Both or neither: a latitude without a longitude is not a location, and
// PlantNet cannot use half a coordinate.
const locationSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
});

const identifyRequestSchema = z.object({
  // Shape only — ownership is proved against the caller in the use case.
  key: z.string().min(1).max(512),
  location: locationSchema.optional(),
});

const confirmDetectionSchema = z.object({
  species: z.string().trim().min(1).max(256),
});

const createUploadSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const plantCandidateSchema = z.object({
  species: z.string().min(1),
  scientificName: z.string(),
  commonNames: z.string().array(),
  family: z.string(),
  genus: z.string(),
  confidence: z.number().min(0).max(1),
});

const identifyResponseSchema = z.object({
  success: z.boolean(),
  detectionId: z.string(),
  candidates: plantCandidateSchema.array(),
  status: z.enum(["pending_confirmation", "confirmed", "rejected"]),
  timestamp: z.string(),
});

const listDetectionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
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
  confirmDetectionSchema,
  createUploadSchema,
  errorResponseSchema,
  identifyRequestSchema,
  identifyResponseSchema,
  listDetectionsSchema,
  locationSchema,
  optionsSchema,
  plantCandidateSchema,
};
