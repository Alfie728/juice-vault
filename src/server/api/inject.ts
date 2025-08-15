/**
 * Dependency Injection Configuration
 * Central place to wire up all services with their dependencies
 *
 * This pattern provides:
 * - Clear visibility of all service dependencies
 * - Easy testing by mocking the database
 * - Environment-specific configurations
 * - Service lifecycle management
 *
 * Use cases:
 * - Production: Real database and services
 * - Testing: Mock database and services
 * - Development: Debug-enabled services
 */
import { Layer, ManagedRuntime } from "effect";

import { PostService } from "~/domain/post/service";
import { PrismaClientService } from "~/lib/prisma";

const MainLayer = Layer.mergeAll(
  PostService.Default,
  PrismaClientService.Default
);

export const ServiceRuntime = ManagedRuntime.make(MainLayer);
/**
 * Injects services that require authentication
 * These services are available only in protected tRPC procedures
 *
 * Example usage in tRPC router:
 * .mutation(async ({ ctx, input }) => {
 *   return ctx.postService.createPost(input);
 * })
 */
export function injectProtectedServices() {
  return {
    runtime: ServiceRuntime,
  };
}

/**
 * Injects services available to public endpoints
 * Keep sensitive operations in protected services
 *
 * Use case: Public-facing APIs that don't require auth
 * Example: Blog post viewing, public statistics
 */
export function injectPublicServices() {
  // Return only services that should be publicly accessible
  // For now, we keep all services in protected context
  return {};
}
