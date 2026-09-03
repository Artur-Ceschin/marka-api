import z from "zod";

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1, "Password is required"),
});

export { signUpSchema, signInSchema };
