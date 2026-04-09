import { Role } from "@prisma/client";
import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(3),
  password: z.string().min(6),
  role: z.nativeEnum(Role).optional()
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

export type LoginInput = z.infer<typeof loginSchema>;
