import z from "zod";

/**
 * These password rules mirror the Cognito password policy in
 * sls/resources/cognito.yml on purpose. Validating here means a weak
 * password is a clean 400 from our API; letting Cognito catch it means
 * a round trip and a vendor-shaped error message.
 *
 * If you change one, change the other.
 */
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

// Cognito's emailed confirmation code is always 6 digits.
const confirmSignUpSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
});

const forgotPasswordSchema = z.object({
  email: z.email(),
});

// The new password goes through the same policy as sign-up — Cognito
// enforces it either way, so catching it here keeps the error shape uniform.
const resetPasswordSchema = z.object({
  email: z.email(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  password: passwordSchema,
});

export {
  signUpSchema,
  signInSchema,
  confirmSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
