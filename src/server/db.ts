import console from "console";
import { PrismaClient } from "@prisma/client";

import { env } from "~/env";

const globalForDb = globalThis as unknown as {
  db: PrismaClient | undefined;
};

/**
 * The database instance is created directly as a PrismaClient
 * for compatibility with NextAuth PrismaAdapter
 *
 * In development, Next.js may create multiple processes, so we use
 * a singleton pattern to ensure only one instance per process
 */
if (!globalForDb.db) {
  // Create a new PrismaClient instance for this process
  console.log(`[db.ts] Creating PrismaClient (PID: ${process.pid})`);
  globalForDb.db = new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
  console.log(`[db.ts] Database service initialized (PID: ${process.pid})`);

  // Shared, idempotent cleanup handler
  const cleanupDatabase = async (reason: string) => {
    console.log(
      `[db.ts] Disconnecting database due to ${reason} (PID: ${process.pid})`
    );
    await globalForDb.db?.$disconnect();
    console.log(`[db.ts] Database disconnected successfully (PID: ${process.pid})`);
  };

  if (process.env.NODE_ENV === "development") {
    process.once("beforeExit", () => {
      console.log(`[db.ts] Process beforeExit (PID: ${process.pid})`);
      void cleanupDatabase("beforeExit");
    });
  } else {
    process.once("SIGTERM", () => {
      void cleanupDatabase("SIGTERM");
    });
    process.once("SIGINT", () => {
      void cleanupDatabase("SIGINT");
    });
  }
}

// Ensure db is defined before export
if (!globalForDb.db) {
  throw new Error("Failed to initialize database connection");
}

export const db = globalForDb.db;
