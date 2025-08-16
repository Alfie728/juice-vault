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
import { NodeSdk } from "@effect/opentelemetry";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

// import { EmbeddingsService } from "~/domain/ai/embeddings-service";
import { LyricsAIService } from "~/domain/ai/lyrics-ai-service";
import { S3Service } from "~/domain/infra/s3-service";
import { LyricsService } from "~/domain/lyrics/service";
import { SongService } from "~/domain/song/service";
import { PrismaClientService } from "~/lib/prisma";

// OpenTelemetry layer - exact same config as working test file
const NodeSdkLive = NodeSdk.layer(() => ({
  resource: {
    serviceName: "juice-vault",
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
        ? `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`
        : "http://localhost:4318/v1/traces",
    })
  ),
}));

const MainLayer = Layer.mergeAll(
  PrismaClientService.Default,
  // EmbeddingsService.Default, // Commented out - no Upstash Vector config needed
  LyricsService.Default,
  LyricsAIService.Default,
  S3Service.Default,
  SongService.Default,
  NodeSdkLive // Add OpenTelemetry layer
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
