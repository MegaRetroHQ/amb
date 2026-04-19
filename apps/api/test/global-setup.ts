import "dotenv/config";
import { PrismaClient } from "@amb-app/db";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Jest globalSetup for e2e tests.
 *
 * Truncates all application tables in the `public` schema so each run starts
 * from a deterministic state. Preserves the `_prisma_migrations` bookkeeping
 * table so migrations are not re-applied.
 *
 * Runs once before the whole suite; individual tests may still create their
 * own fixtures and rely on unique-constraint scoping per project/tenant.
 */
export default async function globalSetup(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[e2e globalSetup] DATABASE_URL must be set before running e2e tests."
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({
    adapter,
    log: ["warn", "error"],
  } as ConstructorParameters<typeof PrismaClient>[0]);

  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ tablename: string }>>(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`
    );

    if (rows.length === 0) return;

    const tableList = rows
      .map((r) => `"public"."${r.tablename}"`)
      .join(", ");

    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`
    );

    // Re-apply the fixed seed that migration 20260315200000 installs, since
    // TRUNCATE wipes it. Tests assume the default tenant exists with a known id.
    await prisma.$executeRawUnsafe(
      `INSERT INTO "Tenant" ("id", "name", "slug")
       VALUES ('11111111-1111-4111-8111-111111111111', 'Default Tenant', 'default')
       ON CONFLICT ("id") DO NOTHING`
    );
  } finally {
    await prisma.$disconnect();
  }
}
