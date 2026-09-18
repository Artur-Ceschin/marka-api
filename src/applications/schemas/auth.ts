import z from "zod";

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

export {
  confirmSignUpSchema,
  forgotPasswordSchema,
  googleSignInSchema,
  resendCodeSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
};
