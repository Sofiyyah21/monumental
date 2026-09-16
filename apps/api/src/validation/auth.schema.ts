import { UserRole } from "@prisma/client";
import { z } from "zod";

const passwordSchema = z.string().min(8).max(128);

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: passwordSchema,
});

export const registerCustomerSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  password: passwordSchema,
});

export const createUserSchema = z.object({
  email: z.string().email().toLowerCase(),
  name: z.string().trim().min(1).max(120),
  password: passwordSchema,
  role: z.enum([UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF]),
});
