import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import type { DatabaseClient } from "../lib/database.js";

export const bootstrapAdminEnvSchema = z.object({
  BOOTSTRAP_ADMIN_EMAIL: z.string().email(),
  BOOTSTRAP_ADMIN_NAME: z.string().trim().min(1).max(120),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).max(128),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
});

export type BootstrapAdminEnv = z.infer<typeof bootstrapAdminEnvSchema>;

export type BootstrapAdminResult =
  | { status: "created"; adminId: string }
  | { status: "skipped"; reason: "admin_exists" };

export async function bootstrapFirstAdmin(
  db: DatabaseClient,
  input: BootstrapAdminEnv,
): Promise<BootstrapAdminResult> {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(928372001)`;

    const existingAdminCount = await tx.user.count({
      where: { role: UserRole.ADMIN },
    });

    if (existingAdminCount > 0) {
      return { status: "skipped", reason: "admin_exists" };
    }

    const email = input.BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
    const existingUser = await tx.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      throw new Error(
        "Cannot bootstrap admin because BOOTSTRAP_ADMIN_EMAIL already belongs to an existing non-admin user.",
      );
    }

    const passwordHash = await bcrypt.hash(
      input.BOOTSTRAP_ADMIN_PASSWORD,
      input.BCRYPT_SALT_ROUNDS,
    );

    const admin = await tx.user.create({
      data: {
        email,
        name: input.BOOTSTRAP_ADMIN_NAME,
        passwordHash,
        role: UserRole.ADMIN,
      },
    });

    return { status: "created", adminId: admin.id };
  });
}
