import z from "zod";
import { locationSchema } from "@/applications/schemas/location";
import { UPLOAD_CONTENT_TYPES } from "@/infra/clients/s3";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MAX_NOTES_LENGTH = 2000;

const observedAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString())
  .refine(
    (value) => Date.parse(value) <= Date.now() + MAX_CLOCK_SKEW_MS,
    "Observed time cannot be in the future",
  );

const identifyRequestSchema = z.object({
  // Shape only — ownership is proved against the caller in the use case.
  key: z.string().min(1).max(512),
  location: locationSchema.optional(),
  observedAt: observedAtSchema.optional(),
});

const updateDetectionSchema = z
  .object({
    // A blank note is a removed note, not a stored "".
    notes: z
      .string()
      .trim()
      .max(MAX_NOTES_LENGTH)
      .transform((value) => value || null)
      .nullable()
      .optional(),
    observedAt: observedAtSchema.nullable().optional(),
    location: locationSchema.nullable().optional(),
  })
  .refine(
    (changes) => Object.values(changes).some((value) => value !== undefined),
    "Send at least one of notes, observedAt or location",
  );

const confirmDetectionSchema = z.object({
  identificationToken: z.string().min(1).max(32_000),
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
  updateDetectionSchema,
};
