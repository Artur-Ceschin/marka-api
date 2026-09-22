import z from "zod";
import { homeLocationSchema } from "@/applications/schemas/location";
import { UPLOAD_CONTENT_TYPES } from "@/infra/clients/s3";

// Mirrors the PasswordPolicy in sls/resources/cognito.yml. Change both.
const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number");

const signUpSchema = z.object({
  email: z.email(),
  password: passwordSchema,
});

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

const confirmSignUpSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

const resetPasswordSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  password: passwordSchema,
});

// The Google callback's authorization code, sent on for a server-side exchange.
const googleSignInSchema = z.object({
  code: z.string().min(1).max(2048),
  // RFC 7636: 43–128 characters from the URL-unreserved set.
  codeVerifier: z
    .string()
    .regex(/^[A-Za-z0-9\-._~]{43,128}$/, "Invalid code verifier"),
  redirectUri: z.url(),
});

const resendCodeSchema = z.object({
  email: z.email(),
});

// A trimmed empty string means "clear it", so it is folded into null here
// rather than storing "" and making every reader check for both.
const blankToNull = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value.length === 0 ? null : value));

// Each field is optional (absent = leave alone) but nullable (null = remove).
// Zod's .optional() alone would collapse those into the same thing.
const updateProfileSchema = z
  .object({
    // 80 is generous for a display name and short enough that it cannot be
    // used to smuggle a paragraph into a field the UI renders on one line.
    name: blankToNull(80).nullable().optional(),
    bio: blankToNull(500).nullable().optional(),
    // The key is checked against the caller's own prefix in the use case;
    // shape-checking it here only rejects the obviously malformed.
    avatarKey: z.string().min(1).max(512).nullable().optional(),
    // The default the identify flow offers as "use my home location".
    homeLocation: homeLocationSchema.nullable().optional(),
  })
  // Rejects `{}`, which would otherwise cost a DynamoDB write to change
  // nothing but updatedAt.
  .refine(
    (body) => Object.values(body).some((value) => value !== undefined),
    "Provide at least one field to update",
  );

// The same schema the save path uses, so the previewed point and the stored
// point are identical — including the rounding.
const previewLocationSchema = homeLocationSchema;

const avatarUploadSchema = z.object({
  contentType: z.enum(UPLOAD_CONTENT_TYPES),
});

export {
  avatarUploadSchema,
  confirmSignUpSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  previewLocationSchema,
  resendCodeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
};
