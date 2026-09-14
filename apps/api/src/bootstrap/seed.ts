import dotenv from "dotenv";
import { PrismaClient, UserRole } from "@prisma/client";
import { bootstrapAdminEnvSchema, bootstrapFirstAdmin } from "./first-admin.js";

dotenv.config({ quiet: true });

const prisma = new PrismaClient();

async function main() {
  const existingAdminCount = await prisma.user.count({
    where: { role: UserRole.ADMIN },
  });
  if (existingAdminCount > 0) {
    console.log("Bootstrap admin already exists; skipping.");
    return;
  }

  const parsed = bootstrapAdminEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      "Bootstrap admin requires BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_NAME, and BOOTSTRAP_ADMIN_PASSWORD.",
    );
  }

  const result = await bootstrapFirstAdmin(prisma, parsed.data);
  if (result.status === "created") {
    console.log("Bootstrap admin created.");
  } else {
    console.log("Bootstrap admin already exists; skipping.");
  }
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : "Bootstrap admin failed.";
    console.error(message);
    process.exitCode = 1;
  });
