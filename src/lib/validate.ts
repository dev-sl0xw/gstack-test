import { z } from "zod";

export const usernameSchema = z.string().regex(/^[a-z0-9_-]{3,20}$/);
export const emailSchema = z.string().email().toLowerCase().max(254);
export const passwordSchema = z.string().min(8).max(200);

export const signupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});

export const urlInputSchema = z
  .string()
  .max(2048)
  .url()
  .refine((u) => {
    try {
      const p = new URL(u).protocol;
      return p === "http:" || p === "https:";
    } catch {
      return false;
    }
  });

export const bookmarkInputSchema = z.object({
  url: urlInputSchema,
  tags: z.string().max(200).optional().default(""),
  is_public: z.union([z.literal("on"), z.literal("")]).optional(),
});
