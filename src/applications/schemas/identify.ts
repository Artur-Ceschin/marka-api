import z from "zod";
import { UPLOAD_CONTENT_TYPES } from "@/infra/clients/s3";

// Both or neither: a latitude without a longitude is not a location.
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
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
});

const listDetectionsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

export {
  confirmDetectionSchema,
  createUploadSchema,
  identifyRequestSchema,
  listDetectionsSchema,
};
