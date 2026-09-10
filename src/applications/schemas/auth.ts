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

export {
  signUpSchema,
  signInSchema,
  confirmSignUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
