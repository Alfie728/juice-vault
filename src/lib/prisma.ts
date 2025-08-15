import { PrismaClient } from "@prisma/client";
import { Effect } from "effect";

import { env } from "~/env";

export class PrismaClientService extends Effect.Service<PrismaClientService>()(
  "PrismaClientService",
  {
    dependencies: [],
    scoped: Effect.gen(function* () {
      const prisma = yield* Effect.acquireRelease(
        Effect.sync(() => {
          console.log(
            `[PrismaClientService] Creating new PrismaClient connection (PID: ${process.pid})`
          );
          return new PrismaClient({
            log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
          });
        }),
        (client) =>
          Effect.sync(() =>
            console.log(
              `[PrismaClientService] Disconnecting PrismaClient (PID: ${process.pid})`
            )
          ).pipe(
            Effect.flatMap(() => Effect.promise(() => client.$disconnect()))
          )
      );

      return prisma;
    }),
  }
) {}

/**
 * Database Service Tag
 * Defines the database service interface using Effect's Context.Tag
 * This provides type-safe dependency injection for database operations
 */
// export class Database extends Context.Tag("Database")<
//   Database,
//   PrismaClient
// >() {
//   /**
//    * Live implementation of the Database service
//    * Creates and configures a PrismaClient instance
//    */
//   static readonly Live = Layer.effect(
//     Database,
//     Effect.sync(() => {
//       const prisma = new PrismaClient({
//         log:
//           env.NODE_ENV === "development"
//             ? ["query", "error", "warn"]
//             : ["error"],
//       });

//       // Handle cleanup
//       if (typeof globalThis !== "undefined") {
//         const globalWithPrisma = globalThis as unknown as {
//           prisma: PrismaClient | undefined;
//         };

//         if (env.NODE_ENV !== "production") {
//           // In development, reuse the client to avoid exhausting connections
//           if (globalWithPrisma.prisma) {
//             return globalWithPrisma.prisma;
//           }
//           globalWithPrisma.prisma = prisma;
//         }
//       }

//       return prisma;
//     })
//   );

//   /**
//    * Test implementation for unit testing
//    * Can be overridden with a mock PrismaClient
//    */
//   static readonly Test = (mockClient: PrismaClient) =>
//     Layer.succeed(Database, mockClient);
// }
